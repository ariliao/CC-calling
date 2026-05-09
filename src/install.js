#!/usr/bin/env node
/**
 * CC Calling — Installer
 * Registers (or removes) CC Calling hooks in ~/.claude/settings.json.
 *
 * Usage:
 *   node src/install.js            # install
 *   node src/install.js --uninstall
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK_ID = 'cc-calling';
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_JS = path.join(__dirname, 'hook.js');

// All Claude Code hook events that CC Calling handles
const HOOK_EVENTS = [
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'Notification',
  'PreCompact',
  'PreToolUse',
  'PostToolUse',
];

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 4));
}

function install() {
  const nodeExe = process.execPath;
  const command = `"${nodeExe}" "${HOOK_JS}"`;
  const entry = { _id: HOOK_ID, type: 'command', command };

  const settings = loadSettings();
  if (!settings.hooks) settings.hooks = {};

  let added = 0;
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) settings.hooks[event] = [];

    const hooks = settings.hooks[event];
    // Find or create the wrapper block that holds our hook
    let block = hooks.find(b => Array.isArray(b.hooks));
    if (!block) {
      block = { hooks: [] };
      hooks.push(block);
    }

    const already = block.hooks.some(h => h._id === HOOK_ID);
    if (!already) {
      block.hooks.push(entry);
      added++;
    }
  }

  saveSettings(settings);

  if (added > 0) {
    console.log(`✓ Registered ${added} hook(s) in ${SETTINGS_PATH}`);
  } else {
    console.log('✓ CC Calling hooks already registered (nothing changed)');
  }
  console.log('\nRestart Claude Code to activate.');
}

function uninstall() {
  const settings = loadSettings();
  if (!settings.hooks) {
    console.log('No hooks found — nothing to remove.');
    return;
  }

  let removed = 0;
  for (const event of HOOK_EVENTS) {
    const hooks = settings.hooks[event];
    if (!Array.isArray(hooks)) continue;

    for (const block of hooks) {
      if (!Array.isArray(block.hooks)) continue;
      const before = block.hooks.length;
      block.hooks = block.hooks.filter(h => h._id !== HOOK_ID);
      removed += before - block.hooks.length;
    }

    // Clean up empty wrapper blocks
    settings.hooks[event] = hooks.filter(b => !Array.isArray(b.hooks) || b.hooks.length > 0);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  saveSettings(settings);

  if (removed > 0) {
    console.log(`✓ Removed ${removed} hook entry(s) from ${SETTINGS_PATH}`);
  } else {
    console.log('CC Calling hooks were not found — nothing removed.');
  }
}

const args = process.argv.slice(2);
if (args.includes('--uninstall')) {
  uninstall();
} else {
  install();
}
