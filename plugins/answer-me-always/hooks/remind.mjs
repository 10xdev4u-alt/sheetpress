#!/usr/bin/env node
// answer-me 高频模式：UserPromptSubmit 时注入一句提醒（约 70 token），让 Agent 给出结论时顺手出一页 HTML。
// 只输出提醒，不读取、不记录用户输入。

export const REMINDER = [
  '[answer-me always-on] If this reply gives a conclusion, summary, plan, comparison, review or explanation,',
  'also render an answer-me page (use the answer-me skill) and end the reply with the page path.',
  'Keep routine pages small (2-4 panels). Skip only for casual chat, one-line answers,',
  'pure command output, or when the user asks for plain text.',
].join(' ');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: REMINDER },
}));
