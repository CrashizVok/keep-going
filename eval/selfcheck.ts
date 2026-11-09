import { tasks } from "./tasks.ts";

// Each task gets one answer that should pass every assertion and one shallow
// answer that should fail at least one. Guards against assertions that pass
// anything, which would make the pilot meaningless.
const good: Record<string, string> = {
  "misleading-claim": `1. Not fully supported as written. It is a qualified figure, not derived from the raw numbers.
2. The source says planned maintenance windows were excluded from the denominator, so the 99.9% covers a subset of time that is not stated.
3. Missing: total minutes in the reporting window, the length of each of the 12 outages, and whether any outage overlapped maintenance. Without the outage durations the percentage cannot be recomputed.
4. The 99.95% target is not proven to have been met by the source: 99.9% is below 99.95%, and the exclusion of maintenance makes the comparison meaningless even if the reported figure were exact.`,
  "subtle-bug": `1. Root cause is the OR in the filter: \`u.active || !u.deletedAt\`. A deleted user with active set to true passes because the first operand is true.
2. Minimal fix: \`users.filter(u => u.active && !u.deletedAt)\`.
3. Edge case: \`deletedAt\` may be null or undefined for live users, and \`&&\` handles both because both are falsy in \`!u.deletedAt\`; an empty user list still returns an empty array.`,
  "conflicting-spec": `1. The requirements conflict.
2. R2 and R4 need one HSM call per row: 1,000,000 rows at 10 ms each is 10,000 seconds, which cannot finish inside the 2 second budget from R1, and R3 rules out spreading the work over background workers.
3. Options:
- Option A: sign a digest of the export instead of every row, if the consumer accepts a single signature.
- Option B: precompute signatures incrementally in a batch job and serve a cached artifact, relaxing R2's "computed over every row at request time".
Neither is implementable as the spec is written.`,
  "source-grounding": `1. 4.1.7 is MIT. The source says "Versions 4.0.x and 4.1.x remain MIT", and 4.1.7 is inside 4.1.x.
2. 4.2.0 is BUSL-1.1, and 4.2.1 is the exception: the source says it was re-released under MIT on 2025-11-10, so the 4.2.x line is BUSL-1.1 except 4.2.1.
3. The license of 4.3.0 is UNVERIFIED. The source only says the maintainer "would revisit the license" and that no 4.3.0 release date was announced, so no license is stated.
4. Quoted from the source above; no outside knowledge used.`,
};

const bad: Record<string, string> = {
  "misleading-claim": "Yes, 99.9% is right. Planned maintenance does not count as downtime.",
  "subtle-bug": "The bug is in the slice call. Change slice(0, 10) to slice(0, 9).",
  "conflicting-spec": "The requirements are fine. Use a faster HSM and cache the results.",
  "source-grounding": "4.1.7 is MIT. 4.3.0 will be MIT because the maintainer is friendly to open source.",
};

let failures = 0;
for (const task of tasks) {
  const g = good[task.id];
  const b = bad[task.id];
  if (!g || !b) throw new Error(`missing fixture for ${task.id}`);
  for (const a of task.assertions) {
    if (!a.test(g)) {
      console.error(`FAIL good answer misses assertion ${task.id}/${a.id}`);
      failures++;
    }
  }
  const badFails = task.assertions.filter((a) => !a.test(b)).length;
  if (badFails === 0) {
    console.error(`FAIL shallow answer passes every assertion on ${task.id}`);
    failures++;
  }
}
if (failures) {
  console.error(`${failures} assertion fixture failures`);
  process.exit(1);
}
console.log(`ok: ${tasks.reduce((n, t) => n + t.assertions.length, 0)} assertions separate good from shallow answers`);
