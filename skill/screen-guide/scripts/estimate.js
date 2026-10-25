// estimate.js LAYOUT MOTION SECONDS [SECONDS ...]
//   LAYOUT  landscape | portrait
//   MOTION  calm (forms, lists, settings) | busy (scrolling, animation, dense drawings, video)
//   SECONDS planned length of each video, captions and title/outro cards included
// Prints, before anything is recorded: the delivered file sizes, the job's working disk,
// and roughly how long recording takes. The rates were measured on twelve real videos
// (October 2026): H.264 CRF 17, 30 fps, AAC 160 kb/s, with title and outro cards.
const [layout = "landscape", motion = "calm", ...rest] = process.argv.slice(2);
const secs = rest.map(Number).filter((x) => x > 0);
if (!secs.length || !["landscape", "portrait"].includes(layout) || !["calm", "busy"].includes(motion)) {
  console.error("usage: node estimate.js landscape|portrait calm|busy SECONDS [SECONDS ...]"); process.exit(1);
}
// MB per minute of finished video, [low, high]; audio included.
const RATE = { landscape: { calm: [3, 6], busy: [10, 15] }, portrait: { calm: [6, 11], busy: [14, 19] } }[layout][motion];
const CARDS = 6;        // title + outro seconds per video, not recorded
const FRAMES = [4, 7];  // MB of frames per recorded second (job folder, until clips/ is cleared)
const BUILD = 2.5;      // intermediates in build/, as a multiple of the delivered size
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
