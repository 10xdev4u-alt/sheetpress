import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDoc, ParseError } from '../src/parse.js';

const SAMPLE = `---
template: sheet
theme: shadcn
title: TCP 三次握手   # 行尾注释
cols: 2
---
开场一段话。

## A 握手流程 {span=2 meta="RFC 793"}
\`\`\`sequence
Client -> Server: SYN
\`\`\`
## 状态变化
| a | b |
|---|---|
| 1 | ok |
`;

test('frontmatter: parses key-values, strips trailing comments, coerces numeric fields', () => {
  const doc = parseDoc(SAMPLE);
  assert.equal(doc.meta.template, 'sheet');
  assert.equal(doc.meta.theme, 'shadcn');
  assert.equal(doc.meta.title, 'TCP 三次握手');
  assert.equal(doc.meta.cols, 2);
  assert.equal(doc.meta.style, '80');
});

test('frontmatter: uses defaults when absent', () => {
  const doc = parseDoc('## 只有一个面板\n内容');
  assert.deepEqual(
    { t: doc.meta.template, th: doc.meta.theme, s: doc.meta.style, c: doc.meta.cols },
    { t: 'sheet', th: 'blueprint', s: '80', c: 3 },
  );
});

test('panel splitting: explicit ID, title, attrs, line numbers', () => {
  const doc = parseDoc(SAMPLE);
  assert.equal(doc.panels.length, 2);
  const [a, b] = doc.panels;
  assert.equal(a.id, 'A');
  assert.equal(a.title, '握手流程');
  assert.deepEqual(a.attrs, { span: 2, meta: 'RFC 793' });
  assert.equal(a.line, 9);
  assert.equal(b.id, 'B', 'without an ID, auto-assign the next free letter');
  assert.equal(b.title, '状态变化');
});

test('block splitting: markdown vs fence blocks, records fence lang, args, line numbers', () => {
  const doc = parseDoc(SAMPLE);
  const blocks = doc.panels[0].blocks;
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], {
    type: 'fence', lang: 'sequence', args: '', text: 'Client -> Server: SYN', line: 10,
  });
  assert.equal(doc.panels[1].blocks[0].type, 'md');
  assert.equal(doc.panels[1].blocks[0].line, 14);
  assert.equal(doc.intro[0].text.trim(), '开场一段话。');
});

test('fence args: ```flow LR splits into lang and args', () => {
  const doc = parseDoc('## X\n```flow LR\nA -> B\n```');
  const f = doc.panels[0].blocks[0];
  assert.equal(f.lang, 'flow');
  assert.equal(f.args, 'LR');
});

test('## inside fences does not split panels', () => {
  const doc = parseDoc('## A\n```md\n## 不是标题\n```\n## B\n文本');
  assert.equal(doc.panels.length, 2);
  assert.equal(doc.panels[0].blocks[0].text, '## 不是标题');
});

test('without frontmatter title, takes # heading from intro', () => {
  const doc = parseDoc('# 我的标题\n导语\n## A\nx');
  assert.equal(doc.meta.title, '我的标题');
  assert.equal(doc.intro[0].text.trim(), '导语');
});

test('auto IDs skip explicitly taken letters', () => {
  const doc = parseDoc('## 一\nx\n## A 二\ny\n## 三\nz');
  assert.deepEqual(doc.panels.map((p) => p.id), ['B', 'A', 'C']);
});

test('error: unclosed fence reports its start line', () => {
  assert.throws(
    () => parseDoc('## A\n文本\n```flow\nA -> B'),
    (err) => err instanceof ParseError && err.line === 3 && /Unclosed/.test(err.message),
  );
});

test('error: unclosed frontmatter', () => {
  assert.throws(() => parseDoc('---\ntitle: x\n## A'), (err) => err instanceof ParseError && err.line === 1);
});

test('error: illegal template / theme / strictness lists the options', () => {
  assert.throws(() => parseDoc('---\ntemplate: grid\n---'), /template.*sheet.*doc/);
  assert.throws(() => parseDoc('---\ntheme: neon\n---'), /theme.*blueprint.*shadcn/);
  assert.throws(() => parseDoc('---\nstyle: 50\n---'), /style.*off.*80.*strict/);
});

test('CRLF line endings parse correctly', () => {
  const doc = parseDoc('---\r\ntitle: T\r\n---\r\n## A\r\n内容\r\n');
  assert.equal(doc.meta.title, 'T');
  assert.equal(doc.panels[0].blocks[0].text.trim(), '内容');
});
