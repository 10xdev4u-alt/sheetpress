// SVG layout is computed in Node, where real font metrics are unavailable, so width is estimated by character class.
// Overestimating is safer than underestimating: prefer whitespace inside nodes over text overflowing its border.

const CJK_RE = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/;
const NARROW = new Set([...'iljtfrI.,:;|!\'`()[]{}']);
const WIDE = new Set([...'mwMWOQGD@%&']);

export function isCJK(ch) {
  return CJK_RE.test(ch);
}

function charWidth(ch, mono) {
  if (isCJK(ch)) return 1;
  if (mono) return 0.6;
  if (ch === ' ') return 0.3;
  if (NARROW.has(ch)) return 0.32;
  if (WIDE.has(ch)) return 0.86;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  return 0.56;
}

export function measure(str, size = 13, { mono = false } = {}) {
  let units = 0;
  for (const ch of String(str ?? '')) units += charWidth(ch, mono);
  return Math.round(units * size * 100) / 100;
}

// Split into indivisible layout units: one CJK character is a unit, one run of non-whitespace Latin characters is a unit.
function tokenize(str) {
  return String(str).match(/[⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]|[^\s⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]+|\s+/g) ?? [];
}

export function wrap(str, maxWidth, size = 13, opts = {}) {
  const lines = [];
  let line = '';
  for (const tok of tokenize(str)) {
    if (/^\s+$/.test(tok)) {
      if (line) line += ' ';
      continue;
    }
    const candidate = line + tok;
    if (line.trim() && measure(candidate, size, opts) > maxWidth) {
      lines.push(line.trimEnd());
      line = tok;
    } else {
      line = candidate;
    }
  }
  lines.push(line.trimEnd());
  return lines;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}
