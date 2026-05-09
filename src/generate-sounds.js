#!/usr/bin/env node
/**
 * CC Calling — ICQ-style Sound Generator
 * Synthesizes all sound files purely in JavaScript (no external deps).
 * Writes 16-bit mono WAV files to ../sounds/
 */

const fs = require('fs');
const path = require('path');

const SR = 44100; // sample rate
const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');

if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

// ─── WAV helpers ─────────────────────────────────────────────────────────────

function makeWav(samples) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // PCM chunk size
  buf.writeUInt16LE(1, 20);       // PCM format
  buf.writeUInt16LE(1, 22);       // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);  // byte rate
  buf.writeUInt16LE(2, 32);       // block align
  buf.writeUInt16LE(16, 34);      // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buf;
}

function sec(s) { return Math.round(SR * s); }
function silence(s) { return new Array(sec(s)).fill(0); }

// Add very subtle room reverb (single delay reflection)
function reverb(samples, delayMs = 35, feedback = 0.18) {
  const out = [...samples];
  const delaySamples = Math.round(SR * delayMs / 1000);
  for (let i = delaySamples; i < out.length; i++) {
    out[i] += out[i - delaySamples] * feedback;
  }
  // normalize so we don't clip — use reduce to avoid spread stack limit on long sounds
  const peak = out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  return peak > 0.95 ? out.map(s => s * 0.95 / peak) : out;
}

function concat(...arrays) {
  return arrays.reduce((acc, arr) => { acc.push(...arr); return acc; }, []);
}

// ─── Musical note frequencies ────────────────────────────────────────────────
// Equal temperament, A4 = 440Hz
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
  G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
};

// Bell-like tone: fundamental + inharmonic partials (like a real bell)
function bell(freq, duration, amp = 0.75) {
  const n = sec(duration);
  return Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    // Real bells have inharmonic overtones — ratios 1, 2.76, 5.40, 8.93
    return amp * (
      1.00 * Math.sin(2 * Math.PI * freq * 1.00 * t) * Math.exp(-t / (duration * 0.6)) +
      0.40 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t / (duration * 0.3)) +
      0.18 * Math.sin(2 * Math.PI * freq * 5.40 * t) * Math.exp(-t / (duration * 0.15)) +
      0.08 * Math.sin(2 * Math.PI * freq * 8.93 * t) * Math.exp(-t / (duration * 0.08))
    );
  });
}

// A single plucked "piano-like" note with fast attack and exponential decay
function pluck(freq, duration, amp = 0.72) {
  const n = sec(duration);
  const atkN = Math.round(SR * 0.004);
  return Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    const atk = Math.min(1, i / atkN);
    const decay = Math.exp(-t / (duration * 0.38));
    return amp * atk * decay * (
      Math.sin(2 * Math.PI * freq * t) +
      0.5 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.18 * Math.sin(2 * Math.PI * freq * 3 * t)
    );
  });
}

// ─── Sound definitions ────────────────────────────────────────────────────────

/**
 * complete.wav — Mini victory fanfare (full conversation done)
 * Four ascending notes: C4 → E4 → G4 → C5, each with bell-pluck character.
 * The last note is held longer — like a little "ta-daaaa!".
 */
function soundComplete() {
  const gap = silence(0.022);
  const notes = concat(
    pluck(NOTE.C4, 0.13, 0.65), gap,
    pluck(NOTE.E4, 0.13, 0.68), gap,
    pluck(NOTE.G4, 0.13, 0.72), gap,
    pluck(NOTE.C5, 0.38, 0.80),         // held finale
  );
  // Add a soft chord shimmer under the last note
  const shimmer = concat(
    silence(0.13 * 3 + 0.022 * 3),
    Array.from({ length: sec(0.38) }, (_, i) => {
      const t = i / SR;
      const env = Math.exp(-t / 0.25);
      return 0.26 * env * (
        Math.sin(2 * Math.PI * NOTE.E4 * t) +
        Math.sin(2 * Math.PI * NOTE.G4 * t)
      );
    }),
  );
  const mixed = notes.map((s, i) => s + (shimmer[i] ?? 0));
  return reverb(mixed, 45, 0.22);
}

/**
 * subtask.wav — Checkpoint ping (SubagentStop / subtask done)
 * Two quick crisp tones: E5 → G5. Lighter and shorter than the victory fanfare.
 * Sounds like "level checkpoint" in a game.
 */
function soundSubtask() {
  const gap = silence(0.018);
  return reverb(
    concat(
      pluck(NOTE.E5, 0.10, 0.62), gap,
      pluck(NOTE.G5, 0.20, 0.70),
    ),
    30, 0.18
  );
}

/**
 * step.wav — Soft key-click (PostToolUse success)
 * Very short mechanical tick: subtle, won't distract since it fires often.
 * A tight 900Hz pluck — satisfying but unobtrusive.
 */
function soundStep() {
  return reverb(pluck(900, 0.09, 0.55), 20, 0.10);
}

/**
 * notification.wav — "Heads up!" wobble chime (Claude needs your attention)
 * Rising tone with a playful vibrato wobble — like a curious "hmm?".
 * Not alarming, just attention-grabbing.
 */
function soundNotification() {
  const n = sec(0.42);
  const samples = Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    const progress = i / (n - 1);
    // Pitch rises from A4 to A5 with 5Hz vibrato that grows in depth
    const baseFreq = NOTE.A4 * Math.pow(2, progress);
    const vibDepth = 0.025 * progress;                 // vibrato fades in
    const freq = baseFreq * (1 + vibDepth * Math.sin(2 * Math.PI * 5.5 * t));
    const env = progress < 0.1
      ? progress / 0.1
      : Math.exp(-(progress - 0.1) / 0.55);
    return 0.70 * env * (
      Math.sin(2 * Math.PI * freq * t) +
      0.30 * Math.sin(2 * Math.PI * freq * 2 * t)
    );
  });
  return reverb(samples, 40, 0.20);
}

/**
 * permission.wav — Curious question mark (PreToolUse / about to run command)
 * Rising tritone: C4 → F#4, with a slight pause — like asking "may I?".
 * Friendly but distinct enough to catch attention.
 */
function soundPermission() {
  const lo = pluck(NOTE.C4, 0.14, 0.65);
  const gap = silence(0.030);
  const hi = bell(NOTE.F4 * Math.pow(2, 1 / 12), 0.35, 0.68); // F#4
  return reverb(concat(lo, gap, hi), 38, 0.22);
}

/**
 * idle.wav — Heartbeat pulse (PreCompact: context compression in progress)
 * Soft low double-thump like a heartbeat: lub-DUB ... lub-DUB.
 * Signals Claude is pausing to compress memory — distinctive from other events.
 */
function soundIdle() {
  const lub = (freq, amp) => {
    const n = sec(0.10);
    return Array.from({ length: n }, (_, i) => {
      const t = i / SR;
      const env = Math.exp(-t / 0.05);
      return amp * env * (
        Math.sin(2 * Math.PI * freq * t) +
        0.45 * Math.sin(2 * Math.PI * freq * 1.5 * t)
      );
    });
  };
  // lub (softer) … DUB (louder) … pause … lub … DUB
  return reverb(concat(
    lub(90, 0.50), silence(0.055), lub(70, 0.70),
    silence(0.18),
    lub(90, 0.50), silence(0.055), lub(70, 0.70),
  ), 25, 0.12);
}

/**
 * error.wav — Cartoon trombone "Wah-wah-waaah" (tool failure)
 * Three descending voiced sweeps — each lower and more mournful than the last.
 * Deliberately comedic so failures feel less painful.
 */
function soundError() {
  const wah = (startFreq, endFreq, duration, amp) => {
    const n = sec(duration);
    let phase1 = 0, phase2 = 0, phase3 = 0;
    return Array.from({ length: n }, (_, i) => {
      const progress = i / (n - 1);
      const freq = startFreq + (endFreq - startFreq) * Math.pow(progress, 0.7);
      const wave =
        0.55 * Math.sin(phase1) +
        0.30 * Math.sin(phase2) +
        0.15 * Math.sin(phase3);
      phase1 += 2 * Math.PI * freq / SR;
      phase2 += 2 * Math.PI * freq * 2 / SR;
      phase3 += 2 * Math.PI * freq * 3 / SR;
      const env = progress < 0.05
        ? progress / 0.05
        : Math.exp(-(progress - 0.05) / 0.60);
      return amp * env * wave;
    });
  };

  const gap = silence(0.030);
  const gap2 = silence(0.022);
  return reverb(concat(
    wah(480, 300, 0.22, 0.68), gap,
    wah(380, 200, 0.28, 0.65), gap2,
    wah(280, 120, 0.42, 0.55),
  ), 35, 0.20);
}

/**
 * enter.wav — Crisp confirm click (PostToolUse: file write / edit success)
 * Short bright tick — like a mechanical keyboard save click.
 */
function soundEnter() {
  return reverb(pluck(NOTE.C6, 0.055, 0.60), 15, 0.08);
}

/**
 * start.wav — Prompt submitted (UserPromptSubmit: user pressed Enter)
 * G4 → C5 ascending pickup — a warm "let's go" signal.
 */
function soundStart() {
  const gap = silence(0.015);
  return reverb(
    concat(
      pluck(NOTE.G4, 0.09, 0.60), gap,
      pluck(NOTE.C5, 0.22, 0.72),
    ),
    28, 0.14
  );
}

/**
 * task.wav — Subagent / task launched (PreToolUse: Agent tool)
 * A crisp three-note ascending burst: C5 → E5 → G5, tight and energetic.
 * Distinct from start.wav (warm pickup) and permission.wav (question mark).
 * Signals "a new task has been spawned and is running."
 */
function soundTask() {
  const gap = silence(0.012);
  // Short staccato burst — each note punchy and bright
  const notes = concat(
    pluck(NOTE.C5, 0.07, 0.72), gap,
    pluck(NOTE.E5, 0.07, 0.78), gap,
    pluck(NOTE.G5, 0.18, 0.85),
  );
  // Layered shimmer chord under the last note for a "launch" feel
  const shimmerStart = sec(0.07 * 2 + 0.012 * 2);
  const shimmer = Array.from({ length: notes.length }, (_, i) => {
    if (i < shimmerStart) return 0;
    const t = (i - shimmerStart) / SR;
    const env = Math.exp(-t / 0.12);
    return 0.22 * env * (
      Math.sin(2 * Math.PI * NOTE.C5 * t) +
      Math.sin(2 * Math.PI * NOTE.E5 * t)
    );
  });
  const mixed = notes.map((s, i) => s + (shimmer[i] ?? 0));
  return reverb(mixed, 32, 0.18);
}

// ─── Generate all sounds ──────────────────────────────────────────────────────

const sounds = {
  'complete.wav':     soundComplete,
  'subtask.wav':      soundSubtask,
  'step.wav':         soundStep,
  'notification.wav': soundNotification,
  'permission.wav':   soundPermission,
  'idle.wav':         soundIdle,      // PreCompact
  'error.wav':        soundError,
  'enter.wav':        soundEnter,     // PostToolUse write ops
  'start.wav':        soundStart,     // UserPromptSubmit
  'task.wav':         soundTask,      // Agent tool fired — subtask spawned
};

let generated = 0;
for (const [filename, fn] of Object.entries(sounds)) {
  const samples = fn();
  const wav = makeWav(samples);
  const outPath = path.join(SOUNDS_DIR, filename);
  fs.writeFileSync(outPath, wav);
  const dur = (samples.length / SR * 1000).toFixed(0);
  console.log(`✓ ${filename.padEnd(20)} ${dur.padStart(4)}ms  (${wav.length} bytes)`);
  generated++;
}

console.log(`\nGenerated ${generated} sounds → ${SOUNDS_DIR}`);
