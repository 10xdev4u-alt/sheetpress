import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), 'am-test-')); });
after(() => rmSync(dir, { recursive: true, force: true }));

function sink() {
  let text = '';
  const stream = new Writable({ write(chunk, _enc, cb) { text += chunk; cb(); } });
  return { stream, get text() { return text; } };
}

async function run(args, { stdin = '', env = {} } = {}) {
  const out = sink();
  const err = sink();
  const code = await main(args, {
    stdout: out.stream, stderr: err.stream, stdin: Readable.from([stdin]),
    env: { AM_NO_OPEN: '1', SHEETPRESS_HOME: dir, ...env }, cwd: dir,
  });
  return { code, out: out.text, err: err.text };
}

const GOOD = '---\ntitle: CLI 测试\n---\n## A 流程\n```flow\nA -> B\n```\n';

test('cli: --version and --help', async () => {
  assert.match((await run(['--version'])).out, /^\d+\.\d+\.\d+/);
  assert.match((await run([])).out, /Usage:/);
});

test('cli render: reads stdin, writes to SHEETPRESS_HOME/pages, prints path and stats', async () => {
  const r = await run(['render', '-'], { stdin: GOOD });
  assert.equal(r.code, 0, r.err);
  const file = r.out.match(/✓ (.+\.html)/)[1];
  assert.ok(file.startsWith(join(dir, 'pages', 'CLI-测试-')));
  assert.match(readFileSync(file, 'utf8'), /<h1>CLI 测试<\/h1>/);
  assert.match(r.out, /sheet · blueprint · 1 panels · flow×1/);
  assert.match(r.out, /STE ✓ 0 warnings/);
});

test('cli render: file arg + -o + theme override', async () => {
  writeFileSync(join(dir, 'in.md'), GOOD);
  const r = await run(['render', 'in.md', '-o', 'out/x.html', '--theme', 'shadcn']);
  assert.equal(r.code, 0, r.err);
  assert.match(readFileSync(join(dir, 'out/x.html'), 'utf8'), /data-theme="shadcn"/);
});

test('cli render: component syntax error -> absolute line + component name + correct example, exit 1', async () => {
  const r = await run(['render', '-'], { stdin: '## A\n文本\n```flow\nA -> B\n(未闭合 -> C\n```' });
  assert.equal(r.code, 1);
  assert.match(r.err, /✗ L5 \[flow\] Unclosed flow shape bracket/);
  assert.match(r.err, /Correct example:\n {4}```flow/);
  assert.match(r.err, /am help flow/);
});

test('cli render: parse errors report line numbers', async () => {
  const r = await run(['render', '-'], { stdin: '## A\n```flow\nA -> B' });
  assert.equal(r.code, 1);
  assert.match(r.err, /✗ L2 Failed to parse brief: Unclosed fence/);
});

test('cli render: style 80 warns but still generates; strict refuses to generate', async () => {
  const bad = '## A\nUtilize the tool.';
  const soft = await run(['render', '-'], { stdin: bad });
  assert.equal(soft.code, 0);
  assert.match(soft.out, /STE 1 warnings[\s\S]*L2 \[word\] Avoid "Utilize" → use/);

  const before = readdirSync(join(dir, 'pages')).length;
  const strict = await run(['render', '-', '--style', 'strict'], { stdin: bad });
  assert.equal(strict.code, 1);
  assert.match(strict.err, /STE check failed \(style: strict\)/);
  assert.equal(readdirSync(join(dir, 'pages')).length, before, 'strict mode must not write files on failure');
});

test('cli lint: check only; warnings exit 1 under strict; off skips', async () => {
  const bad = '## A\nUtilize the tool.';
  assert.equal((await run(['lint', '-'], { stdin: bad })).code, 0);
  assert.equal((await run(['lint', '-', '--style', 'strict'], { stdin: bad })).code, 1);
  assert.match((await run(['lint', '-', '--style', 'off'], { stdin: bad })).out, /STE checks off/);
  assert.equal((await run(['lint', '-', '--style', 'x'], { stdin: bad })).code, 2);
});

test('cli list / help', async () => {
  assert.match((await run(['list'])).out, /flow\s+Flowchart/);
  const h = await run(['help', 'sequence']);
  assert.match(h.out, /sequence — Sequence diagram[\s\S]*Example:\n```sequence/);
  assert.match((await run(['help', 'format'])).out, /template: sheet/);
  assert.equal((await run(['help', 'nope'])).code, 2);
});

test('cli: bad and missing args', async () => {
  assert.equal((await run(['bogus'])).code, 2);
  assert.equal((await run(['render'])).code, 2);
  assert.equal((await run(['render', 'missing.md'])).code, 2);
  assert.equal((await run(['render', '-'], { stdin: '   ' })).code, 2);
  assert.equal((await run(['render', '--wat'])).code, 2);
});

test('cli config: shows all keys, current values, and config file path', async () => {
  const r = await run(['config']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /config\.json/);
  for (const key of ['open', 'always', 'theme', 'mode', 'style']) assert.match(r.out, new RegExp(`\\b${key}\\b`));
});

test('cli config: set / get / reset, changed values marked with *', async () => {
  assert.equal((await run(['config', 'set', 'theme', 'shadcn'])).code, 0);
  assert.equal((await run(['config', 'get', 'theme'])).out.trim(), 'shadcn');
  assert.match((await run(['config'])).out, /\* theme\s+shadcn/);
  const rendered = await run(['render', '-', '-o', 'cfg.html'], { stdin: '## A\nx' });
  assert.match(readFileSync(join(dir, 'cfg.html'), 'utf8'), /data-theme="shadcn"/, 'render picks up the default theme from config');
  assert.equal(rendered.code, 0);
  assert.equal((await run(['config', 'reset', 'theme'])).code, 0);
  assert.equal((await run(['config', 'get', 'theme'])).out.trim(), 'blueprint');
});

test('cli config: booleans print on/off; bad key or value returns 2', async () => {
  await run(['config', 'set', 'open', 'off']);
  assert.equal((await run(['config', 'get', 'open'])).out.trim(), 'off');
  await run(['config', 'reset']);
  const bad = await run(['config', 'set', 'theme', 'neon']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /blueprint \| shadcn/);
  assert.equal((await run(['config', 'set', 'nope', '1'])).code, 2);
  assert.equal((await run(['config', 'frob'])).code, 2);
});

test('shouldOpen: --no-open > AM_NO_OPEN > config open; --open forces open', async () => {
  const { shouldOpen } = await import('../src/cli.js');
  assert.equal(shouldOpen({}, {}, { open: true }), true);
  assert.equal(shouldOpen({}, {}, { open: false }), false);
  assert.equal(shouldOpen({ 'no-open': true }, {}, { open: true }), false);
  assert.equal(shouldOpen({}, { AM_NO_OPEN: '1' }, { open: true }), false);
  assert.equal(shouldOpen({}, { AM_NO_OPEN: '0' }, { open: true }), true, 'AM_NO_OPEN=0 does not count as disabled');
  assert.equal(shouldOpen({}, { CI: 'true' }, { open: true }), false);
  assert.equal(shouldOpen({ open: true }, { AM_NO_OPEN: '1' }, { open: false }), true);
});
