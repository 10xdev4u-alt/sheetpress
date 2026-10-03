#!/usr/bin/env node
// answer-me-with-html 高频模式：UserPromptSubmit 时注入一句提醒（约 90 token），让 Agent 给出结论时顺手出一页 HTML。
// 只输出提醒，不读取、不记录用户输入。用户用 `am config set always off` 关闭后，什么都不输出。
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const REMINDER = [
  '[answer-me-with-html always-on] Whenever this reply states a conclusion, recommendation, summary, plan, comparison,',
  'review or explanation - even a short one - also render a small answer-me-with-html page (2-4 panels, use the',
  'answer-me-with-html skill, render with --no-open so no browser window pops up) and end the reply with the page path.',
  'Do not skip it because the answer seems short.',
  'Skip only for casual chat, a one- or two-sentence reply with no conclusion, pure command output,',
  'or when the user asks for plain text.',
].join(' ');

// 与 src/config.js 读取同一个文件；插件安装后只有本目录可用，所以这里内联一份最小实现。
function alwaysEnabled() {
  const file = join(process.env.AM_HOME || join(homedir(), '.answer-me-with-html'), 'config.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')).always !== false;
  } catch {
    return true;
  }
}

if (alwaysEnabled()) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: REMINDER },
  }));
}
