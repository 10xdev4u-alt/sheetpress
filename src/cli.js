// am CLI: render / lint / list / help. main() accepts injected streams and env for testing.

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { VERSION } from './assets.js';
import { join, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { renderDoc, RenderError, LintError } from './render.js';
import { parseDoc, ParseError, CHOICES } from './parse.js';
import { lintDoc, formatWarning } from './lint/ste.js';
import { COMPONENTS } from './components/index.js';
import { THEMES } from './themes/index.js';
import { amHome, readConfig, setConfig, resetConfig, CONFIG_KEYS, ConfigError } from './config.js';

const MAX_LISTED_WARNINGS = 20;

const USAGE = `Answer me with HTML ${VERSION} — render a Markdown brief into a single-file HTML explainer page

Usage:
  am render <file|->  [-o output-path] [--no-open] [--theme blueprint|shadcn]
                      [--template sheet|doc] [--style off|80|strict] [--mode auto|light|dark]
  am lint   <file|->  [--style off|80|strict]     STE controlled-writing check only
  am config [set <key> <value> | get <key> | reset [key]] Show or change settings
  am list                                         List templates, themes, and components
  am help [component|format]                      Show component syntax / brief format

- Pass - as the file argument to read from stdin (works with heredoc: am render - <<'EOF' ... EOF).
- Output defaults to ~/.answer-me-with-html/pages/ (override with the AM_HOME env var).
- Browser auto-open, the default theme, and similar settings use am config; --open / --no-open apply to this run only.`;

const FORMAT = `Brief format (extended Markdown)

---
template: sheet        # sheet blueprint board (default, multi-panel grid) | doc linear explainer (single column + TOC)
theme: blueprint       # blueprint drafting style (default) | shadcn card style; switchable in-page
title: Page title       # or use the first "# Title" line of the body instead
subtitle: Subtitle     # optional
cols: 3                # sheet grid columns, default 3
style: 80              # STE check strictness: off | 80 (default, warnings only) | strict (no output when failing)
mode: auto             # auto follows system | light | dark
source: asd-ste100.org # any other key shows in the header meta line
---
Lede (optional, shown below the title)

## A Panel title {span=2 meta="top-right note"}
Plain Markdown: paragraphs, lists, tables, quotes, inline code…
Table cells starting with ok / no / warn (optionally followed by text, e.g. "ok Approved") render as ✓ / ✗ / ! badges.

\`\`\`flow LR          ← fence language name = component name, followed by component args
A -> B
\`\`\`

\`\`\`html             ← html / svg fences are embedded as-is (escape hatch)
<div>Arbitrary content</div>
\`\`\`

- "## " starts a panel; the letter ID is optional (auto-assigned A, B, C…). span makes a panel span columns.
- See am list for the component list; see am help <component> for one component's syntax.`;

export async function main(argv, io = {}) {
  const out = io.stdout ?? process.stdout;
  const err = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;
  const print = (s = '') => out.write(`${s}\n`);
  const fail = (s) => err.write(`${s}\n`);

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o' },
        'no-open': { type: 'boolean' },
        open: { type: 'boolean' },
        theme: { type: 'string' },
        template: { type: 'string' },
        style: { type: 'string' },
        mode: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (e) {
    fail(`✗ ${e.message}\n\n${USAGE}`);
    return 2;
  }
  const { values: opts, positionals: [cmd, arg, ...rest] } = parsed;

  if (opts.version) return print(VERSION), 0;
  if (opts.help || !cmd) return print(USAGE), 0;

  switch (cmd) {
    case 'render': return withSource(arg, io, fail, (src) => cmdRender(src, opts, { print, fail, env, cwd: io.cwd }));
    case 'lint': return withSource(arg, io, fail, (src) => cmdLint(src, opts, { print, fail }));
    case 'config': return cmdConfig([arg, ...rest].filter((x) => x !== undefined), { print, fail, env });
    case 'list': return cmdList(print), 0;
    case 'help': return cmdHelp(arg, { print, fail });
    default:
      fail(`✗ Unknown command "${cmd}"\n\n${USAGE}`);
      return 2;
  }
}

async function withSource(arg, io, fail, fn) {
  if (!arg) {
    fail('✗ Missing brief argument: pass a file path, or - to read from stdin');
    return 2;
  }
  let src;
  try {
    src = arg === '-' ? await readStream(io.stdin ?? process.stdin) : readFileSync(resolve(io.cwd ?? process.cwd(), arg), 'utf8');
  } catch (e) {
    fail(`✗ Cannot read brief: ${e.message}`);
    return 2;
  }
  if (!src.trim()) {
    fail('✗ Brief is empty');
    return 2;
  }
  return fn(src);
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Auto-open precedence: --open forces open > --no-open > AM_NO_OPEN (non-0) > CI env > open setting.
export function shouldOpen(opts, env, config) {
  if (opts.open) return true;
  if (opts['no-open']) return false;
  if (env.AM_NO_OPEN && env.AM_NO_OPEN !== '0') return false;
  if (env.CI) return false;
  return config.open !== false;
}

function cmdRender(src, opts, { print, fail, env, cwd }) {
  const config = readConfig(env);
  if (config.warning) fail(`! ${config.warning}`);
  const { theme, mode, style } = config.values;
  let result;
  try {
    result = renderDoc(src, { theme: opts.theme, template: opts.template, style: opts.style, mode: opts.mode }, { theme, mode, style });
  } catch (e) {
    return reportError(e, fail);
  }
  const file = opts.out
    ? resolve(cwd ?? process.cwd(), opts.out)
    : join(amHome(env), 'pages', `${slug(result.meta.title)}-${stamp()}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, result.html);

  const comps = Object.entries(result.stats.components).map(([k, v]) => `${k}×${v}`).join(' ');
  print(`✓ ${file}`);
  print(`  ${result.meta.template} · ${result.meta.theme} · ${result.stats.panels} panels${comps ? ` · ${comps}` : ''}`);
  printWarnings(result.warnings, print, result.meta.style);
  if (shouldOpen(opts, env, config.values)) openFile(file);
  return 0;
}

function cmdLint(src, opts, { print, fail }) {
  let doc;
  try {
    doc = parseDoc(src);
  } catch (e) {
    return reportError(e, fail);
  }
  const style = opts.style ?? doc.meta.style;
  if (!CHOICES.style.includes(style)) {
    fail(`✗ Invalid value "${style}" for style, expected: ${CHOICES.style.join(' | ')}`);
    return 2;
  }
  const warnings = style === 'off' ? [] : lintDoc(doc);
  printWarnings(warnings, print, style);
  return style === 'strict' && warnings.length ? 1 : 0;
}

function printWarnings(warnings, print, style) {
  if (style === 'off') return print('  STE checks off');
  if (!warnings.length) return print('  STE ✓ 0 warnings');
  print(`  STE ${warnings.length} warnings (fix the brief and re-run):`);
  warnings.slice(0, MAX_LISTED_WARNINGS).forEach((w) => print(`  ${formatWarning(w)}`));
  if (warnings.length > MAX_LISTED_WARNINGS) print(`  … ${warnings.length - MAX_LISTED_WARNINGS} more; run am lint to see all`);
}

function reportError(e, fail) {
  if (e instanceof RenderError) {
    fail(`✗ L${e.line} [${e.component}] ${e.message}`);
    if (e.example) fail(`  Correct example:\n${e.example.replace(/^/gm, '    ')}`);
    fail(`  Full syntax: am help ${e.component}`);
    return 1;
  }
  if (e instanceof ParseError) {
    fail(`✗ ${e.line ? `L${e.line} ` : ''}Failed to parse brief: ${e.message}`);
    return 1;
  }
  if (e instanceof LintError) {
    fail(`✗ ${e.message}, no page generated:`);
    e.warnings.forEach((w) => fail(`  ${formatWarning(w)}`));
    return 1;
  }
  throw e;
}

const showValue = (v) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v));

function cmdConfig(args, { print, fail, env }) {
  const [action, key, value] = args;
  try {
    if (action === 'set') {
      if (key === undefined || value === undefined) throw new ConfigError('Usage: am config set <key> <value>');
      print(`✓ ${key} = ${showValue(setConfig(key, value, env))}`);
      return 0;
    }
    if (action === 'get') {
      if (!CONFIG_KEYS[key]) throw new ConfigError(`No such setting "${key}". Available: ${Object.keys(CONFIG_KEYS).join(' | ')}`);
      print(showValue(readConfig(env).values[key]));
      return 0;
    }
    if (action === 'reset') {
      resetConfig(key, env);
      print(key ? `✓ ${key} reset to default` : '✓ All settings reset to defaults');
      return 0;
    }
    if (action !== undefined) throw new ConfigError(`Unknown action "${action}". Usage: am config [set <key> <value> | get <key> | reset [key]]`);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    fail(`✗ ${e.message}`);
    return 2;
  }
  const { values, stored, warning, path } = readConfig(env);
  if (warning) fail(`! ${warning}`);
  print(`Config file: ${path}`);
  for (const [k, spec] of Object.entries(CONFIG_KEYS)) {
    const mark = k in stored ? '*' : ' ';
    const options = spec.type === 'bool' ? 'on | off' : spec.choices.join(' | ');
    print(`${mark} ${k.padEnd(7)}${showValue(values[k]).padEnd(10)}${spec.label} (${options})`);
  }
  if (env.AM_NO_OPEN && env.AM_NO_OPEN !== '0') print('Note: the AM_NO_OPEN env var is set and overrides the open setting.');
  print('* = value you changed. Change: am config set <key> <value>; reset: am config reset [key]');
  return 0;
}

function cmdList(print) {
  print('Templates (template):');
  print('  sheet   Blueprint board: letter-labeled panel grid, good for a single-screen overview (default)');
  print('  doc     Linear explainer: single-column reading, with a TOC at 3+ panels');
  print('\nThemes (theme):');
  for (const [name, t] of Object.entries(THEMES)) print(`  ${name.padEnd(10)}${t.label}`);
  print('\nComponents (fence language name):');
  for (const c of COMPONENTS.values()) print(`  ${c.name.padEnd(10)}${c.summary}`);
  print('  html/svg  Embedded as-is (escape hatch)');
  print('\nSyntax: am help <component>; brief format: am help format');
}

function cmdHelp(name, { print, fail }) {
  if (!name) return print(USAGE), 0;
  if (name === 'format') return print(FORMAT), 0;
  const comp = COMPONENTS.get(name);
  if (!comp) {
    fail(`✗ No component "${name}". Available: ${[...COMPONENTS.keys()].join(', ')}, format`);
    return 2;
  }
  print(`${comp.name} — ${comp.summary}\n\n${comp.syntax}\n\nExample:\n${comp.example}`);
  return 0;
}

function slug(title) {
  const s = String(title || 'page').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || 'page';
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function openFile(file) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [file]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
      : ['xdg-open', [file]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch {
    // A browser open failure does not affect the output; the path is already printed.
  }
}
