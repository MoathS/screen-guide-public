// estimate.js LAYOUT MOTION SECONDS [SECONDS ...] [--dir JOB_DIR]
//   LAYOUT  landscape | portrait
//   MOTION  calm (forms, lists, settings) | busy (scrolling, animation, dense drawings, video)
//   SECONDS planned length of each video, captions and title/outro cards included
//   --dir   the job folder (or where it will be): also checks its free disk space and
//           exits with status 2 when the job would not fit comfortably
// Prints, before anything is recorded: the delivered file sizes, the job's working disk,
// and roughly how long recording takes. The rates were measured on twelve real videos
// (October 2026): H.264 CRF 17, 30 fps, AAC 160 kb/s, with title and outro cards.
const argv = process.argv.slice(2);
const di = argv.indexOf("--dir"), dir = di >= 0 ? argv.splice(di, 2)[1] : null;
const [layout = "landscape", motion = "calm", ...rest] = argv;
const secs = rest.map(Number).filter((x) => x > 0);
if (!secs.length || !["landscape", "portrait"].includes(layout) || !["calm", "busy"].includes(motion)) {
  console.error("usage: node estimate.js landscape|portrait calm|busy SECONDS [SECONDS ...]"); process.exit(1);
}
// MB per minute of finished video, [low, high]; audio included.
const RATE = { landscape: { calm: [3, 6], busy: [10, 15] }, portrait: { calm: [6, 11], busy: [14, 19] } }[layout][motion];
const CARDS = 6;        // title + outro seconds per video, not recorded
const FRAMES = [4, 7];  // MB of frames per recorded second (job folder, until clips/ is cleared)
const BUILD = 2.5;      // intermediates in build/, as a multiple of the delivered size
const fs = require("fs");
const mb = (x) => (x >= 1024 ? `${(x / 1024).toFixed(1)} GB` : `${Math.round(x)} MB`);
const range = ([a, b]) => (Math.round(a) === Math.round(b) ? mb(a) : `${mb(a)}–${mb(b)}`);
let tot = [0, 0], rec = 0;
secs.forEach((s, i) => {
  const size = RATE.map((r) => (r * s) / 60);
  tot = tot.map((t, k) => t + size[k]); rec += Math.max(0, s - CARDS);
  console.log(`video ${i + 1}: ${s} s -> ${range(size)} (video.mp4; video-silent.mp4 about the same)`);
});
const work = FRAMES.map((f, k) => f * rec + tot[k] * BUILD);
console.log(`all videos: ${range(tot)} delivered, x2 with the silent copies`);
console.log(`working disk while making them: ~${range(work)} (frames + build), freed when clips/ and build/ are cleared`);
console.log(`recording time: ~${Math.ceil((rec * 3.5 + secs.length * 60) / 60)} min of capture (pages run 3x slower), plus a few minutes of composing`);
if (dir) {
  // Walk up to an existing folder: the job folder may not exist yet.
  let p = require("path").resolve(dir); while (!fs.existsSync(p)) p = require("path").dirname(p);
  const st = fs.statfsSync(p), free = (st.bavail * st.bsize) / 1048576;
  const need = work[1] + tot[1] * 2; // worst case: frames + build + both delivered copies
  console.log(`free space at ${p}: ${mb(free)}; this job needs up to ${mb(need)}`);
  if (need > free * 0.8) { console.log("NOT ENOUGH SPACE: do not start. Shorten or split the videos, record in parts and clear clips/ and build/ between them, use another folder, or free space first."); process.exitCode = 2; }
  else if (need > free * 0.5) console.log("TIGHT: it fits, but tell the user and clear clips/ and build/ as soon as each video is approved.");
  else console.log("OK: enough space.");
}
