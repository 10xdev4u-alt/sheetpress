import { mdInline } from '../markdown.js';
import { esc } from '../svg/text.js';
import { ComponentError, contentLines } from './error.js';
import { parseAttrs } from '../parse.js';

export default {
  name: 'kv',
  summary: 'Key-value grid / header bar (metadata)',
  syntax: `\`\`\`kv [cols=2]
Key: value
* Wide key: value   ← leading *: spans the full row in a larger size
\`\`\`
- Split on the first colon (: or ：); values may contain more colons.`,
  example: '```kv cols=2\n* Title: Simplified Technical English\nSpecification: ASD-STE100\nOwner: ASD\n```',
  render(text, { args }) {
    const cols = Math.max(1, Math.min(Number(parseAttrs(args).cols) || 2, 6));
    const cells = contentLines(text).map(({ text: t, line }) => {
      const wide = t.startsWith('*');
      const body = wide ? t.slice(1).trim() : t;
      const m = body.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (!m) throw new ComponentError(`kv line is missing a colon: "${t}", expected Key: value`, line);
      return `<div class="am-kv-cell${wide ? ' am-kv-cell--wide' : ''}"><dt>${esc(m[1].trim())}</dt><dd>${mdInline(m[2])}</dd></div>`;
    });
    if (!cells.length) throw new ComponentError('kv needs at least one Key: value line', 1);
    return `<dl class="am-kv" style="--kv-cols: ${cols}">${cells.join('')}</dl>`;
  },
};
