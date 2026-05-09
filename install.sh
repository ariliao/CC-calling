#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.cc-calling"
REPO="https://github.com/ariliao/cc-calling.git"

# ─── Check Node.js ────────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required (https://nodejs.org)" >&2
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 16 ]; then
  echo "Error: Node.js 16 or higher is required (found $(node --version))" >&2
  exit 1
fi

# ─── Clone or update ──────────────────────────────────────────────────────────

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "→ Updating existing install at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "→ Cloning CC Calling to $INSTALL_DIR"
  git clone "$REPO" "$INSTALL_DIR"
fi

# ─── Install globally (generates sounds + registers hooks via postinstall) ────

echo "→ Installing"
npm install -g "$INSTALL_DIR"

echo ""
echo "✓ Done. Restart Claude Code to activate."
echo ""
echo "  Volume control:"
echo "    cc-calling loud | quiet | mute | default"
