#!/usr/bin/env node
// sheetpress-always: on UserPromptSubmit, inject a short reminder (~90 tokens) so the agent attaches a one-page HTML with its conclusions.
// Emits only the reminder; never reads or logs user input. Once the user runs `am config set always off`, it emits nothing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const REMINDER = [
  '[sheetpress always-on] Whenever this reply states a conclusion, recommendation, summary, plan, comparison,',
  'review or explanation - even a short one - also render a small SheetPress page (2-4 panels, use the',
  'sheetpress skill, render with --no-open so no browser window pops up) and end the reply with the page path.',
  'Do not skip it because the answer seems short.',
  'Skip only for casual chat, a one- or two-sentence reply with no conclusion, pure command output,',
  'or when the user asks for plain text.',
].join(' ');

// Reads the same file as src/config.js; only this directory is available once the plugin is installed, so a minimal implementation is inlined here.
function alwaysEnabled() {
  const file = join(process.env.SHEETPRESS_HOME || process.env.AM_HOME || join(homedir(), '.sheetpress'), 'config.json');
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
