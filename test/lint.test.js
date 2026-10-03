import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDoc } from '../src/parse.js';
import { lintDoc, splitSentences, sentenceLength, formatWarning } from '../src/lint/ste.js';

const lint = (body) => lintDoc(parseDoc(body));
const rules = (ws) => ws.map((w) => w.rule);

test('splitSentences: CN/EN sentence punctuation, keeps abbreviations intact', () => {
  assert.deepEqual(splitSentences('先关阀门。再拆泵！好吗？'), ['先关阀门。', '再拆泵！', '好吗？']);
  assert.deepEqual(splitSentences('Close the valve. Remove the pump, e.g. the main one.'), ['Close the valve.', 'Remove the pump, e.g. the main one.']);
  assert.deepEqual(splitSentences('Version 3.5 is out.'), ['Version 3.5 is out.']);
});

test('sentenceLength: Chinese counts chars (EN words count 1), English counts words', () => {
  assert.deepEqual(sentenceLength('用 Node 运行脚本。'), { lang: 'zh', count: 6 });
  assert.deepEqual(sentenceLength('Close the valve now.'), { lang: 'en', count: 4 });
});

test('overlong Chinese descriptive sentence (>45 chars) reports sentence-length with line number', () => {
  const long = '这'.repeat(46) + '。';
  const ws = lint(`## A\n第一行。\n${long}`);
  assert.deepEqual(rules(ws), ['sentence-length']);
  assert.equal(ws[0].line, 3);
});

test('ordered lists count as procedural content with a stricter limit (35 CN chars / 20 EN words)', () => {
  const zh = '步'.repeat(36);
  assert.deepEqual(rules(lint(`## A\n1. ${zh}`)), ['sentence-length']);
  assert.deepEqual(rules(lint(`## A\n- ${zh}`)), [], 'unordered lists use the descriptive 45-char limit');
  const en = Array.from({ length: 21 }, () => 'go').join(' ');
  assert.deepEqual(rules(lint(`## A\n1. ${en}.`)), ['sentence-length']);
});

test('paragraphs over 6 sentences report paragraph-length', () => {
  const ws = lint(`## A\n一。二。三。\n四。五。六。七。`);
  assert.deepEqual(rules(ws), ['paragraph-length']);
  assert.equal(ws[0].line, 2);
});

test('English banned words suggest replacements, case-insensitive, multi-word phrases recognized', () => {
  const ws = lint('## A\nUtilize the tool prior to the test.');
  assert.deepEqual(ws.map((w) => w.suggestion), ['use', 'before']);
});

test('English passive-voice heuristic', () => {
  assert.deepEqual(rules(lint('## A\nThe valve is closed by the operator.')), ['passive']);
  assert.deepEqual(rules(lint('## A\nThe operator closes the valve.')), []);
});

test('Chinese empty verbs: strips perform-type wrappers; ongoing-state phrases not flagged', () => {
  const ws = lint('## A\n我们对接口进行优化。任务进行中。');
  assert.equal(ws.length, 1);
  assert.equal(ws[0].rule, 'word');
  assert.match(ws[0].suggestion, /优化/);
});

test('Chinese de-chains and cliches', () => {
  assert.deepEqual(rules(lint('## A\n我的朋友的同事的电脑坏了。')), ['de-chain']);
  assert.deepEqual(rules(lint('## A\n这一步至关重要。')), ['cliche']);
});

test('skips: code, inline code, strikethrough, no-status rows, headings, components', () => {
  const src = `## A
\`\`\`python
utilize = 1
\`\`\`
调用 \`utilize()\` 函数。~~Commence pumping.~~
| 写法 | 状态 |
|---|---|
| Commence pumping. | no |
### Utilize 标题
\`\`\`annot
[Utilize]{!Not approved} the tool.
\`\`\``;
  assert.deepEqual(lint(src), []);
});

test('callout body is checked; plain table cells are checked', () => {
  const ws = lint('## A\n```callout warn 注意\nUtilize it.\n```\n| a |\n|---|\n| Commence now. |');
  assert.deepEqual(ws.map((w) => [w.line, w.suggestion]), [[3, 'use'], [7, 'start']]);
});

test('intro lead text is also checked', () => {
  assert.equal(lint('导语里 utilize 一下。\n## A\nx').length, 1);
});

test('formatWarning: line number + rule + message + suggestion', () => {
  const s = formatWarning({ line: 4, rule: 'word', message: '不推荐 "utilize"', suggestion: 'use' });
  assert.equal(s, 'L4 [word] 不推荐 "utilize" → use');
});
