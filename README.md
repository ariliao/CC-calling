# CC Calling

> **Sound notifications and audio alerts for [Claude Code](https://claude.ai/code).**
> Hear when your AI finishes, fails, or needs you — without staring at the screen.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)
![Claude Code](https://img.shields.io/badge/Claude%20Code-%3E%3D2.0-blueviolet)
![License](https://img.shields.io/github/license/ariliao/cc-calling)

---
              
Stop staring at your screen.

Give Claude Code a command, put it in the background, and go do something that actually matters — grab a coffee, take a walk, work on something else. When Claude finishes, hits an error, or needs your input, it calls out. You come back, check the task, and carry on. That's it.

No more anxiously watching a cursor blink. No more refreshing the terminal to see if it's done. CC Calling gives Claude Code a full set of expressive chiptune sounds — a victory fanfare when your task completes, a gentle chime when a new one begins, a comedic trombone groan when something breaks — so you can **trust your ears instead of your eyes**.

**No audio files shipped.** Every sound is synthesized at install time from pure JavaScript — sine waves, ADSR envelopes, bell partials — so the repo stays tiny and every frequency is yours to tweak.
---

## Features

- **9 distinct audio notifications** mapped to Claude Code events — task complete, error, file saved, permission request, context compression, and more
- **Zero dependencies** — sounds are generated in pure JS, no native modules, no npm install
- **Non-blocking** — the hook script exits immediately and never slows Claude Code down
- **Fully customizable** — every sound is a plain JavaScript function, edit frequencies and envelopes freely
- **Cross-platform** — macOS (`afplay`), Linux (`paplay`), Windows (PowerShell)
- **Tiny footprint** — ~10 KB of JavaScript, WAV files synthesized locally

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/ariliao/cc-calling/main/install.sh | bash
```

This will:
1. Clone the repo to `~/.cc-calling`
2. Synthesize all sound files locally (pure JS, nothing downloaded)
3. Register the audio hooks in `~/.claude/settings.json`

Then **restart Claude Code** — that's it.

> **Requires:** Node.js ≥ 16, Claude Code ≥ 2.0, macOS / Linux / Windows

---

## Sound notifications

Nine sounds, each mapped to a moment that matters:

| Sound | Trigger | Character |
|---|---|---|
| `complete.wav` | Conversation finished | Victory fanfare — C→E→G→C arpeggio with chord shimmer |
| `start.wav` | New task begins | Warm two-note pickup — G4→C5 |
| `subtask.wav` | Subagent / subtask done | Checkpoint ping — crisp E5→G5 |
| `step.wav` | Tool ran successfully | Soft key-click — quiet 900 Hz pluck |
| `enter.wav` | File written or edited | Satisfying save click — bright C6 tap |
| `notification.wav` | Claude needs your attention | Curious wobble chime — rising tone with vibrato |
| `permission.wav` | Claude about to run Bash / Agent / web | "May I?" — C4 then F#4 bell |
| `idle.wav` | Context compression in progress | Heartbeat — slow low lub-DUB pulse |
| `error.wav` | Command failed | Cartoon trombone — three-part wah-wah-waaah |

---

## How it works

CC Calling hooks into [Claude Code's hook system](https://docs.anthropic.com/en/docs/claude-code/hooks). A small Node.js script receives each hook event on stdin, picks the matching audio file, and plays it non-blocking so Claude Code never waits.

```
Claude Code event → hook fires → hook.js reads stdin JSON → plays sound
```

| Claude Code hook event | Audio notification |
|---|---|
| `Stop` | `complete.wav` |
| `SubagentStop` | `subtask.wav` |
| `Notification` | `notification.wav` |
| `PreCompact` | `idle.wav` |
| `PreToolUse` — first call of a new task | `start.wav` |
| `PreToolUse` — Bash / Agent / WebSearch / WebFetch | `permission.wav` |
| `PostToolUse` success — Edit / Write | `enter.wav` |
| `PostToolUse` success — other tools | `step.wav` |
| `PostToolUse` failure | `error.wav` |

---

## Manual install

```bash
git clone https://github.com/ariliao/cc-calling.git ~/.cc-calling
cd ~/.cc-calling
node src/generate-sounds.js   # synthesize WAV files
node src/install.js           # register hooks in ~/.claude/settings.json
```

Restart `claude`.

---

## Uninstall

```bash
node ~/.cc-calling/src/install.js --uninstall
```

Cleanly removes CC Calling from `~/.claude/settings.json` without touching anything else.

---

## Customize sounds

All sounds are plain functions in `src/generate-sounds.js` — frequencies, durations, envelopes, all exposed. Edit and rebuild:

```bash
node src/generate-sounds.js
```

No restart needed. The hook picks up new WAV files immediately on the next call.

---

## Note on hook scope

Claude Code hooks fire at the agent level, not inside the terminal UI. Keyboard shortcuts, menu navigation, and slash commands happen before any hook can fire — those events aren't reachable from this system.

---

*Inspired by the sound palette of ICQ — the original messenger that made your computer feel like it was alive.*
