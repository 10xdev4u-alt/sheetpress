// STE controlled-writing check (constrains the explanatory prose in the brief only).
// Rules: sentence length, paragraph length, discouraged words, English passive voice, Chinese light verbs /
// chained de-particles / set phrases. All are warnings; strictness is set by style.
// Skipped: code and inline code, ~~strikethrough~~ (counter-examples), table rows with a no status,
// headings, and components other than callout.

import { EN_WORDS } from './wordlist.en.js';
import { ZH_LIGHT_VERBS, ZH_CLICHES } from './wordlist.zh.js';
import { isCJK } from '../svg/text.js';

const LIMITS = { zh: { procedural: 35, descriptive: 45 }, en: { procedural: 20, descriptive: 25 } };
const MAX_SENTENCES = 6;
const ABBR = /\b(e\.g|i\.e|etc|vs|cf|approx|Fig|No)\./gi;
const PASSIVE = /\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|known|done|made|given|taken|seen|written|built|shown|sent|kept|held|found|set|put|run|begun|chosen|driven|broken)\b/i;
const EN_RE = Object.entries(EN_WORDS)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([word, suggestion]) => ({ re: new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`, 'gi'), word, suggestion }));

export function splitSentences(text) {
  const masked = text.replace(ABBR, (m) => m.replace(/\./g, '\u0000'));
  const parts = masked.match(/[^。！？；!?;]+?(?:[。！？；!?;]+|\.(?=\s|$)|$)|[^.]+?\.(?=\s|$)/g) ?? [];
  return parts.map((s) => s.replace(/\u0000/g, '.').trim()).filter(Boolean);
}

export function sentenceLength(sentence) {
  const cjk = [...sentence].filter(isCJK).filter((c) => !/[，。！？；：、（）「」『』“”‘’《》]/.test(c)).length;
  const words = sentence.match(/[A-Za-z0-9][\w'’-]*/g)?.length ?? 0;
  return cjk >= 4 || cjk > words ? { lang: 'zh', count: cjk + words } : { lang: 'en', count: words };
}

export function formatWarning(w) {
  return `L${w.line} [${w.rule}] ${w.message}${w.suggestion ? ` → ${w.suggestion}` : ''}`;
}

export function lintDoc(doc) {
  const warnings = [];
  const blocks = [...doc.intro, ...doc.panels.flatMap((p) => p.blocks)];
  for (const b of blocks) {
    if (b.type === 'md') lintMarkdown(b.text, b.line, warnings);
    else if (b.lang === 'callout') lintMarkdown(b.text, b.line + 1, warnings);
  }
  return warnings;
}

function clean(text) {
  return text
    .replace(/~~[^~]*~~/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_]{1,3}/g, '');
}

function lintMarkdown(text, startLine, out) {
  let para = null;
  const flush = () => {
    if (para && para.count > MAX_SENTENCES) {
      out.push({ line: para.line, rule: 'paragraph-length', message: `Paragraph has ${para.count} sentences (max ${MAX_SENTENCES})` });
    }
    para = null;
  };
  let inHtml = false;
  text.split('\n').forEach((raw, i) => {
    const line = startLine + i;
    const t = raw.trim();
    if (/^<(div|svg|table|details|figure)/i.test(t)) inHtml = true;
    if (inHtml) {
      if (/<\/(div|svg|table|details|figure)>\s*$/i.test(t)) inHtml = false;
      return flush();
    }
    if (!t || /^#{1,6}\s/.test(t) || /^[-*_]{3,}$/.test(t)) return flush();
    if (t.startsWith('|')) {
      flush();
      if (/^\|?[\s:|-]+\|?$/.test(t)) return;
      const cells = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.some((c) => /^(no|✗|✘)(\s|$)/.test(c))) return;
      cells.forEach((c) => checkUnit(clean(c.replace(/^(ok|warn|✓|✔|⚠)(\s|$)/, '')), line, 'descriptive', out));
      return;
    }
    const list = t.match(/^(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (list) {
      flush();
      checkUnit(clean(list[3]), line, list[2] ? 'procedural' : 'descriptive', out);
      return;
    }
    const body = clean(t.replace(/^>\s*/, ''));
    const n = checkUnit(body, line, 'descriptive', out);
    if (!para) para = { line, count: 0 };
    para.count += n;
  });
  flush();
}

// Check one unit of text (a list item / cell / one line inside a paragraph); returns the sentence count.
function checkUnit(text, line, kind, out) {
  const sentences = splitSentences(text);
  for (const s of sentences) {
    const { lang, count } = sentenceLength(s);
    const limit = LIMITS[lang][kind];
    if (count > limit) {
      const unit = lang === 'zh' ? 'characters' : 'words';
      const preview = s.length > 24 ? `${s.slice(0, 24)}…` : s;
      out.push({ line, rule: 'sentence-length', message: `${kind === 'procedural' ? 'Step' : 'Sentence'} has ${count} ${unit} (max ${limit}): "${preview}"` });
    }
    if (lang === 'en' && PASSIVE.test(s)) {
      out.push({ line, rule: 'passive', message: `Possible passive voice: "${s.match(PASSIVE)[0]}"`, suggestion: 'Use the active voice' });
    }
  }
  const lexical = [
    ...EN_RE.flatMap(({ re, suggestion }) => [...text.matchAll(re)].map((m) => ({ index: m.index, rule: 'word', message: `Avoid "${m[0]}"`, suggestion }))),
    ...ZH_LIGHT_VERBS.flatMap(({ re, label }) => [...text.matchAll(re)].map((m) => ({ index: m.index, rule: 'word', message: `Weak verb "${m[0]}" (${label})`, suggestion: `Use "${m[1]}" directly` }))),
  ];
  out.push(...lexical.sort((a, b) => a.index - b.index).map(({ index, ...w }) => ({ line, ...w })));
  for (const s of sentences) {
    if ((s.match(/的/g) ?? []).length >= 3) out.push({ line, rule: 'de-chain', message: `Chained 的 particles: ${s}`, suggestion: 'Split the sentence or drop the extra 的' });
  }
  for (const c of ZH_CLICHES) {
    if (text.includes(c)) out.push({ line, rule: 'cliche', message: `Set phrase "${c}"`, suggestion: 'Delete it, or replace with concrete facts' });
  }
  return sentences.length;
}
