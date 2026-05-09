#!/usr/bin/env node
/**
 * CC Calling — Volume Control
 *
 * Usage:
 *   node src/volume.js              # show current level
 *   node src/volume.js loud         # louder than default
 *   node src/volume.js default      # restore default
 *   node src/volume.js quiet        # softer
 *   node src/volume.js mute         # silence all sounds
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const LEVELS = ['mute', 'quiet', 'default', 'loud'];
const DESCRIPTIONS = {
  mute:    'no sound',
  quiet:   'half volume',
  default: 'normal volume',
  loud:    'double volume',
};

function load() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function save(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

const arg = process.argv[2];

if (!arg) {
  const level = load().volume || 'default';
  console.log(`Volume: ${level}  (${DESCRIPTIONS[level]})`);
  console.log(`\nOptions: ${LEVELS.map(l => l === level ? `[${l}]` : l).join('  ')}`);
  console.log(`Usage:   cc-calling <level>`);
  process.exit(0);
}

if (!LEVELS.includes(arg)) {
  console.error(`Unknown level: "${arg}". Choose: ${LEVELS.join(', ')}`);
  process.exit(1);
}

const cfg = load();
cfg.volume = arg;
save(cfg);
console.log(`✓ Volume set to: ${arg}  (${DESCRIPTIONS[arg]})`);
