#!/usr/bin/env node
// answer-me 高频模式：UserPromptSubmit 时注入一句提醒（约 90 token），让 Agent 给出结论时顺手出一页 HTML。
// 只输出提醒，不读取、不记录用户输入。

export const REMINDER = [
  '[answer-me always-on] Whenever this reply states a conclusion, recommendation, summary, plan, comparison,',
  'review or explanation - even a short one - also render a small answer-me page (2-4 panels, use the',
  'answer-me skill, render with --no-open so no browser window pops up) and end the reply with the page path.',
  'Do not skip it because the answer seems short.',
  'Skip only for casual chat, a one- or two-sentence reply with no conclusion, pure command output,',
  'or when the user asks for plain text.',
].join(' ');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: REMINDER },
}));
