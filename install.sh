#!/bin/bash
# Installs the screen-guide skill for Claude Code.
#   ./install.sh              -> ~/.claude/skills/screen-guide (all projects)
#   ./install.sh PROJECT_DIR  -> PROJECT_DIR/.claude/skills/screen-guide (that project only)
# The skill is linked, not copied, so `git pull` in this clone updates it.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/skill/screen-guide" && pwd)"
BASE="${1:-$HOME}"; DEST="$BASE/.claude/skills/screen-guide"
mkdir -p "$BASE/.claude/skills"
if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then echo "refusing: $DEST exists and is not a link - move it aside first" >&2; exit 1; fi
ln -sfn "$SRC" "$DEST"
chmod +x "$SRC"/scripts/*.sh
echo "installed: $DEST -> $SRC"
command -v docker >/dev/null || echo "note: Docker is required (the recorder runs in ghcr.io/puppeteer/puppeteer)"
command -v node >/dev/null || echo "note: Node.js 18+ is required on the host (compose.js)"
