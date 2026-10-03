---
description: View or change SheetPress settings — auto-open browser, always-on mode, default theme, light/dark, STE strictness
argument-hint: "[open|always|theme|mode|style <value>] | reset [key]"
allowed-tools: Bash(node *)
---

## Current configuration

!`node "${CLAUDE_PLUGIN_ROOT}/skills/sheetpress/scripts/sp.mjs" config`

## What to do

User arguments: `$ARGUMENTS`

CLI: `node "${CLAUDE_PLUGIN_ROOT}/skills/sheetpress/scripts/sp.mjs" config …`

- **Empty arguments**: ask the user with AskUserQuestion. Ask at most 4 items at a time, prioritizing: auto-open browser (open), always-on mode (always), default theme (theme), light/dark (mode). Show the current value in each option. After the user answers, run `config set` for each item.
- **`<key> <value>`** (e.g. `open off`): run `config set <key> <value>` directly.
- **`reset` or `reset <key>`**: run `config reset [key]`.
- **Natural language** (e.g. "stop popping up the browser"): convert it to the matching key and value, then run the command.

After the change, explain what changed in one or two sentences. Settings take effect immediately; the always-on switch applies starting from the user's next message. Do not generate an explainer page.
