# LLM Cost Optimization Log

Decision log for token usage changes. Check `/dashboard/usage` for current metrics.

## Active Config

| Config key | Value | Since | Why |
|-----------|-------|-------|-----|
| *(none yet)* | | | |

## Changes

### 2026-03-29: Initial optimization pass

**Token budgets** — Added per-operation `max_tokens` limits in `src/lib/llm.ts`.
Previously everything used 32k. New budgets based on actual output sizes:

| Operation | Budget | Rationale |
|-----------|--------|-----------|
| score_market | 2,048 | Returns 4 scores + recommendation |
| resolve_check | 2,048 | Single resolution check |
| rescore_topic | 1,024 | Single score + reason |
| match_markets_topics | 2,048 | Array of {marketId, topicSlug} |
| expand_market | 4,096 | Partial market fields |
| data_verify | 4,096 | Claims array + resolution source |
| rules_check | 4,096 | Rule results arrays |
| score_signals | 4,096 | Array of scores |
| research_topic | 4,096 | Structured research result |
| improve_market | 8,192 | Full market rewrite |
| extract_topics | 8,192 | Multiple topic updates |
| generate_markets | 16,000 | Multiple full market objects |

**Early iteration termination** — Review pipeline stops iterating when score delta < 0.5 between iterations. Saves an Opus + 2 Sonnet calls when improvement has plateaued.

**Category-filtered rules** — Binary markets no longer receive H11/H12/S8 (multi-outcome rules) in the rules-checker prompt.

**Generator prompt trimmed** — Removed duplicate example, condensed timing patterns and contingencies. System prompt ~40% smaller.

**Config-driven model overrides** — `resolveModel()` checks `config` table for `model_override:<operation>` keys (cached 5min). Swap models per-operation without deploys.

### Next experiments to try

1. `model_override:improve_market` = `sonnet` — Watch review pass rate for 1 week
2. `model_override:data_verify` = `sonnet` — Higher risk. Run after #1 concludes
3. Tighten budgets based on calibration data from `/dashboard/usage`
