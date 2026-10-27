#!/bin/bash
# Prints the path of an ffmpeg binary: $FR_FFMPEG, else ffmpeg on PATH, else (Linux)
# a static build downloaded once into $FR_CACHE (default ~/.cache/feature-reel).
set -euo pipefail
if [ -n "${FR_FFMPEG:-}" ]; then echo "$FR_FFMPEG"; exit 0; fi
if command -v ffmpeg >/dev/null 2>&1; then command -v ffmpeg; exit 0; fi
CACHE="${FR_CACHE:-$HOME/.cache/feature-reel}"
if [ ! -x "$CACHE/ffmpeg" ]; then
  [ "$(uname -s)" = "Linux" ] || { echo "feature-reel: install ffmpeg (e.g. brew install ffmpeg) or set FR_FFMPEG" >&2; exit 1; }
  case "$(uname -m)" in x86_64) A=amd64 ;; aarch64|arm64) A=arm64 ;; *) echo "feature-reel: unsupported CPU $(uname -m); set FR_FFMPEG" >&2; exit 1 ;; esac
  mkdir -p "$CACHE/dl"
  curl -sSL -o "$CACHE/dl/ff.tar.xz" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$A-static.tar.xz"
  tar -xf "$CACHE/dl/ff.tar.xz" -C "$CACHE/dl"
  cp "$CACHE"/dl/ffmpeg-*-static/ffmpeg "$CACHE/ffmpeg"
  rm -rf "$CACHE/dl"
fi
echo "$CACHE/ffmpeg"
