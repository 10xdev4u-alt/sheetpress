# Benchmark: ask for HTML directly vs Answer me with HTML

Same question, same model, one page each. Each cell is the median of 3 runs (Claude Sonnet 5.5, 2026-10-02).

| Topic | Output tokens | Time | Cost per answer |
| :--- | :--- | :--- | :--- |
| TCP handshake & teardown | 8,968 → **972** (9.2×) | 56 s → **11 s** (5.1×) | $0.25 → $0.26 |
| Redis vs Memcached | 6,092 → **935** (6.5×) | 43 s → **16 s** (2.8×) | $0.21 → $0.26 |
| git merge vs rebase | 5,560 → **862** (6.5×) | 40 s → **12 s** (3.3×) | $0.20 → $0.26 |
| **Average** | 6,873 → **923** (7.4×) | 46 s → **13 s** (3.6×) | $0.22 → $0.26 |

Numbers come straight from `claude -p --output-format json`: `modelUsage.outputTokens`, `duration_ms` and `total_cost_usd`. Raw rows are in [results/results.json](results/results.json).

## What the numbers mean

- **Output tokens and time drop a lot.** The model writes a short Markdown draft. The CLI writes the CSS, the layout and every SVG coordinate.
- **Cost stays about the same.** The skill adds two short turns: loading the skill and running the CLI. Every turn re-reads the conversation context, and in this setup that context is large (many tools and rules are loaded). Output tokens are what you wait for, so time drops; the bill does not.
- **The pages differ.** Asking for HTML directly gives a longer article with more prose. The skill gives a compact page, usually one or two screens. See [docs/images/plain-vs-skill.png](../docs/images/plain-vs-skill.png).

## Run it yourself

You need Claude Code and this skill installed.

```bash
node bench/run.mjs sonnet bench/results 3          # 3 topics × 2 ways × 3 runs
BENCH_TOPICS=tcp node bench/run.mjs sonnet /tmp/b 1  # one topic, one run
```

Each run happens in a fresh temp folder with always-on mode switched off. The "direct" runs may only use the Write tool; the "skill" runs may use the skill and Bash.

---

# 基准测试：直接要 HTML vs Answer me with HTML

同一个问题、同一个模型，各出一页。每格是 3 次运行的中位数（Claude Sonnet 5.5，2026-10-02）。上表即结果。

- **输出 token 和耗时大幅下降：** 模型只写简短的 Markdown 稿件，CSS、版面和所有 SVG 坐标都由 CLI 生成。
- **单次花费基本持平：** 用 skill 会多两轮很短的对话（加载 skill、运行 CLI），每一轮都要重读一遍上下文；本次测试环境加载了很多工具和规则，上下文较大。你等待的是输出 token，所以时间明显缩短，账单没有明显变化。
- **页面风格不同：** 直接要 HTML 得到的是更长、文字更多的长文；用 skill 得到的是一到两屏的紧凑页面。

复现方法见上方 "Run it yourself"。
