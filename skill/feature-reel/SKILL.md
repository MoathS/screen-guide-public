---
name: feature-reel
description: Turn a web app into polished videos recorded from the real, live site - feature showcases that present what a site offers, plus walkthroughs, how-tos and training - at any length, landscape 1920×1080 or vertical 1080×1920. Drives the site in a headless browser for smooth 30 fps at full resolution, with visible taps, captions in the site's own fonts and colours (Arabic/RTL and LTR), soft UI sound effects instead of music, automatic blurring of phone numbers and one-time codes, and a read-only guard for visits. Use this whenever the user wants to show off or present features of their site or app, a feature reel, product demo, showcase, tutorial, walkthrough, screen recording, onboarding or training video, admin guide, «عرض مزايا الموقع» / «شرح» / «دليل» / a video showing how something works - or wants an earlier one re-recorded after a UI change - even if they don't say "screen recording". Prefer it over promo/launch-video skills whenever the video must show the real UI in use or run longer than ~25 seconds.
---

# feature-reel

Turn "show what this site offers" or "show how X works" into finished videos recorded
from the real app: feature showcases, walkthroughs and training. The heavy
lifting is in `scripts/`. Write a short clip script per scene, record it, check its
frames, write one spec, and compose. Read `references/gotchas.md` before the first
recording in a session, because every item in it broke a real recording once.

Reply in the user's language. Captions go in the language the video is for.

## 1. Agree the brief (one short message, then go)

There is no length limit - a video is as long as its scenes. Never trim a walkthrough to
fit a promo-style 20-30 s; cut waiting and repetition, not steps the viewer needs.

Settle only what changes the output, and use the defaults for the rest:

| Question | Default |
|---|---|
| Audience and where it will be watched | phones/social → `portrait`; training/desktop → `landscape` |
| One video or a series | *suggest* splitting long material into parts, one task each (easier to follow and to re-record) - but it is the user's call: if they want one long video, make one long video |
| Sound | soft effects only (taps, typing, a breath at cuts); a silent copy is always delivered too |
| Voice | none; on-screen captions carry the story. Suggest the user records a voiceover later if wanted |
| Data shown | see Privacy below; decide this before recording, not after |

**Checkpoint before recording: size and disk space.** As soon as the brief and the
scene plan give each video a length, and before anything is recorded or composed:
1. Run `node $FR/estimate.js <landscape|portrait> <calm|busy> <seconds per video…> --dir "$JOB"`
   (`busy` = scrolling, animation or dense drawings on screen; rates are measured, not guessed).
2. Tell the requester, in their language: the expected size of each delivered file, the
   temporary working space, the free space where the job is saved, and the recording time.
3. Act on its verdict. **OK**: go on. **TIGHT**: say so, and clear `clips/` and `build/`
   as each video is approved. **NOT ENOUGH SPACE** (exit status 2): do not start. Offer
   shorter or split videos, recording in parts with clean-ups in between, another folder,
   or freeing space, and wait for the user's choice.
Re-run it if the plan grows. A full disk mid-recording loses the clip and can disturb
other services sharing that disk.

**Privacy, decided up front.** Treat every frame as publishable.
- Never record systems the user describes as confidential (customer, financial, health or employer data). Say why.
- Phone numbers, one-time codes, 2FA secrets, recovery codes, login links/tokens and real people's emails must never be visible. `lib.js` blurs phone and one-time-code inputs, `otpauth:` links, `.fr-blur`/`[data-fr-blur]` elements and any run of 7+ digits by default. Add the app's own secret elements with the `blur:` option.
- Real people's names: ask whether real data is fine or a staging/fictional copy should be used. A list that opens on unrelated people can stay hidden until a search runs (`s.css(...)`, then `s.uncss()`).

**Where to record.**
- **Read-only visits:** the live site or staging with `guard: true`, which aborts every non-GET request so nothing gets submitted.
- **Flows that write** (admin add/edit/delete, approvals): a staging/test environment only. Get the user's OK, use obviously fake names, and plan the clean-up (delete what you add, revert flags) as part of the storyboard.
- **Pages that need a backend you can't use:** run the app locally and answer the one request with `respond:` (e.g. a "send login link" call), or serve a fictional fixture.
- **Bot checks** (Cloudflare Turnstile, reCAPTCHA) cannot be passed headless, by design. Ask the user to submit that one form themselves, then record the rest.

## 2. Plan scenes

Write a storyboard in the job folder before scripting. For each video, list the
steps, the caption for each beat, and what must be cleaned up afterwards.
- Show the product doing the job (search → pick → result), not menus being read.
- Give each caption one idea: a 2–5 word title plus one subtitle line, changing at recorded moments.
- Keep each scene to one page flow, and cut between scenes rather than navigating at length.
- Take colours and fonts from the site's CSS, so the cards look like part of the product.

## 3. Set up a job

```
JOB=~/feature-reel-jobs/<topic>-<YYYY-MM-DD>   # anywhere outside a git repo
mkdir -p "$JOB/scripts"
FR=<this skill folder>/scripts                 # e.g. ~/.claude/skills/feature-reel/scripts
```
- `run.sh` runs a script in a throwaway puppeteer container (`docker run --rm`), with this skill at `/fr` and the job at `/work`.
- Host networking is the default. On Docker Desktop, set `FR_NETWORK=bridge` and use `host.docker.internal` instead of `127.0.0.1`.
- Pass secrets by **name**: `export GATE_PW=...; FR_ENV="GATE_PW" $FR/run.sh ...`. Read them from files with `$(cat file)` so they never appear in output, and never write them into the job's scripts.

## 4. Record one clip per scene

```js
// $JOB/scripts/A.js
const fr = require("/fr/scripts/lib");
fr.record("A", { url: "https://example.com/", layout: "portrait", guard: true }, async (s) => {
  await s.wait(1000);
  await s.tap("#search", { mark: "search" });   // ripple + click, logged for effects
  await s.type("#search", "blue shoes");        // React-safe typing; each key logged
  await s.wait(1200);
  s.mark("pick"); await s.tap(".result");
  await s.wait(2500);                            // page time: the page runs 3x slower while recorded
});
```
```
$FR/run.sh "$JOB" scripts/A.js        # frames + clips/A.marks.json
$FR/clip.sh "$JOB" A                  # clips/A.mp4 (on the host)
$FR/sheet.sh "$JOB/clips/A.mp4" /tmp/A.png 0.5 2 4 6 8 10   # then look at the PNG
```
The API is documented at the top of `lib.js`; read it once.
- **Actions:** `tap`, `tapGo`, `type`, `scroll`, `go`, `at`, `settled`, `css`/`uncss`, `mark`, `webauthnOff`.
- **Options:** `guard`, `block`, `respond`, `basicAuth`, `headers`, `profile`, `hide`, `blur`, `webauthn`, `userAgent`, `tapColor`.

| Layout | Viewport | Screen area | Best for |
|---|---|---|---|
| `portrait` | 432×702 | 960×1560 | phone screens |
| `landscape` | 1024×576 | 1600×900 | desktop layout, large text |
| `landscape-wide` | 1280×720 | 1600×900 | wider desktop pages |
| `landscape-zoom` | 800×450 | 1600×900 | small centred pages such as a login card |

**Look at every clip before composing.** Check for:
- the right page;
- nothing private in view;
- the action actually happened (a save that failed silently still records fine);
- no blank stretches;
- text that is readable.

Re-record rather than hoping composition hides a problem.

**Logged-in flows:** sign in once inside a clip that uses a persistent `profile: "name"`. Later clips that pass the same profile start signed in. Delete `$JOB/profiles/` when finished, because it holds live sessions.

## 5. Compose

Write one spec per job, `$JOB/video.js`. Every field is in `references/spec.md`.
```js
module.exports = {
  layout: "landscape",
  theme: { bg: "#F4F4F1", ink: "#1F2937", accent: "#F59E0B", dark: "#111827", ft: "Inter", fb: "Inter" },
  outro: { t: "Acme Store", s: "Admin guide", u: "acme.example" },
  videos: {
    "1-search": {
      title: { n: "Part 1", badge: "1", t: "Finding a product", s: "Search, filter, open" },
      segs: [{ clip: "A", speed: 1.1, caps: [[0, "Search", "type a few letters"], ["pick-0.2", "Open it", "the product page"]] }],
    },
  },
};
```
```
$FR/run.sh "$JOB" /fr/scripts/cards.js video.js   # cards in the theme (container)
node "$FR/compose.js" "$JOB" video.js [videoId…]  # host: node + ffmpeg
```
Each video ends up in `out/<id>/`: `video.mp4`, `video-silent.mp4` and `cover.jpg`.

## 6. Verify, deliver, clean up

- Contact-sheet every final video with `sheet.sh` on `out/<id>/video.mp4`. Include mid-transition moments, and fix overlapping text, blank screens and wrong captions.
- Deliver each video in its own folder with a short `plan.md` beside it: the scenes, the data used, and anything changed on staging. Use a file-sending tool if one is available; otherwise give the path.
- Clean up:
  - undo or delete test data and remove test accounts you created;
  - delete `$JOB/profiles/`;
  - stop any local dev server you started.
- Report the job folder's size. `clips/` and `build/` can go once the user approves the videos; ask before removing anything.
