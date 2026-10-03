// Component syntax error. `line` is the 1-based line number relative to the fenced-block content; render.js maps it back to the source file line.
export class ComponentError extends Error {
  constructor(message, line = 0) {
    super(message);
    this.name = 'ComponentError';
    this.line = line;
  }
}

// Split fenced-block text into non-empty lines, keeping relative line numbers; supports full-line comments starting with #.
export function contentLines(text) {
  return String(text)
    .split('\n')
    .map((raw, i) => ({ raw, text: raw.trim(), line: i + 1 }))
    .filter((l) => l.text && !l.text.startsWith('//'));
}

// Split fields on | and trim surrounding whitespace.
export function fields(text) {
  return text.split('|').map((s) => s.trim());
}
