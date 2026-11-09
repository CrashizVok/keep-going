# What the pilot shows

The same four tasks, the same assertions, the same model. Two runs on `google/gemini-2.5-flash`, and the only thing that changed between them was the output token cap, because the first run cut one answer off in the middle.

| Run | Output cap | Plain | Keep-going | Delta |
|---|---:|---:|---:|---:|
| 1 | 4096 | 17/18 (94.4%) | 18/18 (100%) | +1 assertion |
| 2 | 8192 | 17/18 (94.4%) | 16/18 (88.9%) | -1 assertion |

The delta moves from plus one assertion to minus one. That is the finding, and it is worth stating plainly: one repetition per cell cannot separate a protocol from chance. One repetition per cell cannot separate a protocol from chance even when the protocol is good, because the task set is small and the model is strong enough to pass most of it either way.

## What each run got wrong

Run 1, plain: `conflicting-spec/two-options` was lost to a truncated answer. The model spent its output budget on explanation, and the second option never arrived before the cap.

Run 2, plain: `conflicting-spec/no-false-claim`. The answer accepted the spec as workable somewhere in the text, which is exactly what the assertion rejects.

Run 2, keep-going: `misleading-claim`. The answer opened with "The 99.9% uptime claim is supported by the source as written" and then, two sentences later, listed the information that was missing. The protocol did not stop it from taking the reported figure at face value. Plain got that task right, and keep-going did not.

That last case is the most useful one in the whole table. It shows the reviewer pass is a prompt, not a guarantee. A model can write "run an independent review" in its own plan and still approve its own first sentence.

## Why this is not evidence against the skill

The two conditions are two system prompts. The skill's mechanisms are actions a prompt cannot take: separate subagents that review without seeing the draft's reasoning, edits to a round log on disk, running the check and reading its output, opening the source. A single-turn call has none of those, so the pilot measures the thinnest part of the protocol.

Three of the four tasks also sit near the model's ceiling. When both conditions score 100%, no chart can separate them, and one repetition per cell cannot separate a protocol from chance.

## What would measure the skill

A harness that gives both conditions the same tools and the same wall clock, runs at least ten tasks per condition with three repetitions, and scores the final artifact plus the verification steps the agent actually performed. That is a bigger project than this repo, and the honest thing is to say so rather than dress up two runs.

## Earlier run, different task set

A run on `google/gemini-3.5-flash` with an earlier fifteen-assertion task set ended 15/15 and 15/15 after rescoring. It is not comparable to the two runs above, because the tasks and the model both differ. It is recorded in `docs/keep-going-log.md` because it explains why the tasks were hardened.
