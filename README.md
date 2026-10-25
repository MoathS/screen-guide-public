# screen-guide

**Record real walkthrough and training videos of any web app, with Claude Code.**

Ask Claude for something like *"make a video showing how an admin approves a request"* or «سوّ مقطع يشرح طريقة البحث». The skill drives your live site in a headless browser and records it at full resolution. It then composes finished videos:

- smooth 30 fps;
- visible taps;
- captions in your site's own fonts and colours, with Arabic/RTL support;
- soft UI sound effects;
- a silent copy and a cover image.

There is no length limit, so it suits how-to series, onboarding and admin guides, not just 20-second promos. Long videos simply take longer: recording runs at about a third of real time (a 1-minute scene takes ~3-4 minutes to capture), and frames need disk space (roughly 5-10 MB per recorded second until you clear `clips/`).

## Features

- **Real UI, smooth motion.** The page runs 3× slower while full-DPR screenshots are captured, then time is restored. You get fluid 30 fps that a live screencast cannot give (those come out small and at about 14 fps).
- **Captions that match your product.** Title, caption and outro cards render in your theme colours and Google Fonts. Text direction follows the text, so RTL is handled. Caption changes are tied to recorded moments, not guessed seconds.
- **Two layouts.** Landscape 1920×1080 places the screen under a caption bar. Vertical 1080×1920 places it inside a phone frame under a caption band.
- **Privacy by default.**
  - Phone and one-time-code inputs, `otpauth:` links and any 7+ digit run are blurred inside the page, so blurred pixels are what gets recorded. Add your own selectors on top.
  - `guard: true` makes a visit read-only.
  - Secrets are passed into the container by variable name and are never written to disk.
- **Sound without music.** Each tap and keystroke is logged during recording and becomes a soft effect. There is a gentle "breath" at cuts, and a silent copy is always included.
- **No installs.** Recording runs in the stock `ghcr.io/puppeteer/puppeteer` image as a throwaway container. Composition uses ffmpeg on the host (a static build is fetched automatically on Linux).

## Requirements

- [Claude Code](https://code.claude.com) (or any agent that loads `SKILL.md` skills)
- Docker
- Node.js 18+ on the host
- ffmpeg (on PATH, or `SG_FFMPEG=/path/to/ffmpeg`; fetched automatically on Linux x86_64/arm64)
- Internet access for the cards' Google Fonts

## Install

```bash
git clone <repo-url> screen-guide
./screen-guide/install.sh            # for all projects: ~/.claude/skills/screen-guide
./screen-guide/install.sh ~/my-app   # or for one project: ~/my-app/.claude/skills/screen-guide
```

Restart Claude Code. The skill triggers on requests for walkthroughs, tutorials, demos, admin guides, «شرح», «دليل» and similar.

## How it works

```
clip scripts (one per scene) --run.sh--> frames + marks   (puppeteer container)
                              --clip.sh--> clips/*.mp4     (host ffmpeg)
video.js spec --cards.js--> cards/*.png                    (container)
              --compose.js--> out/<id>/video.mp4, video-silent.mp4, cover.jpg
```

A clip script is a few lines:

```js
const sg = require("/sg/scripts/lib");
sg.record("A", { url: "https://example.com/", layout: "portrait", guard: true }, async (s) => {
  await s.tap("input[type=search]", { mark: "search" });
  await s.type("input[type=search]", "blue shoes");
  await s.tap(".result", { mark: "pick" });
  await s.wait(2500);
});
```

See [`examples/`](examples) for a full vertical example and a logged-in landscape one:

- `SKILL.md` describes the workflow Claude follows: brief, storyboard, record, check, compose, verify, clean up.
- `references/spec.md` covers every compose option.
- `references/gotchas.md` lists the pitfalls this was built around (queued screenshots, smooth-scroll and timer slowing, React inputs, auth gates, bot checks…).

## Running it by hand

```bash
SG=~/.claude/skills/screen-guide/scripts; JOB=~/screen-guide-jobs/demo; mkdir -p $JOB/scripts
cp examples/clip.example.js $JOB/scripts/A.js; cp examples/video.example.js $JOB/video.js   # edit both
$SG/run.sh $JOB scripts/A.js && $SG/clip.sh $JOB A
$SG/sheet.sh $JOB/clips/A.mp4 /tmp/A.png 1 3 5 7       # check the frames
$SG/run.sh $JOB /sg/scripts/cards.js video.js
node $SG/compose.js $JOB video.js                       # -> $JOB/out/search-product/
```

On Docker Desktop (macOS/Windows), set `SG_NETWORK=bridge` and use `host.docker.internal` for apps running on your machine.

## Responsible use

Record only sites you are allowed to record. Use staging for anything that writes data. Check every frame before you publish: automatic blurring is a safety net, not a guarantee.

## License

MIT. See [LICENSE](LICENSE).
