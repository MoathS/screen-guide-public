#!/bin/bash
# sheet.sh VIDEO OUT.png t1 t2 ...  -> a contact sheet (5 per row) of frames at those seconds.
# Look at it before composing (clips) and before delivering (final videos).
set -euo pipefail
FF="$("$(dirname "$0")/get-ffmpeg.sh")"; V=$1; OUT=$2; shift 2
T=$(mktemp -d); i=0
for t in "$@"; do "$FF" -loglevel error -y -ss "$t" -i "$V" -frames:v 1 -vf scale=480:-1 "$T/$(printf %02d $i).png" && i=$((i+1)); done
"$FF" -loglevel error -y -framerate 1 -i "$T/%02d.png" -vf "tile=5x$(( (i+4)/5 )):padding=4:color=white" -frames:v 1 "$OUT"
rm -rf "$T"
