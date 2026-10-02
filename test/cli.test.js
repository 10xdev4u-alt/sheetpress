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
    env: { AM_NO_OPEN: '1', ANSWER_ME_HOME: dir, ...env }, cwd: dir,
  });
  return { code, out: out.text, err: err.text };
}

const GOOD = '---\ntitle: CLI 测试\n---\n## A 流程\n```flow\nA -> B\n```\n';

test('cli: --version 与 --help', async () => {
  assert.match((await run(['--version'])).out, /^\d+\.\d+\.\d+/);
  assert.match((await run([])).out, /用法/);
});

test('cli render: 从 stdin 读取，写入 ANSWER_ME_HOME/pages，打印路径与统计', async () => {
  const r = await run(['render', '-'], { stdin: GOOD });
  assert.equal(r.code, 0, r.err);
  const file = r.out.match(/✓ (.+\.html)/)[1];
  assert.ok(file.startsWith(join(dir, 'pages', 'CLI-测试-')));
  assert.match(readFileSync(file, 'utf8'), /<h1>CLI 测试<\/h1>/);
  assert.match(r.out, /sheet · blueprint · 1 面板 · flow×1/);
  assert.match(r.out, /STE ✓ 0 条警告/);
});

test('cli render: 文件参数 + -o + 主题覆盖', async () => {
  writeFileSync(join(dir, 'in.md'), GOOD);
  const r = await run(['render', 'in.md', '-o', 'out/x.html', '--theme', 'shadcn']);
  assert.equal(r.code, 0, r.err);
  assert.match(readFileSync(join(dir, 'out/x.html'), 'utf8'), /data-theme="shadcn"/);
});

test('cli render: 组件语法错误 → 绝对行号 + 组件名 + 正确示例，退出码 1', async () => {
  const r = await run(['render', '-'], { stdin: '## A\n文本\n```flow\nA -> B\n(未闭合 -> C\n```' });
  assert.equal(r.code, 1);
  assert.match(r.err, /✗ L5 \[flow\] flow 形状括号未闭合/);
  assert.match(r.err, /正确示例：\n {4}```flow/);
  assert.match(r.err, /am help flow/);
});

test('cli render: 解析错误给出行号', async () => {
  const r = await run(['render', '-'], { stdin: '## A\n```flow\nA -> B' });
  assert.equal(r.code, 1);
  assert.match(r.err, /✗ L2 稿件解析失败：围栏块/);
});

test('cli render: style 80 打印警告但仍生成；strict 拒绝生成', async () => {
  const bad = '## A\nUtilize the tool.';
  const soft = await run(['render', '-'], { stdin: bad });
  assert.equal(soft.code, 0);
  assert.match(soft.out, /STE 1 条警告[\s\S]*L2 \[word\] 不推荐 "Utilize" → use/);

  const before = readdirSync(join(dir, 'pages')).length;
  const strict = await run(['render', '-', '--style', 'strict'], { stdin: bad });
  assert.equal(strict.code, 1);
  assert.match(strict.err, /STE 检查未通过/);
  assert.equal(readdirSync(join(dir, 'pages')).length, before, 'strict 失败时不写文件');
});

test('cli lint: 仅检查；strict 下有警告返回 1；off 跳过', async () => {
  const bad = '## A\nUtilize the tool.';
  assert.equal((await run(['lint', '-'], { stdin: bad })).code, 0);
  assert.equal((await run(['lint', '-', '--style', 'strict'], { stdin: bad })).code, 1);
  assert.match((await run(['lint', '-', '--style', 'off'], { stdin: bad })).out, /已关闭/);
  assert.equal((await run(['lint', '-', '--style', 'x'], { stdin: bad })).code, 2);
});

test('cli list / help', async () => {
  assert.match((await run(['list'])).out, /flow\s+流程图/);
  const h = await run(['help', 'sequence']);
  assert.match(h.out, /sequence — 时序图[\s\S]*示例：\n```sequence/);
  assert.match((await run(['help', 'format'])).out, /template: sheet/);
  assert.equal((await run(['help', 'nope'])).code, 2);
});

test('cli: 参数错误与缺失', async () => {
  assert.equal((await run(['bogus'])).code, 2);
  assert.equal((await run(['render'])).code, 2);
  assert.equal((await run(['render', 'missing.md'])).code, 2);
  assert.equal((await run(['render', '-'], { stdin: '   ' })).code, 2);
  assert.equal((await run(['render', '--wat'])).code, 2);
});
