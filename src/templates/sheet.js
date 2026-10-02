// sheet：图纸板。字母编号面板排成网格；blueprint 主题下外框带坐标刻度（纯装饰，无交互）。
import { panelHtml, headHtml } from './panel.js';

const ruler = (side, labels) =>
  `<div class="am-ruler am-ruler--${side}" aria-hidden="true">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;

export function sheet({ meta, introHtml, panels }) {
  const cols = Math.max(1, Math.min(Number(meta.cols) || 3, 12));
  const nums = Array.from({ length: 8 }, (_, i) => i + 1);
  const letters = ['A', 'B', 'C', 'D'];
  return `<main class="am-sheet">
${headHtml(meta, introHtml)}
<div class="am-frame">
${ruler('top', nums)}${ruler('bottom', nums)}${ruler('left', letters)}${ruler('right', letters)}
<div class="am-grid" style="--cols: ${cols}">
${panels.map((p) => panelHtml(p, { cols })).join('\n')}
</div>
</div>
</main>`;
}
