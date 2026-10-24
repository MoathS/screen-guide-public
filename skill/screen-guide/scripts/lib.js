// screen-guide recording library. Runs inside the puppeteer container (see run.sh):
//   /sg    the skill folder (read-only); this file is /sg/scripts/lib.js
//   /work  the job folder: clips/, profiles/, scripts/
// Frames and their timing are written to /work/clips/<name>/; clip.sh / compose.js
// turn them into video on the host, so the container needs no ffmpeg.
//
// A clip script:
//   const sg = require("/sg/scripts/lib");
//   sg.record("A", { url: "https://example.com/", layout: "portrait" }, async (s) => {
//     await s.wait(800); await s.tap("a.signup"); await s.type("#name", "سلمان");
//   });
//
// Why it works the way it does (details in references/gotchas.md):
//  - The page runs K times slower (JS clocks, timers, rAF, CSS animations, smooth
//    scrolling) while back-to-back screenshots sample it, then the timestamps are
//    divided by K: smooth 30 fps at full resolution, which a live screencast cannot give.
//  - Screenshots go through their own CDP session: page.screenshot() queues them, so
//    one that stalls during a page load would block every later frame.
//  - Every tap and typed character is logged, so compose.js adds effects and the
//    caption times can name moments ("save-0.2") instead of guessed seconds.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const K = 3;
const LAYOUTS = {
  // CSS viewport and scale whose screenshots fill the composition's screen area.
  portrait: { w: 432, h: 702, dpr: 960 / 432, mobile: true },   // -> 960x1560
  landscape: { w: 1024, h: 576, dpr: 1600 / 1024, mobile: false }, // -> 1600x900
  "landscape-wide": { w: 1280, h: 720, dpr: 1.25, mobile: false },
  "landscape-zoom": { w: 800, h: 450, dpr: 2, mobile: false },     // small pages, big text
};
// Blurred by default: phone and one-time-code inputs, otpauth links, and anything a
// page or the clip script marks with .sg-blur / [data-sg-blur]. Add an app's own
// secret elements (TOTP secret text, recovery codes, a requester's details) with `blur:`.
const BLUR_CSS = `input[type=tel], input[autocomplete="tel"], input[autocomplete="one-time-code"], a[href^="otpauth:"], .sg-blur, [data-sg-blur] { filter: blur(9px) !important; }`;

let SLOW = 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));

function slowTimeInit(K) {
  const rp = performance.now.bind(performance), rd = Date.now, t0p = rp(), t0d = rd();
  const fake = () => t0p + (rp() - t0p) / K;
  performance.now = fake;
  Date.now = () => t0d + (rd() - t0d) / K;
  const rAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rAF(() => cb(fake()));
  const sT = window.setTimeout.bind(window), sI = window.setInterval.bind(window);
  window.setTimeout = (f, ms = 0, ...a) => sT(f, ms * K, ...a);
  window.setInterval = (f, ms = 0, ...a) => sI(f, ms * K, ...a);
  // Native smooth scrolling ignores both clocks: replace it with an eased rAF scroll,
  // cancelled by any later scroll (as the browser's own would be).
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const orig = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (a) {
    if (a && typeof a === "object" && a.behavior === "smooth") {
      const el = this, from = [el.scrollLeft, el.scrollTop], to = [a.left ?? el.scrollLeft, a.top ?? el.scrollTop];
      const s = fake(), id = (el.__glide = (el.__glide || 0) + 1);
      const step = () => {
        if (el.__glide !== id) return;
        const k = Math.min(1, (fake() - s) / 520);
        el.__gliding = true; orig.call(el, from[0] + (to[0] - from[0]) * ease(k), from[1] + (to[1] - from[1]) * ease(k)); el.__gliding = false;
        if (k < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step); return;
    }
    this.__glide = (this.__glide || 0) + 1;
    return orig.apply(this, arguments); // apply, not call(this, a, b): two args means (x, y)
  };
  for (const prop of ["scrollLeft", "scrollTop"]) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    Object.defineProperty(Element.prototype, prop, { configurable: true, get: d.get, set(v) { if (!this.__gliding) this.__glide = (this.__glide || 0) + 1; d.set.call(this, v); } });
  }
}

function pageInit({ css, hide, blurDigits, devOverlay, tapColor }) {
  // A soft ripple where the simulated finger touches.
  window.__sgTap = (x, y) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;background:${tapColor}73;border:2px solid ${tapColor}e6;z-index:2147483647;pointer-events:none;transform:scale(.4);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out`;
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = "scale(1.25)"; d.style.opacity = "0"; }));
    setTimeout(() => d.remove(), 600);
  };
  if (devOverlay === false) new MutationObserver(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove())).observe(document, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.id = "sg-style";
    s.textContent = css + (hide.length ? `\n${hide.join(",")} { display: none !important; }` : "") + "\n.sg-digits { filter: blur(8px) !important; }";
    document.head.appendChild(s);
    if (!blurDigits) return;
    // Any run of 7+ digits in page text (a phone number, an ID) is wrapped and blurred.
    const RX = /[+]?[0-9٠-٩][0-9٠-٩ ]{6,}[0-9٠-٩]/;
    const scan = (root) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = [];
      for (let n; (n = tw.nextNode());) if (RX.test(n.nodeValue) && !n.parentElement?.closest(".sg-digits, script, style")) hits.push(n);
      for (const n of hits) { const m = n.nodeValue.match(RX), r = n.splitText(m.index); r.splitText(m[0].length); const sp = document.createElement("span"); sp.className = "sg-digits"; r.replaceWith(sp); sp.appendChild(r); }
    };
    scan(document.body);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); else if (n.nodeType === 3 && n.parentElement) scan(n.parentElement); }))).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

/**
 * record(name, options, steps) -> /work/clips/<name>/{f*.jpg,list.txt} and /work/clips/<name>.marks.json
 * (then on the host: clip.sh JOB <name> -> clips/<name>.mp4, or let compose.js build it)
 * options:
 *   url          first page (loaded before recording starts)
 *   layout       "portrait" | "landscape" | "landscape-wide" | "landscape-zoom" | { w, h, dpr, mobile }
 *   guard        true = abort every non-GET request (read-only visit) plus `block` URL fragments
 *   block        extra URL fragments to abort (e.g. "/api/stats")
 *   respond      [{ match, status, body }] answer matching requests locally (mock a step)
 *   basicAuth    { user, passEnv } -> Authorization header (never page.authenticate, see gotchas)
 *   headers      extra request headers
 *   profile      name -> persistent browser profile in /work/profiles/<name> (keeps a login)
 *   hide         CSS selectors hidden throughout (e.g. a list that shows unrelated people)
 *   blur         extra CSS selectors to blur; blurDigits (default true) blurs 7+ digit runs
 *   webauthn     true = attach a virtual authenticator (passkeys); s.webauthnOff() detaches it
 *   userAgent    "chrome" swaps HeadlessChrome for Chrome (sites that count visits drop HeadlessChrome)
 *   devOverlay   false = remove Next.js's dev badge
 *   tapColor     ripple colour as #rrggbb (default #D4A72C)
 *   settle       ms to wait after the first load (default 2500)
 */
async function record(name, o, steps) {
  const L = typeof o.layout === "object" ? o.layout : LAYOUTS[o.layout || "landscape"];
  const b = await puppeteer.launch({ args: ["--no-sandbox"], protocolTimeout: 120000, ...(o.profile ? { userDataDir: `/work/profiles/${o.profile}` } : {}) });
  const p = await b.newPage();
  const log = { taps: [], keys: [], marks: {} };
  let T0 = 0;
  const now = () => +((Date.now() - T0) / 1000 / K).toFixed(3);
  const mark = (l) => { log.marks[l] = now(); console.log(`MARK ${l} ${log.marks[l]}`); };
  p.on("dialog", (d) => d.accept());
  if (o.userAgent === "chrome") await p.setUserAgent((await b.userAgent()).replace("HeadlessChrome", "Chrome"));
  const headers = { ...(o.headers || {}) };
  if (o.basicAuth) headers.Authorization = "Basic " + Buffer.from(`${o.basicAuth.user}:${(process.env[o.basicAuth.passEnv] || "").trim()}`).toString("base64");
  if (Object.keys(headers).length) await p.setExtraHTTPHeaders(headers);
  if (o.guard || o.block || o.respond) {
    await p.setRequestInterception(true);
    p.on("request", (r) => {
      if (r.isInterceptResolutionHandled()) return;
      const u = r.url();
      const mock = (o.respond || []).find((m) => u.includes(m.match));
      if (mock) return r.respond({ status: mock.status || 200, contentType: "application/json", body: mock.body ?? "{}" });
      if ((o.block || []).some((f) => u.includes(f)) || (o.guard && r.method() !== "GET")) { if (!u.includes("challenges.cloudflare.com")) console.log("BLOCKED", r.method(), u.slice(0, 100)); return r.abort(); }
      r.continue();
    });
  }
  await p.evaluateOnNewDocument(pageInit, { css: BLUR_CSS + (o.blur?.length ? `\n${o.blur.join(",")} { filter: blur(9px) !important; }` : ""), hide: o.hide || [], blurDigits: o.blurDigits !== false, devOverlay: o.devOverlay, tapColor: o.tapColor || "#D4A72C" });
  await p.evaluateOnNewDocument(slowTimeInit, K);
  const anim = await p.createCDPSession();
  const slowAnim = async () => { try { await anim.send("Animation.enable"); await anim.send("Animation.setPlaybackRate", { playbackRate: 1 / K }); } catch {} };
  await slowAnim(); p.on("domcontentloaded", slowAnim); // a new document has a new timeline
  let auth = null;
  if (o.webauthn) {
    await anim.send("WebAuthn.enable");
    auth = (await anim.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })).authenticatorId;
  }
  await p.setViewport({ width: L.w, height: L.h, deviceScaleFactor: L.dpr, isMobile: !!L.mobile, hasTouch: !!L.mobile });

  const go = async (url) => { const s = SLOW; SLOW = 1; await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.evaluate(() => document.fonts.ready); SLOW = s; };
  if (o.url) await go(o.url);
  await new Promise((r) => setTimeout(r, o.settle ?? 2500));

  // capture loop
  const dir = `/work/clips/${name}`;
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cap = await p.createCDPSession();
  const emulate = () => cap.send("Emulation.setDeviceMetricsOverride", { width: L.w, height: L.h, deviceScaleFactor: L.dpr, mobile: !!L.mobile }).catch(() => {});
  await emulate(); p.on("framenavigated", (f) => { if (f === p.mainFrame()) emulate(); });
  const frames = []; let on = true, n = 0, errs = 0;
  const loop = (async () => {
    while (on) {
      const t = Date.now() / 1000;
      try {
        const r = await Promise.race([cap.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true }), new Promise((_, rej) => setTimeout(() => rej(new Error("shot timeout")), 2500))]);
        const f = `f${String(n++).padStart(5, "0")}.jpg`; fs.writeFileSync(`${dir}/${f}`, Buffer.from(r.data, "base64")); frames.push({ f, t });
      } catch (e) { if (++errs < 4) console.log("SHOT-ERR", String(e).slice(0, 120)); await new Promise((r) => setTimeout(r, 30)); }
    }
  })();
  T0 = Date.now(); SLOW = K; mark("start");

  const box = async (sel) => { const el = await p.waitForSelector(sel, { visible: true, timeout: 60000 }); return { el, bx: await el.boundingBox() }; };
  const s = {
    page: p, browser: b, K, mark, wait, go: async (url) => { log.taps.push(now()); await go(url); },
    /** Ripple + click (element click: no coordinate drift, no hover menus). */
    tap: async (sel, opt = {}) => {
      const { el, bx } = await box(sel);
      await p.evaluate((x, y) => window.__sgTap(x, y), bx.x + bx.width / 2, bx.y + bx.height / 2);
      log.taps.push(now()); if (opt.mark) mark(opt.mark);
      await wait(120);
      await el.evaluate((e) => { e.focus({ preventScroll: true }); e.click(); });
    },
    /** Ripple, then follow the link's href (optionally rewritten), as a full load. */
    tapGo: async (sel, rewrite) => {
      const { el, bx } = await box(sel);
      await p.evaluate((x, y) => window.__sgTap(x, y), bx.x + bx.width / 2, bx.y + bx.height / 2);
      log.taps.push(now()); await wait(150);
      let href = await el.evaluate((a) => a.href); if (rewrite) href = rewrite(new URL(href)).toString();
      await go(href);
    },
    /** Type into a React-controlled input or textarea, one character at a time. */
    type: async (sel, text, per = 110) => {
      for (const ch of text) {
        await p.$eval(sel, (i, ch) => {
          const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(i, i.value + ch);
          i.dispatchEvent(new Event("input", { bubbles: true }));
        }, ch);
        log.keys.push(now()); await wait(per);
      }
    },
    /** Eased page (or element) scroll by the page's slowed clock. to: px | "end" | CSS/xpath selector. */
    scroll: async (to, ms = 900, { within = null, offset = 100 } = {}) => {
      let y = to;
      if (typeof to === "string" && to !== "end") { const { el } = await box(to); y = await el.evaluate((e, off) => e.getBoundingClientRect().top + scrollY - off, offset); }
      await p.evaluate(async (within, y, ms) => {
        const e = within ? document.querySelector(within) : document.scrollingElement;
        const from = e.scrollTop, end = y === "end" ? e.scrollHeight - e.clientHeight : Math.max(0, y), s0 = performance.now();
        await new Promise((res) => { const f = (n) => { const k = Math.min(1, (n - s0) / ms), q = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; e.scrollTop = from + (end - from) * q; k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
      }, within, y, ms);
    },
    /** Wait (real time) until location matches, e.g. after a client-side navigation. */
    at: (prefix) => p.waitForFunction((x) => (location.pathname + location.search).startsWith(x), { timeout: 60000 }, prefix),
    settled: async () => { await p.evaluate(() => document.fonts.ready); await wait(800); },
    css: (text) => p.evaluate((t) => { const s = document.createElement("style"); s.className = "sg-extra"; s.textContent = t; document.head.appendChild(s); }, text),
    uncss: () => p.evaluate(() => document.querySelectorAll("style.sg-extra").forEach((s) => s.remove())),
    webauthnOff: async () => { if (auth) { await anim.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId: auth }); await anim.send("WebAuthn.disable"); auth = null; } },
  };
  let failed = null;
  try { await steps(s); } catch (e) { failed = e; console.log("STEP-ERROR", String(e).slice(0, 300)); }
  mark("end");
  on = false; await loop; SLOW = 1;
  if (auth) await s.webauthnOff().catch(() => {});
  let list = "";
  frames.forEach((f, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : f.t + 0.033 * K; list += `file '${f.f}'\nduration ${((next - f.t) / K).toFixed(4)}\n`; });
  list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${dir}/list.txt`, list);
  fs.writeFileSync(`/work/clips/${name}.marks.json`, JSON.stringify({ ...log.marks, _taps: log.taps, _keys: log.keys }));
  const span = (frames[frames.length - 1].t - frames[0].t) / K;
  console.log("REC", JSON.stringify({ clip: name, frames: frames.length, seconds: +span.toFixed(2), fps: +(frames.length / span).toFixed(1), failed: !!failed }));
  await b.close();
  if (failed) process.exitCode = 1;
}

module.exports = { record, LAYOUTS, K };
