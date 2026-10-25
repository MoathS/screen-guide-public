# Gotchas (each one broke a real recording)

## Capture
- **Live screencasts are too choppy and too small.** `page.screencast` / CDP
  `startScreencast` deliver CSS-pixel frames (432 px wide on a phone layout) at
  ~14 fps. `lib.js` instead slows the page ×3 and takes back-to-back full-DPR
  screenshots (~40–55 effective fps), then divides the timestamps by 3.
- **`page.screenshot()` is queued.** One screenshot that stalls during a full page
  load blocks every later one, so the clip silently ends there. Capture through
  your own CDP session with a per-shot timeout (`lib.js` does). That session needs
  its own `Emulation.setDeviceMetricsOverride`, or frames come out at CSS size.
- **`page.authenticate()` intercepts requests.** Use an `Authorization: Basic`
  header (`basicAuth:` option) for HTTP-auth gates (a password-protected staging site).
- **A virtual WebAuthn authenticator left attached** can stall after the next
  navigation. Call `s.webauthnOff()` as soon as the passkey step is done.
- **Slowing time.** JS clocks, timers and rAF are scaled in the page, CSS animations
  via `Animation.setPlaybackRate` (re-applied on every new document), and native
  smooth scrolling is replaced with an eased rAF scroll. Any new override of
  `scrollTo` must forward with `apply(this, arguments)`: `call(this, a, b)` with
  `b` undefined becomes the `(x, y)` form and scrolls to 0,0. This broke the
  app's camera fly-to.
- **Waits are page time.** `s.wait(1000)` is 1 s of the finished video. Real-time
  waits (`waitForSelector` timeouts, network) are not scaled.

## Interacting
- **Typing into React inputs:** set the value with the native setter and dispatch
  `input` (`s.type` does). `page.type` can lose characters while frames are
  being captured.
- **Taps:** `s.tap` clicks the element itself. Coordinate clicks drifted once and
  landed on a neighbouring button instead of the search box.
- **Selectors:** inputs may have no `type` attribute (`input[type=text]` misses them).
  `contains(text(), …)` misses text split across nodes; use
  `contains(normalize-space(.), …)`, and pick the innermost match.
- **A hidden duplicate** (desktop toolbar hidden on phones) makes
  `waitForSelector(visible)` wait on the wrong one: scope it (`.ft-frame button…`).
- **Lazy images** may be blank for a moment after a card opens: warm them first
  (`fetch` the URL inside the page) and cut the blank stretch (`cut:` in the spec).
- **After saving, apps navigate back** (to "where you came from" or to an
  unfiltered list that may show unrelated people). Steer it: open the edit page
  with a `back=` you choose (`s.tapGo(sel, (u) => { u.searchParams.set("back", "/admin/tree"); return u; })`),
  or use the "save and add another" button.
- **Bot checks** (Turnstile) never pass headless. Ask the user to submit that form.
- **Native confirm()** dialogs are accepted automatically; `<dialog>` elements are
  ordinary DOM: tap their buttons.

## Privacy
- Blur happens in the page (CSS filter), so blurred pixels are what gets recorded.
  Check the sheets anyway, especially a requester's details, a phone field on an edit
  form, and the sidebar email.
- Lists that open on everyone (members, statistics) can show people the video
  should not. Hide the table until the search has run (`s.css("main table{visibility:hidden}")`, then `s.uncss()`).
- Never log secrets. Pass them via `SG_ENV` names and print only "link obtained" etc.

## Environment
- The puppeteer image already contains Chrome and puppeteer: no npm install. A local
  dev server (e.g. Next.js) can run in the same image with the app's `node_modules`
  mounted read-only; stop it when done.
- ffmpeg runs on the host only (`clip.sh`, `compose.js`, `sheet.sh`). `get-ffmpeg.sh`
  uses `$SG_FFMPEG`, then `ffmpeg` on PATH, then (Linux) a cached static build.
- Docker Desktop (macOS/Windows) has no host networking for containers: set
  `SG_NETWORK=bridge` and address local apps as `host.docker.internal`.
- Pooled or union filesystems (Unraid `/mnt/user`, mergerfs) report the free space of the
  whole pool. Point `estimate.js --dir` at the disk that really holds the job folder.
- Secure cookies are not stored over plain http (other than localhost): record
  logged-in flows over https.
