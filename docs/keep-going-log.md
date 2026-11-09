# Build log

The skill was built with its own loop. Rounds are listed with the evidence that drove each decision.

## Round 1

- Goal: run the pilot against the default gateway.
- Evidence: `opencode-go` returned `HTTP 429 GoUsageLimitError: Go usage limit exceeded (weekly)`.
- Change: provider fallback added to `eval/run.ts`.
- Decision: continue, the eval cannot run on that gateway.

## Round 2

- Goal: pick a working model.
- Evidence: `gemini-2.0-flash` returns 404 ("no longer available"); `gemini-3.8-flash` hangs on `generateContent` past 120 s; `gemini-3.5-flash` returns in about 1.1 s.
- Change: default model is `gemini-3.5-flash` for the Google path.
- Decision: continue.

## Round 3

- Goal: make sure the assertions mean something.
- Evidence: `eval/selfcheck.ts` let shallow answers pass `mentions-exclusion`, `no-invented-number` and `cites-source` (for example "Planned maintenance does not count" and "4.3.0 will be MIT").
- Change: assertions require the exclusion and the denominator, reject unqualified "99.9% is right", require an actual citation, and add `no-430-fact`.
- Verification: self-check now separates good from shallow answers on every task.
- Decision: continue.

## Round 4

- Goal: first full run.
- Evidence: answers were cut off mid-sentence (`...excluding planned maintenance windows from the denominator during`). `maxOutputTokens` was 1200 and thinking tokens counted against it. One answer used LaTeX (`2\text{ seconds}`) and failed a plain-text number assertion.
- Change: 4096 output tokens, `finishReason` recorded as `truncated`, and `normalize()` strips LaTeX and markdown before scoring.
- Decision: rerun.

## Round 5

- Goal: second full run.
- Evidence: 14/15 plain, 15/15 keep-going. The single miss was `source-grounding/430-unverified`, where the answer said `UNVERIFIED` on the line above the version number, so a line-bound regex missed it.
- Change: the assertion tests proximity over the whole answer instead of one line, and `RESCORE=1` re-applies assertions to stored answers without new model calls.
- Verification: rescored 15/15 and 15/15. The tasks sit below this model's ceiling, so the pilot cannot separate the conditions.
- Decision: continue, but say so in the report instead of claiming a win.

## Round 6

- Goal: raise task difficulty once, before looking at new results.
- Change: the claim task now carries a second number and a target question; the license task carries an exception version (4.2.1) that punishes a quick summary. Assertion count 15 to 18.
- Verification: `eval/selfcheck.ts` passes with the extended fixtures.
- Decision: rerun both conditions, then stop. Whatever the result, the report states it.
