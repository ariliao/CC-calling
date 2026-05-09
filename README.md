# CC Calling

**Sound notifications for [Claude Code](https://claude.ai/code). Hear what's happening — without watching.**

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)
![Claude Code](https://img.shields.io/badge/Claude%20Code-%3E%3D2.1-blueviolet)
![License](https://img.shields.io/github/license/ariliao/cc-calling)

---

You gave Claude a task. Now you're watching the cursor.

Every few seconds you glance over to see if it's done. You alt-tab back. Still running. You check again. It finished two minutes ago and you missed it. Or worse — it hit an error and has been waiting for you the whole time.

**CC Calling fixes this.** It gives Claude Code a voice: a chime when you press Enter, a fanfare when your task completes, a trombone groan when something breaks. You stop watching. Claude calls when it's ready. You come back, and carry on.

Install once, then forget it's there.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/ariliao/cc-calling/main/install.sh | bash
```

Restart Claude Code. The `cc-calling` command is now available globally.

> Requires Node.js ≥ 16 and Claude Code ≥ 2.1 on macOS, Linux, or Windows.

---

## What you'll hear

| Moment | Sound | Feel |
|---|---|---|
| You press Enter | `start.wav` | Warm two-note pickup — *let's go* |
| Task complete | `complete.wav` | Victory fanfare — C→E→G→C with chord shimmer |
| Subagent spawned | `task.wav` | Crisp three-note burst — something launched |
| Subagent done | `subtask.wav` | Checkpoint ping — level cleared |
| File written | `enter.wav` | Bright mechanical click — *saved* |
| Tool running | `step.wav` | Quiet 900 Hz pluck — work in progress |
| Claude needs you | `notification.wav` | Rising wobble chime — heads up |
| Bash / web request | `permission.wav` | Curious two-note bell — *may I?* |
| Memory compressing | `idle.wav` | Low heartbeat — lub-DUB, lub-DUB |
| Something broke | `error.wav` | Cartoon trombone — wah-wah-waaah |

---

## Volume control

```bash
cc-calling loud      # 2× volume
cc-calling default   # normal
cc-calling quiet     # half volume
cc-calling mute      # silence
cc-calling           # show current level
```

Takes effect immediately — no restart needed.

> On Windows, only `mute` is supported. PowerShell's `SoundPlayer` has no volume API.

---

## Customize sounds

Every sound is a plain function in `src/generate-sounds.js` — frequencies, durations, envelopes, all exposed. Edit and rebuild:

```bash
node ~/.cc-calling/src/generate-sounds.js
```

No restart needed. The next Claude Code event picks up the new files immediately.

---

## How it works

CC Calling hooks into [Claude Code's hook system](https://docs.anthropic.com/en/docs/claude-code/hooks). A small Node.js script receives hook events on stdin, picks the matching audio file, and plays it detached — Claude Code never waits.

| Claude Code hook | Sound |
|---|---|
| `UserPromptSubmit` | `start.wav` |
| `Stop` | `complete.wav` |
| `SubagentStop` | `subtask.wav` |
| `Notification` | `notification.wav` |
| `PreCompact` | `idle.wav` |
| `PreToolUse` — Agent | `task.wav` |
| `PreToolUse` — Bash / WebSearch / WebFetch | `permission.wav` |
| `PostToolUse` success — Edit / Write | `enter.wav` |
| `PostToolUse` success — other tools | `step.wav` |
| `PostToolUse` failure | `error.wav` |

---

## Platform support

| Platform | Audio player |
|---|---|
| macOS | `afplay` — built-in, zero setup |
| Linux | `paplay` (PulseAudio) with `aplay` (ALSA) fallback |
| Windows | PowerShell `Media.SoundPlayer` — built-in, zero setup |

---

## Manual install

```bash
git clone https://github.com/ariliao/cc-calling.git ~/.cc-calling
npm install -g ~/.cc-calling
```

Restart Claude Code.

---

## Uninstall

```bash
npm uninstall -g cc-calling
node ~/.cc-calling/src/install.js --uninstall
rm -rf ~/.cc-calling
```

---

*Inspired by ICQ — the messenger that made your computer feel alive.*
