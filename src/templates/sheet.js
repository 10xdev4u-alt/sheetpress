// sheet: blueprint board. Lettered panels laid out in a grid; under the blueprint theme the outer frame carries coordinate rulers (pure decoration, no interaction).
import { panelHtml, headHtml } from './panel.js';

const ruler = (side, labels) =>
  `<div class="am-ruler am-ruler--${side}" aria-hidden="true">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;

// Simulate the grid in reading order: when the remaining columns in a row cannot fit the next panel, stretch the current one to fill the row and avoid gaps.
// When a panel spans rows via `rows`, row occupancy gets complex, so keep the author's layout as-is.
export function fillRows(panels, cols) {
  const spans = panels.map((p) => Math.max(1, Math.min(Number(p.attrs.span) || 1, cols)));
  if (panels.some((p) => Number(p.attrs.rows) > 1)) return spans;
  let used = 0;
  return spans.map((span, i) => {
    if (used + span > cols) used = 0;
    used += span;
    const next = spans[i + 1];
    const fill = next === undefined || used + next > cols ? cols - used : 0;
    used = fill || used === cols ? 0 : used;
    return span + fill;
  });
}

export function sheet({ meta, introHtml, panels }) {
  const cols = Math.max(1, Math.min(Number(meta.cols) || 3, 12));
  const spans = fillRows(panels, cols);
  const placed = panels.map((p, i) => ({ ...p, attrs: { ...p.attrs, span: spans[i] } }));
  const nums = Array.from({ length: 8 }, (_, i) => i + 1);
  const letters = ['A', 'B', 'C', 'D'];
  return `<main class="am-sheet">
${headHtml(meta, introHtml)}
<div class="am-frame">
${ruler('top', nums)}${ruler('bottom', nums)}${ruler('left', letters)}${ruler('right', letters)}
<div class="am-grid" style="--cols: ${cols}">
${placed.map((p) => panelHtml(p, { cols })).join('\n')}
</div>
</div>
</main>`;
}
