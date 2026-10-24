#!/bin/bash
# clip.sh JOB_DIR NAME  -> JOB_DIR/clips/NAME.mp4 from the recorded frames (30 fps).
# Run it after each recording to check the clip (sheet.sh); compose.js also calls it.
set -euo pipefail
FF="$("$(dirname "$0")/get-ffmpeg.sh")"
D="$1/clips/$2"
[ -f "$D/list.txt" ] || { echo "no recording at $D" >&2; exit 1; }
"$FF" -loglevel error -y -f concat -safe 0 -i "$D/list.txt" -vf "fps=30,format=yuv420p" -c:v libx264 -crf 14 "$1/clips/$2.mp4"
echo "$1/clips/$2.mp4"
