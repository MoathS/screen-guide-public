# The compose spec (`$JOB/video.js`)

```js
module.exports = {
  layout: "landscape",            // or "portrait" (1080×1920, screen 960×1560 under a 320 px caption band)
  sound: "soft",                  // or "none"; a silent copy is always written too
  titleSeconds: 2.8, outroSeconds: 3.0,
  theme: {                        // take these from the site's CSS; all optional
    bg: "#F4F4F1",                // caption band / page background (also the dip between scenes)
    ink: "#1F2937", sub: "#6B7280", // caption title / subtitle colours
    dark: "#111827", light: "#F9FAFB", soft: "#D1D5DB", accent: "#F59E0B", // title cards; accent = badge, url chip
    ft: "IBM Plex Sans Arabic", fb: "IBM Plex Sans Arabic", // Google Fonts families (titles / body); e.g. "Amiri", "Inter"
    dir: "rtl",                   // optional: by default each card follows its text (Arabic/Hebrew -> rtl)
    logo: "logo.png",             // optional: path in the job folder or a URL, shown on title/outro cards
    icon: "none",                 // or "sprout" (a small built-in leaf mark)
  },
  outro: { t: "Site name", s: "subtitle", u: "example.com", q: "an optional quote line" },
  videos: {
    "1-login": {                  // folder name under out/
      title: { n: "Part 1", badge: "1", t: "Title", s: "Subtitle" }, // n: line above the title; badge: on every caption; omit title for none
      outro: { ... },             // optional per-video outro (else the shared one)
      coverAt: 1.2,               // seconds into the final video for cover.jpg
      segs: [
        {
          clip: "S1",             // clips/S1.marks.json (+ clips/S1.mp4, built if missing)
          speed: 1.1,             // playback speed of this clip
          from: 0.2, to: "end",   // clip seconds or mark expressions
          cut: [["details+0.1", "details+0.3"]], // ranges removed (still-loading image, long waits)
          caps: [                 // [when, title, subtitle]; when = seconds or a mark ("save", "save-0.2", "dash+1")
            [0, "First caption", "its subtitle"],
            ["save-0.2", "Next caption", "…"],
          ],
        },
      ],
    },
  },
};
```

Notes:
- Mark expressions refer to `s.mark()` names in that clip, plus `start` and `end`.
- A caption change fades the old line out (0.25 s), then the new one in (0.3 s).
  Put the change ~0.2 s before the action it describes.
- Taps (`_taps`) and keystrokes (`_keys`) in the marks file become effects
  automatically, only for the kept parts of the clip.
- Cards: `cards.js` renders `<id>-title`, `<id>-<seg>-<cap>`, `outro`, `bg0` into
  `cards/<layout>/`. Re-run it after editing captions; `compose.js <id>` rebuilds one video.
