import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, ComponentError } from '../src/components/index.js';
import { parseFlow } from '../src/components/flow.js';
import { parseSequence } from '../src/components/sequence.js';
import { smoothPath } from '../src/svg/shapes.js';

const ctx = (args = '') => ({ args, uid: () => 'u1' });
const render = (name, text, args) => COMPONENTS.get(name).render(text, ctx(args));
const throwsAt = (fn, line) =>
  assert.throws(fn, (e) => e instanceof ComponentError && e.line === line);
const viewBox = (svg) => svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

// ── shapes ──
test('smoothPath: two points make a straight line, more points make a smooth curve', () => {
  assert.equal(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }]), 'M0,0 L10,0');
  assert.match(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]), /^M0,0 L5,0 Q10,0 10,5 L10,10$/);
});

// ── sequence ──
test('parseSequence: participants in order of appearance, solid/dashed lines, self-calls, notes', () => {
  const m = parseSequence('A -> B: 请求\nB --> A: 响应\nB -> B: 校验\nnote A, B: 建立连接');
  assert.deepEqual(m.participants, ['A', 'B']);
  assert.deepEqual(m.steps.map((s) => s.kind), ['msg', 'msg', 'msg', 'note']);
  assert.equal(m.steps[1].dashed, true);
  assert.equal(m.steps[2].from, m.steps[2].to);
  assert.deepEqual(m.steps[3].over, ['A', 'B']);
});

test('parseSequence: participants line pins the order', () => {
  const m = parseSequence('participants: Server, Client\nClient -> Server: SYN');
  assert.deepEqual(m.participants, ['Server', 'Client']);
});

test('sequence: emits SVG with actor boxes, lifelines, arrow labels', () => {
  const svg = render('sequence', 'Client -> Server: SYN\nServer --> Client: SYN-ACK');
  assert.match(svg, /^<figure class="am-diagram am-seq">/);
  assert.equal((svg.match(/class="am-actor"/g) || []).length, 2);
  assert.equal((svg.match(/class="am-lifeline"/g) || []).length, 2);
  assert.match(svg, />SYN<\/text>/);
  assert.match(svg, /am-edge am-edge--dashed/);
  assert.match(svg, /marker-end="url\(#u1-arrow\)"/);
});

test('sequence: long message labels widen participant spacing', () => {
  const short = viewBox(render('sequence', 'A -> B: x'))[0];
  const long = viewBox(render('sequence', 'A -> B: 这是一个非常非常长的消息标签需要更大的间距'))[0];
  assert.ok(long > short + 100, `short=${short} long=${long}`);
});

test('sequence: num param adds sequence numbers', () => {
  assert.match(render('sequence', 'A -> B: x', 'num'), /class="am-step"[^>]*>1<\/text>/);
});

test('sequence: unparsable lines report line numbers', () => {
  throwsAt(() => render('sequence', 'A -> B: ok\nA => B'), 2);
});

// ── flow ──
test('parseFlow: chains, fan-out, shape markers, highlight, edge labels', () => {
  const m = parseFlow('(开始) -> 输入 -> {合法?}\n合法? -> 处理 & *[(数据库)]: 是\n合法? --> 报错: 否');
  const shape = Object.fromEntries([...m.nodes.values()].map((n) => [n.id, n.shape]));
  assert.deepEqual(shape, { 开始: 'round', 输入: 'rect', '合法?': 'diamond', 处理: 'rect', 数据库: 'db', 报错: 'rect' });
  assert.equal(m.nodes.get('数据库').hi, true);
  assert.equal(m.edges.length, 5);
  assert.deepEqual(m.edges.filter((e) => e.label === '是').map((e) => e.to), ['处理', '数据库']);
  assert.equal(m.edges.find((e) => e.to === '报错').dashed, true);
});

test('parseFlow: brackets protect node text containing colons', () => {
  const m = parseFlow('[Part 1: rules] -> [Part 2: dict]: 引用');
  assert.ok(m.nodes.has('Part 1: rules'));
  assert.equal(m.edges[0].label, '引用');
});

test('parseFlow: group declares clusters', () => {
  const m = parseFlow('网关 -> 鉴权\n网关 -> 业务\ngroup 后端: 鉴权, 业务');
  assert.deepEqual(m.groups, [{ name: '后端', members: ['鉴权', '业务'], line: 3 }]);
});

test('flow: emits SVG with nodes/edges/labels/groups', () => {
  const svg = render('flow', '用户 -> 网关: HTTPS\n网关 -> 鉴权\n网关 -> 业务\ngroup 后端: 鉴权, 业务');
  assert.match(svg, /^<figure class="am-diagram am-flow">/);
  assert.equal((svg.match(/class="am-node /g) || []).length, 4);
  assert.equal((svg.match(/class="am-edge"/g) || []).length, 3);
  assert.match(svg, /class="am-edge-label".*>HTTPS<\/text>/s);
  assert.match(svg, /class="am-cluster"/);
  assert.match(svg, />后端<\/text>/);
});

test('flow: LR layout is wider, TB layout is taller', () => {
  const src = 'A -> B -> C -> D';
  const [wTB, hTB] = viewBox(render('flow', src));
  const [wLR, hLR] = viewBox(render('flow', src, 'LR'));
  assert.ok(hTB > wTB && wLR > hLR);
});

test('flow: diamond nodes render as polygon, database as cylinder', () => {
  const svg = render('flow', '{判断?} -> [(DB)]');
  assert.match(svg, /<polygon class="am-node-shape"/);
  assert.match(svg, /am-node--db/);
});

test('flow: group referencing unknown nodes errors; empty graph errors', () => {
  throwsAt(() => render('flow', 'A -> B\ngroup G: A, X'), 2);
  throwsAt(() => render('flow', '  '), 1);
});

test('flow: errors on unclosed shape brackets', () => {
  throwsAt(() => render('flow', 'A -> B\n(未闭合 -> C'), 2);
});
