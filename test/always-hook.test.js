import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'));

test('always 插件：hook 输出合法的 UserPromptSubmit additionalContext', () => {
  const r = spawnSync(process.execPath, [`${ROOT}/plugins/answer-me-always/hooks/remind.mjs`], {
    input: '{"prompt":"讲讲 TCP"}', encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /^\[answer-me always-on\]/);
  assert.ok(out.hookSpecificOutput.additionalContext.length < 600, '提醒要短，每轮都会注入');
});

test('always 插件：hooks.json 指向存在的脚本，marketplace 已登记', () => {
  const hooks = read('plugins/answer-me-always/hooks/hooks.json');
  const cmd = hooks.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(cmd.command, 'node');
  assert.equal(cmd.args[0], '${CLAUDE_PLUGIN_ROOT}/hooks/remind.mjs');
  const names = read('.claude-plugin/marketplace.json').plugins.map((p) => p.name);
  assert.deepEqual(names, ['answer-me', 'answer-me-always']);
});

test('SKILL.md 说明了高频模式的提醒标记', () => {
  assert.match(readFileSync(`${ROOT}/skills/answer-me/SKILL.md`, 'utf8'), /\[answer-me always-on\]/);
});

test('always 插件：提醒要求 --no-open，不弹浏览器', () => {
  const r = spawnSync(process.execPath, [`${ROOT}/plugins/answer-me-always/hooks/remind.mjs`], { encoding: 'utf8' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /--no-open/);
});
