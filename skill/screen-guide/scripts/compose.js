// compose.js JOB_DIR SPEC.js [videoId ...]   (on the host: node + ffmpeg)
// Builds JOB_DIR/out/<id>/{video.mp4, video-silent.mp4, cover.jpg} from clips, marks and cards.
// Per video: title card -> segments (clip on its caption track, inside the screen frame)
// -> outro card. Captions change by fading the old line out, then the new one in
// (a crossfade between two layouts reads as a muddy double exposure). Cuts dip
// through the theme's colours. Taps and typed characters logged during recording
// become soft effects; no music.
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");
const JOB = path.resolve(process.argv[2]);
const spec = require(path.resolve(JOB, process.argv[3]));
const only = process.argv.slice(4);
const FF = execFileSync(path.join(__dirname, "get-ffmpeg.sh")).toString().trim();
const CACHE = process.env.SG_CACHE || path.join(require("os").homedir(), ".cache", "screen-guide");
// -nostdin and a hard time limit (SIGKILL: a spinning filter graph ignores SIGTERM), so a
// stuck ffmpeg fails loudly instead of living on as an orphan at 100% CPU. The limit is
// per ffmpeg call, not per video: SG_FF_TIMEOUT minutes (default 120) - raise it for very
// long videos on slow machines.
const FF_TIMEOUT = (+process.env.SG_FF_TIMEOUT || 120) * 60000;
const ff = (...a) => execFileSync(FF, ["-nostdin", "-loglevel", "error", "-y", ...a], { stdio: ["ignore", "inherit", "inherit"], timeout: FF_TIMEOUT, killSignal: "SIGKILL" });
const dur = (f) => { let o = ""; try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { o = String(e.stderr); } const m = o.match(/Duration: (\d+):(\d+):([\d.]+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const land = (spec.layout || "landscape") !== "portrait";
const GEO = land ? { W: 1920, H: 1080, sw: 1600, sh: 900, x: 160, y: 160, r: 18 } : { W: 1080, H: 1920, sw: 960, sh: 1560, x: 60, y: 320, r: 44 };
const hex = (c, d) => "0x" + String(c || d).replace("#", "");
const DARK = hex(spec.theme?.dark, "#1E3826"), LIGHT = hex(spec.theme?.bg, "#F3EFE3");
const B = `${JOB}/build`, C = `${JOB}/cards/${land ? "landscape" : "portrait"}`, SFX = `${CACHE}/sfx`;
fs.mkdirSync(B, { recursive: true }); fs.mkdirSync(SFX, { recursive: true });
const enc = ["-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-r", "30"];
const MASK = `${B}/mask-${GEO.sw}x${GEO.sh}.png`;
if (!fs.existsSync(MASK)) {
  const hx = GEO.sw / 2 - 0.5, hy = GEO.sh / 2 - 0.5;
  ff("-f", "lavfi", "-i", `color=black:s=${GEO.sw}x${GEO.sh},format=gray`, "-vf", `geq=lum='if(lte(pow(max(abs(X-${hx})-${hx - GEO.r},0),2)+pow(max(abs(Y-${hy})-${hy - GEO.r},0),2),${GEO.r * GEO.r}),255,0)'`, "-frames:v", "1", MASK);
}
if (!fs.existsSync(`${SFX}/tap.wav`)) ff("-f", "lavfi", "-i", "aevalsrc='0.5*sin(2*PI*620*t)*exp(-38*t)+0.18*sin(2*PI*930*t)*exp(-50*t)':s=48000:d=0.25", "-af", "lowpass=f=2500", `${SFX}/tap.wav`);
if (!fs.existsSync(`${SFX}/tick.wav`)) ff("-f", "lavfi", "-i", "aevalsrc='0.35*sin(2*PI*1500*t)*exp(-140*t)':s=48000:d=0.06", "-af", "highpass=f=600,lowpass=f=4000", `${SFX}/tick.wav`);
if (!fs.existsSync(`${SFX}/air.wav`)) ff("-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:r=48000:a=0.5", "-af", "bandpass=f=900:width_type=o:w=1.6,afade=t=in:d=0.32:curve=qsin,afade=t=out:st=0.32:d=0.38:curve=qsin", `${SFX}/air.wav`);

const still = (png, d, out) => ff("-loop", "1", "-i", png, "-vf", `scale=${GEO.W * 2}:${GEO.H * 2},zoompan=z='1+0.03*on/(${d}*30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${GEO.W}x${GEO.H}:fps=30,format=yuv420p`, "-t", String(d), ...enc, out);
function track(cards, times, d, out) {
  const ins = ["-loop", "1", "-t", String(d), "-i", cards[0]]; let fc = "", last = "[0:v]", n = 1;
  for (let k = 1; k < cards.length; k++) {
    ins.push("-loop", "1", "-t", String(d), "-i", `${C}/bg0.png`, "-loop", "1", "-t", String(d), "-i", cards[k]);
    const t = Math.max(0.3, Math.min(d - 0.8, times[k]));
    fc += `${last}[${n}:v]xfade=transition=fade:duration=0.25:offset=${r3(t)}[x${n}];[x${n}][${n + 1}:v]xfade=transition=fade:duration=0.3:offset=${r3(t + 0.25)}[y${n}];`;
    last = `[y${n}]`; n += 2;
  }
  if (!fc) ff(...ins, "-vf", "fps=30", ...enc, out); else ff(...ins, "-filter_complex", `${fc}${last}fps=30[o]`, "-map", "[o]", ...enc, out);
}

for (const [id, v] of Object.entries(spec.videos)) {
  if (only.length && !only.includes(id)) continue;
  const TITLE = v.titleSeconds ?? spec.titleSeconds ?? 2.8, OUTRO = v.outroSeconds ?? spec.outroSeconds ?? 3.0;
  const parts = [], ev = []; let at = 0;
  if (v.title) { still(`${C}/${id}-title.png`, TITLE, `${B}/${id}-t.mp4`); parts.push({ f: `${B}/${id}-t.mp4`, d: TITLE, card: true }); at = TITLE; }
  v.segs.forEach((sg, i) => {
    const marks = JSON.parse(fs.readFileSync(`${JOB}/clips/${sg.clip}.marks.json`, "utf8"));
    // Build the clip from its frames when it is missing or older than the recording.
    const mp4 = `${JOB}/clips/${sg.clip}.mp4`, lst = `${JOB}/clips/${sg.clip}/list.txt`;
    if (!fs.existsSync(mp4) || (fs.existsSync(lst) && fs.statSync(lst).mtimeMs > fs.statSync(mp4).mtimeMs)) execFileSync(path.join(__dirname, "clip.sh"), [JOB, sg.clip], { stdio: "ignore" });
    const T = (x) => { if (typeof x === "number") return x; const m = String(x).match(/^([\w]+)([+-][\d.]+)?$/); if (!(m[1] in marks)) throw new Error(`${id}: no mark "${m[1]}" in ${sg.clip}`); return marks[m[1]] + (m[2] ? +m[2] : 0); };
    const speed = sg.speed ?? 1, from = sg.from ?? 0.2, to = sg.to == null || sg.to === "end" ? marks.end - 0.05 : T(sg.to);
    const cuts = (sg.cut || []).map(([a, b]) => [T(a), T(b)]); // ranges removed (a still photo loading, a long wait)
    const keep = []; let s0 = from; for (const [a, b] of cuts.sort((x, y) => x[0] - y[0])) { keep.push([s0, a]); s0 = b; } keep.push([s0, to]);
    const local = (t) => { let acc = 0; for (const [a, b] of keep) { if (t <= b) return (acc + Math.max(0, t - a)) / speed; acc += b - a; } return acc / speed; };
    const inKeep = (t) => keep.some(([a, b]) => t >= a && t <= b);
    const cut = `${B}/${id}-${i}-cut.mp4`;
    const fc = keep.map(([a, b], k) => `[0:v]trim=${r3(a)}:${r3(b)},setpts=PTS-STARTPTS[k${k}]`).join(";") + `;${keep.map((_, k) => `[k${k}]`).join("")}concat=n=${keep.length}:v=1,setpts=PTS/${speed},fps=30[v]`;
    ff("-i", `${JOB}/clips/${sg.clip}.mp4`, "-filter_complex", fc, "-map", "[v]", ...enc, cut);
    const d = dur(cut);
    track(sg.caps.map((_, j) => `${C}/${id}-${i}-${j}.png`), sg.caps.map((c) => local(T(c[0]))), d, `${B}/${id}-${i}-bg.mp4`);
    ff("-i", cut, "-i", `${B}/${id}-${i}-bg.mp4`, "-loop", "1", "-i", MASK, "-filter_complex", `[0:v]format=rgba[c];[2:v]format=gray[m];[c][m]alphamerge[r];[1:v][r]overlay=${GEO.x}:${GEO.y}:shortest=1,format=yuv420p`, "-t", String(d), ...enc, `${B}/${id}-${i}.mp4`);
    parts.push({ f: `${B}/${id}-${i}.mp4`, d });
    if (at > 0) ev.push(["air", at - 0.2, 0.4]);
    for (const t of marks._taps || []) if (inKeep(t)) ev.push(["tap", at + local(t) + 0.04, 0.65]);
    for (const t of marks._keys || []) if (inKeep(t)) ev.push(["tick", at + local(t), 0.4]);
    at += d;
  });
  const outro = fs.existsSync(`${C}/${id}-outro.png`) ? `${C}/${id}-outro.png` : `${C}/outro.png`;
  if (spec.outro || v.outro) { still(outro, OUTRO, `${B}/${id}-o.mp4`); ev.push(["air", at - 0.2, 0.4]); parts.push({ f: `${B}/${id}-o.mp4`, d: OUTRO, card: true }); at += OUTRO; }
  const faded = parts.map((pt, k) => {
    const prev = parts[k - 1], next = parts[k + 1], f = [];
    if (prev) f.push(`fade=t=in:st=0:d=0.35:color=${pt.card || prev.card ? DARK : LIGHT}`);
    if (next) f.push(`fade=t=out:st=${r3(pt.d - 0.35)}:d=0.35:color=${pt.card || next.card ? DARK : LIGHT}`);
    if (!f.length) return pt.f;
    const o = pt.f.replace(".mp4", "-d.mp4"); ff("-i", pt.f, "-vf", f.join(","), ...enc, o); return o;
  });
  const video = `${B}/${id}.mp4`;
  ff(...faded.flatMap((f) => ["-i", f]), "-filter_complex", `${faded.map((_, k) => `[${k}]`).join("")}concat=n=${faded.length}:v=1,format=yuv420p[v]`, "-map", "[v]", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-r", "30", video);
  const o = `${JOB}/out/${id}`; fs.mkdirSync(o, { recursive: true });
  ff("-ss", String(v.coverAt ?? 1.2), "-i", video, "-frames:v", "1", "-q:v", "2", `${o}/cover.jpg`);
  ff("-i", video, "-c:v", "copy", "-an", "-movflags", "+faststart", `${o}/video-silent.mp4`);
  if ((spec.sound ?? "soft") !== "none" && ev.length) {
    const wav = `${B}/${id}.wav`;
    // A silent bed of exactly the video's length is input 0 and sets the duration
    // (duration=first). An apad+atrim tail instead can spin forever in some ffmpeg builds.
    const afc = ev.map(([, t, vol], k) => { const ms = Math.max(0, Math.round(t * 1000)); return `[${k + 1}:a]adelay=${ms}|${ms},volume=${vol},aformat=channel_layouts=stereo:sample_rates=48000[e${k}]`; }).join(";");
    ff("-f", "lavfi", "-t", String(r3(at)), "-i", "anullsrc=r=48000:cl=stereo", ...ev.flatMap(([f]) => ["-i", `${SFX}/${f}.wav`]), "-filter_complex", `${afc};[0:a]${ev.map((_, k) => `[e${k}]`).join("")}amix=inputs=${ev.length + 1}:duration=first:normalize=0:dropout_transition=0,aecho=0.6:0.5:60:0.12,alimiter=limit=0.8[a]`, "-map", "[a]", "-ar", "48000", wav);
    ff("-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", `${o}/video.mp4`);
  } else fs.copyFileSync(`${o}/video-silent.mp4`, `${o}/video.mp4`);
  console.log(`${id}: ${r3(at)} s -> ${o}`);
}
