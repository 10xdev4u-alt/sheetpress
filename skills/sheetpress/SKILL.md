---
name: sheetpress
description: When an answer is complex, renders it as a one-page visual HTML explainer: the model writes only a short extended-Markdown draft; the bundled CLI handles templates, components, SVG auto-layout and an STE controlled-writing check, producing a single-file page in one call. Also use it when the user says `/sheetpress config` or wants to change settings (auto-open browser, always-on mode, default theme). Use it proactively, without being asked, when the answer involves any of: 3+ interrelated concepts; a flow / protocol / architecture with branches or multiple actors; a comparison or trade-off across 3+ dimensions; a hierarchy (directories, modules, taxonomies); an evolution or phases; or the user says "explain how it works / I do not get it / draw a diagram / explain this codebase / explain visually". Do not use for: short Q&A (clear in under ~150 words), commands to copy and run immediately, pure code changes, or when the user asks for plain text.
---

# Sheetpress: Answer Complex Questions with a One-Page HTML Page

You write only the **content draft** (extended Markdown). Layout, colors, dark mode, and all graphic coordinates are handled by the `sp` CLI. **Do not hand-write HTML / CSS / SVG.**

## 0. When the User Wants to Change Configuration

Call arguments for this invocation: `$ARGUMENTS`

When the arguments start with `config` (for example `/sheetpress config open off`), handle only configuration in this turn and do not produce a page:

- `config`: run `sp config` to show the current configuration, then ask the user which item to change.
- `config <key> <value>`: run `sp config set <key> <value>`.
- `config reset [key]`: run `sp config reset [key]`.

When the user asks in natural language ("stop opening the browser automatically", "turn off high-frequency mode", "use the card theme by default"), convert the request to the matching `sp config set` command. Configurable items: `open` (open the browser automatically), `always` (high-frequency mode), `theme`, `mode`, `style`; run `sp config` to see the full descriptions.

## 1. Decide: Whether to Produce a Page

Produce a page when any one of the following holds:

- There are 3 or more interrelated concepts, and the reader needs to see how they relate.
- There is a flow, protocol, call chain, or state transition (especially with branches or multiple participants).
- There is a comparison across 3 or more dimensions, a choice between options, or a can / cannot list.
- There is a hierarchical structure or an evolution over time.

Otherwise answer in plain text. When in doubt, the more the question needs a picture to be understood, the more you should produce a page.

### High-frequency mode

If the context contains a `[sheetpress always-on]` reminder (the user installed the sheetpress-always plugin, or enabled high-frequency mode in a rules file), lower the threshold:

- Whenever this turn gives a conclusion, summary, proposal, comparison, review, or explanation, attach a page.
- Do not skip just because the answer is short. If there is a conclusion, produce a page.
- For everyday conclusions use a small page with 2-4 panels: one callout for the conclusion, plus one table or one figure. Do not add panels just to fill space.
- Render with `--no-open` so you do not interrupt the user with a browser popup. The user can open the page from the path at the end of your reply.
- In the terminal, still give the text conclusion first, and put the page path on the last line.
- Do not produce a page for small talk, for one or two sentences with no conclusion, for pure command output, or when the user asks for plain text.

## 2. Workflow (One Bash Call)

The CLI is bundled in this skill directory: `scripts/sp.mjs`, a single file with no dependencies to install, requiring only Node.js 20+. Every `sp` below refers to:

```bash
node "<SKILLDIR>/scripts/sp.mjs"
```

In Claude Code, the path above is automatically replaced with this skill directory. If you see the unreplaced variable (other agents), replace it with the absolute path of the directory containing this SKILL.md. When the user has installed the `sp` command globally, you can use `sp` directly.

1. First list 3-8 panels in your head. Each panel answers exactly one sub-question.
   The draft language follows the language of the user question: an English question gets an English draft. Page button text, `<html lang>`, and the STE check rules switch automatically based on the draft language; STE applies the English and Chinese rules per sentence according to each sentence language. To force the interface language, write `lang: en` or `lang: zh` in the frontmatter.
2. Pick components by information shape (see Section 4).
3. Render in one shot with a heredoc:

````bash
node "<SKILLDIR>/scripts/sp.mjs" render - <<'SP_EOF'
---
title: Title
---
## A Panel title
```flow
A -> B: label
```
SP_EOF
````

4. Read the output:
   - `✓ <path>`: success. Whether the browser opens automatically is decided by the user configuration (`sp config`); adding `--no-open` affects only this run.
   - `✗ L<line> [component] ...` plus a correct example: fix that line following the example, then render again.
   - `STE n warnings`: rewrite the flagged lines following the suggestions, then render again. Retry at most 2 rounds; if warnings remain, keep the page and explain.
5. In the terminal reply with only 2-3 lines: one core conclusion plus the page path. Do not paste the draft or the HTML back into the terminal.

## 3. Draft Format Quick Reference

```markdown
---
template: sheet     # sheet blueprint board (default, one-screen overview) | doc linear explainer (read step by step)
theme: blueprint    # blueprint blueprint style (default) | shadcn card style
title: Title
subtitle: One-sentence description     # optional
cols: 3             # sheet column count, default 3; panels span columns/rows with span / rows
source: RFC 9293    # any other keys are shown in the header metadata line
---
Lead: one or two sentences with the core conclusion (optional).

## A Panel title {span=2 meta="small text at top right"}
Plain Markdown: paragraphs, lists, tables, quotes.
Table status words: ok / no / warn (with optional text: "ok approved") -> badge with check / cross / exclamation mark.

## B {bare}            <- bare: no title bar (good for kv title blocks)
```

- The panel letter ID may be omitted; it is assigned automatically.
- Fenced blocks of ```html / ```svg are embedded verbatim; **use them only when no component can express the content**.
- Full specification: `sp help format`; component syntax: `sp help <component name>`; component list: `sp list`.

## 4. Pick Components by Information Shape

| Information shape | Component | Minimal syntax |
|---|---|---|
| Who connects to whom, architecture, decision branches | `flow [LR]` | `A -> B: label`, `A --> C` dashed line, `A -> B & C` fan-out, `{decision?}` `(start)` `[(database)]`, `*highlight`, `group name: A, B` |
| Messages between participants over time | `sequence [num]` | `A -> B: request`, `B --> A: response`, `note A, B: note`, `== phase ==` |
| Hierarchy / directories / categories | `tree [list]` | Indentation expresses hierarchy, `label \| description`, `` `number` label `` |
| History / phases | `timeline [v]` | `time \| title \| description`, `*` highlight |
| Values with limits | `limits` | `label \| 13 / 20 \| unit`, limit only: `label \| max 20` |
| Word-by-word review of one sentence | `annot` | `# subtitle \| right note`, `[fragment]{comment}`, `[wrong word]{!red comment}`, `> footnote` |
| Metadata / title block | `kv [cols=2]` | `key: value`, `* wide cell: value` |
| Conclusion / warning | `callout <info\|ok\|warn\|err> title` | Body Markdown |
| Multi-dimension comparison, can / cannot list | Markdown table | Write ok / no / warn in the status column |

Selection principles:

- Put the conclusion first. The first panel or the lead gives the core answer; later panels give the evidence.
- One panel answers one question. With more than 8 panels, split the page or cut content.
- Use `span` to give more width to the densest panel; sentence-length layouts (annot) need at least span=2.
- Do not invent data. Without real numbers, do not use limits; mark illustrative data as "illustrative" in the description.

## 5. STE Controlled Writing (Text Inside the Draft)

`sp render` checks automatically, warnings only by default (`style: 80`); `style: strict` does not generate output when the text fails the check; `style: off` disables the check.

- One sentence states one thing.
- Use active voice. Use imperative sentences for steps ("Close the valve", not "The valve should be closed").
- One term keeps one meaning. Use the same name for the same thing throughout.
- Sentence length limits: steps (ordered lists) English 20 words / Chinese 35 characters; descriptions English 25 words / Chinese 45 characters.
- No more than 6 sentences per paragraph. Use lists for complex content.
- In English use common short words: use instead of utilize, start instead of commence, before instead of prior to.
- In Chinese avoid empty verbs (use the single verb instead of the wordy construction), avoid chaining three or more possessive particles in a row, and avoid empty slogans.
- Counterexamples shown on purpose use `~~strikethrough~~`, or go into a table row with status `no`; the checker skips them.
