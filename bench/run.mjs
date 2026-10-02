#!/usr/bin/env node
// A/B 基准：同一模型、同一题目，对比"直接让 Agent 手写 HTML"与"用 Answer me with HTML"。
// 记录 claude -p 返回的真实输出 token、耗时、花费与轮数。需要已安装 Claude Code 与本 skill。
// 用法：node bench/run.mjs [model] [输出目录] [每组重复次数]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const MODEL = process.argv[2] || 'sonnet';
const OUT = resolve(process.argv[3] || 'bench/results');
const REPS = Number(process.argv[4] || 3);
// 可选：BENCH_TOPICS=tcp,git 只跑部分题目；BENCH_SUFFIX 追加到提示词末尾（如 "Write the page in English."）。
const ONLY = process.env.BENCH_TOPICS?.split(',');
const SUFFIX = process.env.BENCH_SUFFIX ? ` ${process.env.BENCH_SUFFIX}` : '';
mkdirSync(OUT, { recursive: true });

const ALL_TOPICS = [
  { id: 'tcp', text: 'the TCP three-way handshake and four-way teardown' },
  { id: 'cache', text: 'Redis vs Memcached for caching, and which one to choose' },
  { id: 'git', text: 'git merge vs git rebase, and how each one changes history' },
];
const TOPICS = ONLY ? ALL_TOPICS.filter((t) => ONLY.includes(t.id)) : ALL_TOPICS;

const MODES = {
  plain: {
    prompt: (t) => `Explain ${t} as a single self-contained HTML page: inline CSS, SVG diagrams where useful, no external resources. Save it to ./out.html with the Write tool. Do not use any skills. Then reply with one short sentence.`,
    args: ['--allowedTools', 'Write', '--disallowedTools', 'Skill', 'Bash'],
  },
  skill: {
    prompt: (t) => `Explain ${t}. Use the answer-me-with-html skill to make the page, and render it with -o ./out.html --no-open. Then reply with one short sentence.`,
    args: ['--allowedTools', 'Skill', 'Bash', 'Read'],
  },
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// 每个题目 × 方式取中位数；overall 为三题中位数的平均。
function summarize(rows) {
  const ok = rows.filter((r) => r.ok);
  const by = {};
  for (const r of ok) (by[`${r.topic}/${r.mode}`] ??= []).push(r);
  const perTopic = Object.fromEntries(Object.entries(by).map(([k, rs]) => [k, {
    runs: rs.length,
    outputTokens: median(rs.map((r) => r.outputTokens)),
    seconds: median(rs.map((r) => r.seconds)),
    costUSD: median(rs.map((r) => r.costUSD)),
    turns: median(rs.map((r) => r.turns)),
  }]));
  const overall = {};
  for (const mode of Object.keys(MODES)) {
    const vals = Object.entries(perTopic).filter(([k]) => k.endsWith(`/${mode}`)).map(([, v]) => v);
    overall[mode] = Object.fromEntries(['outputTokens', 'seconds', 'costUSD', 'turns'].map((m) => [m, vals.reduce((n, v) => n + v[m], 0) / (vals.length || 1)]));
  }
  return { perTopic, overall };
}

const sum = (obj, key) => Object.values(obj || {}).reduce((n, m) => n + (m[key] || 0), 0);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function runOnce(topic, cfg) {
  const work = mkdtempSync(join(tmpdir(), `bench-${topic.id}-`));
  const home = join(work, '.am');
  mkdirSync(home);
  writeFileSync(join(home, 'config.json'), JSON.stringify({ always: false, open: false }));
  const started = Date.now();
  const r = spawnSync('claude', ['-p', '--model', MODEL, '--output-format', 'json', '--permission-mode', 'acceptEdits', ...cfg.args, '--', cfg.prompt(topic.text) + SUFFIX], {
    cwd: work, encoding: 'utf8', env: { ...process.env, AM_HOME: home, AM_NO_OPEN: '1' }, maxBuffer: 64 * 1024 * 1024,
  });
  let result = {};
  try {
    const events = JSON.parse(r.stdout);
    result = (Array.isArray(events) ? events : [events]).find((e) => e.type === 'result') || {};
  } catch {
    result = { is_error: true, result: (r.stderr || r.stdout || '').slice(0, 300) };
  }
  return { work, result, wall: Date.now() - started };
}

const rows = [];
for (let rep = 1; rep <= REPS; rep++) for (const topic of TOPICS) {
  for (const [mode, cfg] of Object.entries(MODES)) {
    let attempt = 0;
    let run;
    let ok = false;
    do {
      if (attempt) sleep(30000);
      attempt++;
      run = runOnce(topic, cfg);
      ok = existsSync(join(run.work, 'out.html')) && !run.result.is_error;
    } while (!ok && attempt < 3);
    const { work, result, wall } = run;
    const page = join(work, 'out.html');
    if (ok) copyFileSync(page, join(OUT, `${topic.id}-${mode}-${rep}.html`));
    const row = {
      topic: topic.id, mode, rep, ok, attempts: attempt,
      outputTokens: sum(result.modelUsage, 'outputTokens'),
      seconds: Math.round((result.duration_ms || wall) / 100) / 10,
      costUSD: Math.round((result.total_cost_usd || 0) * 10000) / 10000,
      turns: result.num_turns,
      htmlBytes: ok ? statSync(page).size : 0,
      ...(ok ? {} : { apiError: result.api_error_status, denials: result.permission_denials, reply: String(result.result || '').slice(0, 200) }),
    };
    rows.push(row);
    process.stdout.write(`${JSON.stringify(row)}\n`);
    writeFileSync(join(OUT, 'results.json'), `${JSON.stringify({ model: MODEL, date: new Date().toISOString(), reps: REPS, rows, summary: summarize(rows) }, null, 2)}\n`);
    sleep(15000);
  }
}
