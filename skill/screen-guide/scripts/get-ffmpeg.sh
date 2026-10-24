#!/bin/bash
# Prints the path of an ffmpeg binary: $SG_FFMPEG, else ffmpeg on PATH, else (Linux)
# a static build downloaded once into $SG_CACHE (default ~/.cache/screen-guide).
set -euo pipefail
if [ -n "${SG_FFMPEG:-}" ]; then echo "$SG_FFMPEG"; exit 0; fi
if command -v ffmpeg >/dev/null 2>&1; then command -v ffmpeg; exit 0; fi
CACHE="${SG_CACHE:-$HOME/.cache/screen-guide}"
if [ ! -x "$CACHE/ffmpeg" ]; then
  [ "$(uname -s)" = "Linux" ] || { echo "screen-guide: install ffmpeg (e.g. brew install ffmpeg) or set SG_FFMPEG" >&2; exit 1; }
  case "$(uname -m)" in x86_64) A=amd64 ;; aarch64|arm64) A=arm64 ;; *) echo "screen-guide: unsupported CPU $(uname -m); set SG_FFMPEG" >&2; exit 1 ;; esac
  mkdir -p "$CACHE/dl"
  curl -sSL -o "$CACHE/dl/ff.tar.xz" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$A-static.tar.xz"
  tar -xf "$CACHE/dl/ff.tar.xz" -C "$CACHE/dl"
  cp "$CACHE"/dl/ffmpeg-*-static/ffmpeg "$CACHE/ffmpeg"
  rm -rf "$CACHE/dl"
fi
echo "$CACHE/ffmpeg"
