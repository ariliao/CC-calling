#!/usr/bin/env node
/**
 * CC Calling — Claude Code Hook Handler
 *
 * Called by Claude Code hooks. Reads hook event JSON from stdin,
 * maps it to the correct ICQ-style sound, and plays it non-blocking.
 *
 * Event → Sound mapping:
 *   UserPromptSubmit                       → start.wav       (user pressed Enter)
 *   Stop                                   → complete.wav    (conversation finished)
 *   SubagentStop                           → subtask.wav     (checkpoint ping)
 *   Notification                           → notification.wav
 *   PreCompact                             → idle.wav        (heartbeat = memory compression)
 *   PreToolUse (Agent)                     → task.wav        (subagent spawned)
 *   PreToolUse (Bash/WebSearch/WebFetch)   → permission.wav
 *   PreToolUse (other non-silent)          → step.wav
 *   PostToolUse (Edit/Write success)       → enter.wav       (crisp save click)
 *   PostToolUse (success)                  → step.wav
 *   PostToolUse (failure)                  → error.wav
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Volume multipliers per level
const VOLUME_LEVELS = { mute: 0, quiet: 0.4, default: 1.0, loud: 2.0 };
const BASE_VOLUME = 0.85; // platform default before multiplier

function getVolumeMultiplier() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return VOLUME_LEVELS[cfg.volume] ?? 1.0;
  } catch {
    return 1.0;
  }
}

// Tools that spawn a new subagent/task — get their own distinct sound
const TASK_TOOLS = new Set([
  'Agent',
]);

// Tools that typically require user approval in Claude Code
const APPROVAL_TOOLS = new Set([
  'Bash', 'computer', 'browser',
  'WebSearch', 'WebFetch',
]);

// File-writing tools — play a distinct "save" click on success
const WRITE_TOOLS = new Set([
  'Edit', 'Write', 'NotebookEdit',
]);

// Read-only / lightweight tools — suppress sound to avoid noise
// Agent is also silenced in PostToolUse: SubagentStop handles completion,
// so PostToolUse for Agent would cause a redundant double sound.
const SILENT_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LS',
  'TodoRead', 'TodoWrite', 'NotebookRead',
  'Agent',
]);

function playSound(name) {
  const file = path.join(SOUNDS_DIR, name);
  if (!fs.existsSync(file)) return;

  const multiplier = getVolumeMultiplier();
  if (multiplier === 0) return; // muted

  const platform = os.platform();
  let cmd, args;

  if (platform === 'darwin') {
    const vol = +(BASE_VOLUME * multiplier).toFixed(3);
    cmd = 'afplay';
    args = ['-v', String(vol), file];
  } else if (platform === 'linux') {
    // paplay volume: 65536 = 100%. aplay fallback has no volume flag.
    const vol = Math.round(65536 * BASE_VOLUME * multiplier);
    cmd = 'sh';
    args = ['-c', `paplay --volume=${vol} "$1" 2>/dev/null || aplay "$1" 2>/dev/null`, '--', file];
  } else if (platform === 'win32') {
    // SoundPlayer has no volume API — mute is handled above, other levels play at system volume
    cmd = 'powershell';
    args = ['-NoProfile', '-NonInteractive', '-c',
      `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`];
  } else {
    return;
  }

  // Spawn detached so it doesn't block Claude Code
  const proc = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  proc.unref();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });

process.stdin.on('end', () => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const { hook_event_name: hookName, tool_name, tool_response } = event;

  switch (hookName) {
    case 'UserPromptSubmit':
      playSound('start.wav');
      break;

    case 'Stop':
      playSound('complete.wav');
      break;

    case 'SubagentStop':
      playSound('subtask.wav');
      break;

    case 'Notification':
      playSound('notification.wav');
      break;

    case 'PreCompact':
      playSound('idle.wav');
      break;

    case 'PreToolUse': {
      if (tool_name && TASK_TOOLS.has(tool_name)) {
        playSound('task.wav');
      } else if (tool_name && APPROVAL_TOOLS.has(tool_name)) {
        playSound('permission.wav');
      } else if (tool_name && !SILENT_TOOLS.has(tool_name) && !WRITE_TOOLS.has(tool_name)) {
        playSound('step.wav');
      }
      break;
    }

    case 'PostToolUse': {
      if (SILENT_TOOLS.has(tool_name)) break;
      const failed = isToolFailure(tool_name, tool_response);
      if (failed) {
        playSound('error.wav');
      } else if (WRITE_TOOLS.has(tool_name)) {
        playSound('enter.wav');
      } else {
        playSound('step.wav');
      }
      break;
    }

    default:
      break;
  }

  // Always exit 0 — never block Claude Code
  process.exit(0);
});

function isToolFailure(toolName, response) {
  if (!response) return false;

  // Bash tool: check exit code in output
  if (toolName === 'Bash') {
    const content = typeof response === 'string' ? response : JSON.stringify(response);
    if (/exit code [1-9]\d*|command not found|error:/i.test(content)) {
      return true;
    }
    // Claude Code embeds exit code in structured response
    if (response && typeof response === 'object') {
      const exitCode = response.exit_code ?? response.exitCode;
      if (typeof exitCode === 'number' && exitCode !== 0) return true;
    }
  }

  // Generic error detection
  if (response && typeof response === 'object') {
    if (response.is_error === true || response.error === true) return true;
    if (response.type === 'error') return true;
  }

  return false;
}
