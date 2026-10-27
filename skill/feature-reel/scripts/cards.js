// cards.js SPEC.js  (inside the container via run.sh) -> /work/cards/<layout>/*.png
// Renders every title, caption and outro card a job's spec needs, in its theme.
const fs = require("fs");
const puppeteer = require("puppeteer");
const spec = require(require("path").resolve("/work", process.argv[2]));
const layout = spec.layout || "landscape", land = layout !== "portrait";
const th = spec.theme || {};
const theme = Object.fromEntries(Object.entries(th).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
// A logo given as a path is read from the job folder.
if (theme.logo && !/^(https?|data|file):/.test(theme.logo)) theme.logo = "file:///work/" + theme.logo.replace(/^\.?\//, "");
const list = [["bg0", { m: "bg", t: "", s: "" }], ["outro", { m: "outro", ...(spec.outro || {}) }]];
for (const [id, v] of Object.entries(spec.videos)) {
  if (v.title) list.push([`${id}-title`, { m: "title", ...v.title }]);
  if (v.outro) list.push([`${id}-outro`, { m: "outro", ...v.outro }]);
  v.segs.forEach((sg, i) => sg.caps.forEach((c, j) => list.push([`${id}-${i}-${j}`, { m: "bg", n: v.title?.badge ?? "", t: c[1], s: c[2] || "" }])));
}
(async () => {
  const OUT = `/work/cards/${layout}`; // one folder per layout: specs of both layouts can share a job
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: land ? 1920 : 1080, height: land ? 1080 : 1920, deviceScaleFactor: 1 });
  for (const [name, q] of list) {
    const qs = new URLSearchParams({ layout, ...theme, ...Object.fromEntries(Object.entries(q).filter(([, x]) => x != null).map(([k, x]) => [k, String(x)])) });
    await p.goto(`file:///fr/assets/card.html?${qs}`, { waitUntil: "networkidle0", timeout: 60000 });
    await p.waitForSelector("body[data-ready]", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 150));
    await p.screenshot({ path: `${OUT}/${name}.png` });
  }
  console.log("cards:", list.length);
  await b.close();
})();
