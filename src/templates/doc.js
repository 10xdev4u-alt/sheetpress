// doc: linear explainer. Single-column reading; with 3+ panels, a table of contents is shown on the left.
import { panelHtml, headHtml } from './panel.js';
import { esc } from '../svg/text.js';

export function doc({ meta, introHtml, panels }) {
  const withToc = panels.length >= 3;
  const toc = withToc
    ? `<nav class="am-toc" aria-label="Contents">${panels.map((p) => `<a href="#panel-${esc(p.id)}">${esc(p.id)} · ${esc(p.title)}</a>`).join('')}</nav>`
    : '';
  return `<main class="am-doc">
${headHtml(meta, introHtml)}
<div class="am-doc-layout${withToc ? '' : ' am-doc-layout--notoc'}">
${toc}<div class="am-doc-body">
${panels.map((p) => panelHtml(p, { grid: false })).join('\n')}
</div>
</div>
</main>`;
}
