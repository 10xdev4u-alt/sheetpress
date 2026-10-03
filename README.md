# SheetPress

Markdown in, single-file HTML explainer page out.

SheetPress takes a short Markdown draft and renders it as a self-contained,
single-file HTML page: panel layout, themes, light/dark mode, and diagrams
with computed (not hand-drawn) SVG coordinates. Each page embeds the Markdown
source it was built from, so any page can be copied back and re-rendered.

SheetPress is library-first. Use it from JavaScript:

```js
import { renderDoc } from 'sheetpress';

const { html, warnings, stats } = renderDoc(`---
title: TCP three-way handshake
---
## Handshake {span=2}
\`\`\`sequence
Client -> Server: SYN, seq=x
Server -> Client: SYN+ACK, seq=y, ack=x+1
Client -> Server: ACK, ack=y+1
\`\`\`
`);

await Bun.write('out.html', html);
```

It also ships with a CLI for terminal use and with an agent skill that lets a
coding assistant write the draft and render the page for you.

> Also available in [Simplified Chinese](README.zh-CN.md).
> This project is a fork of
> [QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html).
> See [License](#license) for attribution.

Project home: https://github.com/10xdev4u-alt/sheetpress

## Why SheetPress

A model that hand-writes a full HTML page must type every line of CSS, every
wrapper element, and every SVG coordinate. That costs output tokens, and output
tokens are what you wait for.

With SheetPress the model writes only the content, a short Markdown draft
(around 900 output tokens in our measurements instead of around 7,000). The
library handles layout, color, and drawing. See [Benchmark](#benchmark) for
numbers and [bench/README.md](bench/README.md) for the full methodology.

## Install

Requires Node.js 20 or newer.

```bash
npm install sheetpress
```

Or clone the repository:

```bash
git clone https://github.com/10xdev4u-alt/sheetpress.git
cd sheetpress
npm install
```

No global install is required. The CLI is included in the package.

## Quickstart

### Library

```js
import { renderDoc } from 'sheetpress';
import { writeFileSync } from 'node:fs';

const source = `---
title: Redis or Memcached?
template: sheet
theme: blueprint
cols: 3
---
Pick Redis for rich data structures and persistence; pick Memcached for a simple shared cache.

## Verdict
\`\`\`callout
Redis wins unless you only need plain key/value caching.
\`\`\`

## Comparison
| Aspect | Redis | Memcached |
| :--- | :--- | :--- |
| Data structures | ok | no |
| Persistence | ok | no |
| Simplicity | warn | ok |
`;

const { html, warnings, stats } = renderDoc(source);
writeFileSync('compare.html', html);

if (warnings.length) console.log(warnings);
console.log(stats); // e.g. { panels: 2, components: { callout: 1 } }
```

`renderDoc(source, overrides, defaults)` returns `{ html, warnings, stats, meta }`:

- `html` is the complete page as a string. Write it anywhere; it has no
  external dependencies (no CDN links, no web fonts) and opens offline.
- `warnings` lists findings from the STE controlled-writing check.
  Pass `style: 'off'` in the frontmatter (or overrides) to skip it, or
  `style: 'strict'` to throw instead of warning.
- `overrides` lets you set `theme`, `template`, `mode`, or `style` per render
  without editing the source.

Related entry points: `sheetpress/render`, `sheetpress/parse`,
`sheetpress/lint`, `sheetpress/components`.

### CLI

The package exposes three binary names for the same CLI: `sheetpress`, `sp`,
and `am`. After a local install, run it with `npx`:

```bash
npx sheetpress render notes.md -o out.html --no-open
npx sheetpress render notes.md --theme shadcn
npx sheetpress lint notes.md
npx sheetpress list
npx sheetpress config
```

Read from stdin (this is how agents call it):

```bash
npx sheetpress render - <<'EOF'
## One panel
```flow
A -> B: hello
```
EOF
```

Run `npx sheetpress help <component>` for a component's syntax, or
`npx sheetpress help format` for the full draft format. Rendered pages are
saved to a pages folder under your home directory unless `-o` is given; set
the `AM_HOME` environment variable to move it.

## Draft format

Every `##` heading becomes a panel. The frontmatter controls the page:

```markdown
---
template: sheet        # sheet = panel grid (default), doc = single column with a table of contents
theme: blueprint       # blueprint or shadcn
title: Page title
subtitle: One line
cols: 3                # columns for the sheet template
source: RFC 9293       # any other field is shown under the title
---
One or two sentences with the main point.

## A Panel title {span=2 meta="small text, top right"}
Plain Markdown: paragraphs, lists, tables.

```flow LR
A -> B: label
```
```

- `span=2` makes a panel two columns wide, `rows=2` makes it two rows tall,
  and `bare` removes its title bar. The leading letters (A, B, C) are optional
  and are added automatically.
- When no component fits, embed raw markup in an `html` or `svg` fenced block.

See [examples/](examples/) for complete drafts, e.g.
[examples/tcp.en.md](examples/tcp.en.md).

## Components

The author picks a component by the shape of the information:

| Component | Good for |
| :--- | :--- |
| `flow` | Architecture, call chains, decision branches. Automatic layout with groups, decisions, and databases |
| `sequence` | Messages passed between parties over time |
| `tree` | Folders, modules, taxonomies |
| `timeline` | History, releases, phases |
| `limits` | A value against its limit |
| `annot` | Word-by-word notes on a sentence |
| `kv` | Metadata, a drawing title block |
| `callout` | A conclusion, a tip, a warning |
| Table | Multi-way comparison. Write `ok` / `no` / `warn` in a cell for a check, cross, or alert mark |
| `html` / `svg` | Raw markup embedded as-is (escape hatch) |

If a draft has an error, rendering fails with the line number, the component
name, and a correct example, so the author (human or agent) can fix it in one
pass.

## Templates and themes

Two templates:

| Template | Layout |
| :--- | :--- |
| `sheet` (default) | Grid of lettered panels, best for a one-screen overview |
| `doc` | Single column with a table of contents (shown when there are 3+ panels), best for a linear explanation |

Two themes, each with light and dark modes (`mode: auto`, `light`, or `dark`;
`auto` follows the operating system setting, and the reader can switch theme
and mode from buttons on the page):

| Theme | Look |
| :--- | :--- |
| `blueprint` | Engineering drawing style |
| `shadcn` | Clean cards style |

Set defaults with config (see below) or per page with `theme:` / `template:` /
`mode:` in the frontmatter. A value written in the draft beats the default; a
CLI flag beats the draft for that run.

## Config

View or change settings with the `config` command. There is no need to edit
files by hand.

| Key | Default | What it does |
| :--- | :--- | :--- |
| `open` | `on` | Open each page in the browser after rendering. Turn it off if pop-ups interrupt you |
| `always` | `on` | Always-on mode (see below). Only matters when the always-on plugin is installed |
| `theme` | `blueprint` | Default theme: `blueprint` or `shadcn` |
| `mode` | `auto` | Default color mode: `auto`, `light`, or `dark` |
| `style` | `80` | Writing check: `off`, `80` (warn only), or `strict` (refuse to render) |

```bash
npx sheetpress config            # view settings
npx sheetpress config set open off
npx sheetpress config reset      # restore defaults
```

`--open` and `--no-open` on `render` affect one run only.

Details for agent-driven configuration are in
[commands/config.md](commands/config.md).

## Agent skill install

SheetPress ships as an agent skill: the assistant writes a short Markdown
draft and hands it to the bundled CLI, which renders the page (this is where
the token savings come from).

### Let your agent install it (recommended)

Paste this into Claude Code, Codex, Cursor, OpenCode, or any other agent:

> Install the SheetPress skill: run `npx -y skills add 10xdev4u-alt/sheetpress -g -y`,
> and pass `-a` with your own agent name (for Claude Code, `-a claude-code`).
> Then read its SKILL.md and use it to make a page that explains the TCP
> three-way handshake, so we know it works.

### One command

```bash
npx skills add 10xdev4u-alt/sheetpress
```

It asks which agents to install into. The installer supports 70+ agents.

### Claude Code plugin

Run this inside Claude Code:

```
/plugin marketplace add 10xdev4u-alt/sheetpress
/plugin install sheetpress@sheetpress
```

### Manual install

Copy the `skills/sheetpress` folder into your agent's skill folder. For
Claude Code:

```bash
git clone --depth 1 https://github.com/10xdev4u-alt/sheetpress.git /tmp/sheetpress
cp -R /tmp/sheetpress/skills/sheetpress ~/.claude/skills/sheetpress
```

Skill folders for other agents: Codex `~/.codex/skills/`, Cursor
`~/.cursor/skills/`, OpenCode `~/.config/opencode/skill/`.

No setup is needed after install.

### Always-on mode (optional)

By default, the agent makes a page only for questions that need one. If you
want a page with every conclusion, install the companion plugin:

```
/plugin marketplace add 10xdev4u-alt/sheetpress
/plugin install sheetpress-always@sheetpress
```

The agent then gets a short reminder each turn (about 90 tokens). Whenever it
gives a conclusion, summary, plan, or comparison, even a short one, it adds a
small page with 2 to 4 panels and puts the path at the end of the reply. These
pages never pop open, so they do not interrupt you. Pause it with
`config always off`; you do not need to uninstall.

## Benchmark

Same questions, same model both ways (3 topics x 3 runs each, medians, Claude
Sonnet 5.5). Full methodology and reproduction script: [bench/](bench/README.md).

| | Ask for HTML directly | SheetPress | |
| :--- | ---: | ---: | :--- |
| Output tokens | 6,873 | 923 | 7.4x fewer |
| Time | 46 s | 13 s | 3.6x faster |
| Cost per answer | $0.22 | $0.26 | about the same |

Cost does not drop because the skill adds two short turns (loading the skill,
running the CLI), and every turn re-reads the conversation context. You save
the waiting, not the bill.

## Development

```bash
git clone https://github.com/10xdev4u-alt/sheetpress.git && cd sheetpress
npm install
npm test          # run the tests
npm run build     # rebuild the bundled CLI after changing src/
```

There are two runtime dependencies:
[marked](https://github.com/markedjs/marked) parses Markdown and
[@dagrejs/dagre](https://github.com/dagrejs/dagre) lays out flow charts.

## License

[MIT](LICENSE). SheetPress is a fork of
[QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html);
the original work is credited in the LICENSE file. This fork is maintained at
https://github.com/10xdev4u-alt/sheetpress.
