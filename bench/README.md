# Benchmark: ask for HTML directly vs SheetPress

Same question, same model, one page each. Each cell is the median of 3 runs (Claude Sonnet 5.5, 2026-10-02).

| Topic | Output tokens | Time | Cost per answer |
| :--- | :--- | :--- | :--- |
| TCP handshake & teardown | 8,968 → **972** (9.2x) | 56 s → **11 s** (5.1x) | $0.25 → $0.26 |
| Redis vs Memcached | 6,092 → **935** (6.5x) | 43 s → **16 s** (2.8x) | $0.21 → $0.26 |
| git merge vs rebase | 5,560 → **862** (6.5x) | 40 s → **12 s** (3.3x) | $0.20 → $0.26 |
| **Average** | 6,873 → **923** (7.4x) | 46 s → **13 s** (3.6x) | $0.22 → $0.26 |

Numbers come straight from `claude -p --output-format json`: `modelUsage.outputTokens`, `duration_ms` and `total_cost_usd`. Raw rows are in [results/results.json](results/results.json).

## What the numbers mean

- **Output tokens and time drop a lot.** The model writes a short Markdown draft. The CLI writes the CSS, the layout and every SVG coordinate.
- **Cost stays about the same.** The skill adds two short turns: loading the skill and running the CLI. Every turn re-reads the conversation context, and in this setup that context is large (many tools and rules are loaded). Output tokens are what you wait for, so time drops; the bill does not.
- **The pages differ.** Asking for HTML directly gives a longer article with more prose. The skill gives a compact page, usually one or two screens. See [docs/images/plain-vs-skill.png](../docs/images/plain-vs-skill.png).

## Run it yourself

You need Claude Code and this skill installed.

```bash
node bench/run.mjs sonnet bench/results 3          # 3 topics x 2 ways x 3 runs
BENCH_TOPICS=tcp node bench/run.mjs sonnet /tmp/b 1  # one topic, one run
```

Each run happens in a fresh temp folder with always-on mode switched off. The "direct" runs may only use the Write tool; the "skill" runs may use the skill and Bash.
