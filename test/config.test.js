import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configPath, readConfig, setConfig, resetConfig, CONFIG_KEYS, ConfigError } from '../src/config.js';
import { renderDoc } from '../src/render.js';

let home;
let env;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'am-config-'));
  env = { SHEETPRESS_HOME: home };
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

test('configPath: lives at SHEETPRESS_HOME/config.json', () => {
  assert.equal(configPath(env), join(home, 'config.json'));
});

test('readConfig: returns defaults when file is missing', () => {
  assert.deepEqual(readConfig(env).values, { open: true, always: true, theme: 'blueprint', mode: 'auto', style: '80' });
});

test('setConfig: booleans accept on/off/true/false, writes file', () => {
  setConfig('open', 'off', env);
  assert.equal(readConfig(env).values.open, false);
  setConfig('open', '开', env);
  assert.equal(readConfig(env).values.open, true);
  assert.deepEqual(JSON.parse(readFileSync(configPath(env), 'utf8')), { open: true });
});

test('setConfig: enum validation, illegal values list the options', () => {
  setConfig('theme', 'shadcn', env);
  assert.equal(readConfig(env).values.theme, 'shadcn');
  assert.throws(() => setConfig('theme', 'neon', env), (e) => e instanceof ConfigError && /blueprint \| shadcn/.test(e.message));
  assert.throws(() => setConfig('nope', '1', env), (e) => e instanceof ConfigError && /open/.test(e.message));
  assert.throws(() => setConfig('open', 'maybe', env), ConfigError);
});

test('resetConfig: resets one key or all to defaults', () => {
  setConfig('open', 'off', env);
  setConfig('theme', 'shadcn', env);
  resetConfig('open', env);
  assert.deepEqual(readConfig(env).values, { open: true, always: true, theme: 'shadcn', mode: 'auto', style: '80' });
  resetConfig(undefined, env);
  assert.equal(existsSync(configPath(env)), false);
});

test('readConfig: falls back to defaults with a warning on corrupt file', () => {
  writeFileSync(configPath(env), '{ not json');
  const { values, warning } = readConfig(env);
  assert.equal(values.open, true);
  assert.match(warning, /config\.json/);
});

test('readConfig: ignores unknown keys and illegal values', () => {
  writeFileSync(configPath(env), JSON.stringify({ open: 'yes-ish', theme: 'shadcn', extra: 1 }));
  assert.deepEqual(readConfig(env).values, { open: true, always: true, theme: 'shadcn', mode: 'auto', style: '80' });
});

test('CONFIG_KEYS entries each have a description label', () => {
  for (const [key, spec] of Object.entries(CONFIG_KEYS)) assert.ok(spec.label, key);
});

test('render: config acts as defaults, explicit frontmatter wins', () => {
  const defaults = { theme: 'shadcn', mode: 'dark', style: 'off' };
  const plain = renderDoc('## A\nUtilize it.', {}, defaults);
  assert.match(plain.html, /data-theme="shadcn" data-mode="dark"/);
  assert.equal(plain.warnings.length, 0, 'style: off comes from config');
  const explicit = renderDoc('---\ntheme: blueprint\n---\n## A\nx', {}, defaults);
  assert.match(explicit.html, /data-theme="blueprint"/);
  const flag = renderDoc('---\ntheme: blueprint\n---\n## A\nx', { theme: 'shadcn' }, defaults);
  assert.match(flag.html, /data-theme="shadcn"/, 'CLI flags take highest precedence');
});
