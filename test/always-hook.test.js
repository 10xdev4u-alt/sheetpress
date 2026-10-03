import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'));

test('always plugin: hook emits valid UserPromptSubmit additionalContext', () => {
  const r = spawnSync(process.execPath, [`${ROOT}/plugins/sheetpress-always/hooks/remind.mjs`], {
    input: '{"prompt":"讲讲 TCP"}', encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /^\[sheetpress always-on\]/);
  assert.ok(out.hookSpecificOutput.additionalContext.length < 600, 'reminder must stay short; it is injected on every turn');
});

test('always plugin: hooks.json points at an existing script, marketplace registered', () => {
  const hooks = read('plugins/sheetpress-always/hooks/hooks.json');
  const cmd = hooks.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(cmd.command, 'node');
  assert.equal(cmd.args[0], '${CLAUDE_PLUGIN_ROOT}/hooks/remind.mjs');
  const names = read('.claude-plugin/marketplace.json').plugins.map((p) => p.name);
  assert.deepEqual(names, ['sheetpress', 'sheetpress-always']);
});

test('SKILL.md documents the always-on marker for high-frequency mode', () => {
  assert.match(readFileSync(`${ROOT}/skills/sheetpress/SKILL.md`, 'utf8'), /\[sheetpress always-on\]/);
});

test('always plugin: reminder requires --no-open, never pops a browser', () => {
  const r = spawnSync(process.execPath, [`${ROOT}/plugins/sheetpress-always/hooks/remind.mjs`], { encoding: 'utf8' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /--no-open/);
});

test('always plugin: no reminder when always=off; reminder still injected on corrupt config', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const home = mkdtempSync(`${tmpdir()}/am-always-`);
  const run = () => spawnSync(process.execPath, [`${ROOT}/plugins/sheetpress-always/hooks/remind.mjs`], {
    encoding: 'utf8', env: { ...process.env, SHEETPRESS_HOME: home },
  });
  try {
    assert.match(run().stdout, /always-on/, 'enabled by default when no config file exists');
    writeFileSync(`${home}/config.json`, JSON.stringify({ always: false }));
    const off = run();
    assert.equal(off.status, 0);
    assert.equal(off.stdout, '');
    writeFileSync(`${home}/config.json`, '{ broken');
    assert.match(run().stdout, /always-on/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
