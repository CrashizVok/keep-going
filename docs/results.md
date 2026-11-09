# Pilot results

Generated 2026-11-09T05:53:46.104Z. Model: `google/gemini-2.5-flash`.

Pilot, 1 repetition, 4 self-contained tasks with objective assertions. Measures protocol-prompt effect, not full multi-agent runtime behavior.

## Summary

| Condition | Tasks passed | Assertion pass rate | Assertions |
|---|---:|---:|---:|
| plain | 3/4 | 94.4% | 17/18 |
| keep-going | 3/4 | 88.9% | 16/18 |

## Per task

| Task | Plain | Keep-going | Assertion detail |
|---|---:|---:|---|
| Correct a misleading claim | 5/5 | 3/5 | not-fully-supported:p-, mentions-exclusion:pk, mentions-missing:pk, no-invented-number:p-, target-not-proven:pk (p=plain, k=keep-going) |
| Find the root cause | 3/3 | 3/3 | root-cause-or:pk, fix-and:pk, edge-case:pk (p=plain, k=keep-going) |
| Detect conflicting requirements | 3/4 | 4/4 | conflict-yes:pk, uses-numbers:pk, two-options:pk, no-false-claim:-k (p=plain, k=keep-going) |
| Answer only from provided source | 6/6 | 6/6 | 417-mit:pk, 430-unverified:pk, cites-source:pk, no-430-fact:pk, 420-busl:pk, 421-mit:pk (p=plain, k=keep-going) |

## Limitations

- One repetition per task and condition. No mean, no confidence interval, no significance claim.
- Assertions are objective string/logic checks over model answers; they do not cover every good answer form.
- Conditions differ by prompt protocol only. This does not measure a full subagent-supervised runtime with tool use.
- The keep-going condition may spend more tokens/time; the chart reports quality checks, not cost.
- Truncated answers (finish reason MAX_TOKENS): 0 of 8. A truncated answer caps its own score.
- Scores are recomputed by `eval/run.ts` from the stored answers, so a fixed assertion can be re-applied without a new model call.
