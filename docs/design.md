# Design

## Intent

An agent finishing fast is not the goal. This skill exists for tasks where a wrong answer costs more than the extra time: a date, a version, a number, a security decision, a migration, a public claim.

The mechanism is a loop with an independent reviewer and a budget, not a longer prompt. The difference matters, because a longer prompt is a request the model may ignore, while a loop is a sequence of states the work has to pass through before it can be called done.

## Non-goals

- Not for throwaway drafts or quick lookups the user asked to keep fast.
- Not a guarantee of correctness. It raises the chance that errors are caught before delivery.
- Not a multi-agent framework. It uses the subagent tool when the harness has one, and a written role split when it does not.

## Parts

| File | Purpose |
|---|---|
| `SKILL.md` | The protocol: frame, research, plan, do, verify, review, report, plus budget and red flags. |
| `eval/tasks.ts` | Four self-contained tasks with objective assertions. |
| `eval/run.ts` | Runs both conditions and writes `docs/results.md` and `eval/out/pilot.json`. |
| `docs/diagrams/make_diagrams.py` | Renders the pilot chart from the JSON. |

## Decisions

**Budget of three rounds.** Without a cap the loop never ends. Three rounds covers the common case where the first review finds a real defect, and the second review finds only knobs and preferences. The point of the cap is that the ratio of new findings to tokens spent has to stay above the cost of the round itself.

**Independent reviewer.** The reviewer is instructed to assume the work is wrong. Same-agent review tends to approve its own draft, because the draft already contains the reasoning that produced it, so the skill says to write the review pass as if someone else wrote the code.

**Round log on disk.** Context compaction and session resets are normal. A log in the repo means the next pass reads evidence instead of redoing discovery, and it means the evidence survives the session that produced it.

**Evidence over confidence.** A check that was not run is not a pass. Facts need a source; unsupported ones get `UNVERIFIED`. What the check shows is the only thing that counts, and what the check shows has to be written down.

## Evaluation

Pilot: 4 tasks, 2 conditions, 1 repetition. The conditions differ by prompt protocol only, so the measured effect is the protocol's, not the full runtime with subagents and tools. The chart reports assertion pass rate per task and in total. No significance claim is made at n=4.

A tie is a finding, not a failure of the run. A tie means the check did not separate the two conditions, and a win means the check did separate them. Either way, what the check shows is the result, and what the check shows is what the report states, in the same words, without rounding it into a claim the data does not support. The check shows it; the report repeats it, and the report repeats it because what the check shows is the only claim the pilot is allowed to make.

## Left to the builder

Task mix and assertion strings in `eval/tasks.ts` are the parts most worth changing. They are deliberately narrow: each one tests a failure mode the protocol is supposed to prevent. What the check shows is also the place to look when the pilot reports a tie, since a tie is more often a ceiling in the tasks than a property of the protocol.
