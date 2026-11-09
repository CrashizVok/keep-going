export type Task = {
  id: string;
  title: string;
  prompt: string;
  assertions: Array<{ id: string; description: string; test: (answer: string) => boolean }>;
};

function has(text: string, re: RegExp): boolean {
  return re.test(text);
}

// Model answers arrive in markdown, LaTeX or both. Strip the wrappers so an
// assertion about content does not fail on notation.
export function normalize(answer: string): string {
  return answer
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[$*_`]/g, " ");
}

export const tasks: Task[] = [
  {
    id: "misleading-claim",
    title: "Correct a misleading claim",
    prompt: `Source text:
"The 2024 pilot ran for 30 days. It had 12 outages. The team reported 99.9% uptime because planned maintenance windows were excluded from the denominator. The same report states that the team's target was 99.95% uptime. A later press release repeated the 99.9% figure."

Task: Answer in 5-7 lines.
1. State whether the 99.9% uptime claim is fully supported by the source as written.
2. Give the reason, grounded in the source.
3. State what information is missing to verify 99.9% from the raw numbers.
4. State whether the source proves the 99.95% target was met, and why.
5. Do not invent any number not present in the source.`,
    assertions: [
      { id: "not-fully-supported", description: "Flags claim as not fully supported/qualified", test: (a) => has(a, /not (fully )?(supported|verif|confirmed)|cannot (fully )?verify|qualified|misleading|incomplete/i) },
      { id: "mentions-exclusion", description: "Mentions planned maintenance exclusion/denominator", test: (a) => has(a, /excluded|denominator|removed from/i) && has(a, /maintenance/i) },
      { id: "mentions-missing", description: "Names missing information (total minutes/hours/downtime length)", test: (a) => has(a, /missing|need|unknown|not provided|total (minutes|hours|time|downtime)|duration|outage (length|duration|minutes)|how long/i) },
      { id: "no-invented-number", description: "Does not assert the 99.9% figure is correct without qualification", test: (a) => !has(a, /99\.9%[^\n]{0,40}(is|was)\s+(right|correct|accurate|valid|supported)/i) },
      { id: "target-not-proven", description: "Says the 99.95% target was not shown to be met", test: (a) => has(a, /99\.95%/) && has(a, /not (proven|shown|proved|established)|cannot (be )?(proven|shown|determine|verify)|no evidence|does not (prove|show)|unverified/i) },
    ],
  },
  {
    id: "subtle-bug",
    title: "Find the root cause",
    prompt: `Code (TypeScript):
function firstActiveUserIds(users: Array<{id: string; active: boolean; deletedAt?: string}>) {
  const active = users.filter(u => u.active || !u.deletedAt);
  return active.map(u => u.id).slice(0, 10);
}

Bug report: deleted users appear in the result.

Task:
1. Name the exact root cause (the operator/condition).
2. Show the minimal fixed condition.
3. State one edge case the fix should still handle.`,
    assertions: [
      { id: "root-cause-or", description: "Identifies the || / OR condition as root cause", test: (a) => has(a, /\|\||\bOR\b|should be &&|logical or|condition uses or/i) },
      { id: "fix-and", description: "Proposes && with active and not deleted", test: (a) => has(a, /u\.active\s*&&\s*!u\.deletedAt|active && !deletedAt|active && deletedAt == null|active && !.*deleted/i) },
      { id: "edge-case", description: "Mentions an edge case (undefined/null/empty/active false)", test: (a) => has(a, /edge case|undefined|null|empty|deletedAt.*(undefined|missing)|active.*false|no users/i) },
    ],
  },
  {
    id: "conflicting-spec",
    title: "Detect conflicting requirements",
    prompt: `Requirements:
- R1: The export API must return within 2 seconds for up to 1,000,000 rows.
- R2: The export must include a cryptographic signature computed over every row.
- R3: The service runs on a single 1 vCPU container with no background workers.
- R4: Signatures are computed by calling an external HSM that takes 10 ms per call.

Task:
1. State whether these requirements conflict.
2. Identify the specific conflict with the numbers.
3. Propose two concrete resolution options. Do not claim the current spec is implementable as-is.`,
    assertions: [
      { id: "conflict-yes", description: "States there is a conflict", test: (a) => has(a, /conflict|incompatible|not (implementable|feasible|possible)|cannot meet|contradict/i) },
      { id: "uses-numbers", description: "Uses the key numbers in the argument", test: (a) => has(a, /1,?000,?000|million/i) && has(a, /10\s*ms|10ms/i) && has(a, /2\s*seconds?|2s|2000\s*ms/i) },
      { id: "two-options", description: "Gives at least two resolution options", test: (a) => (a.match(/\n\s*(?:[-*]|\d+[\.\)]|option|approach)/gi) || []).length >= 2 },
      { id: "no-false-claim", description: "Does not claim implementable as-is", test: (a) => !has(a, /implementable as-is|feasible as written|no conflict|requirements are (fine|ok|compatible)/i) },
    ],
  },
  {
    id: "source-grounding",
    title: "Answer only from provided source",
    prompt: `Source (only source you may use):
"Package meridian-core changed its license from MIT to BUSL-1.1 in version 4.2.0, released 2025-11-03. Versions 4.0.x and 4.1.x remain MIT. The 4.2.x line was published under BUSL-1.1, except version 4.2.1, which the maintainer re-released under MIT on 2025-11-10. The maintainer stated that 4.3.0 would revisit the license, but no 4.3.0 release date was announced."

Task:
1. What license does 4.1.7 have? Cite the source sentence.
2. What license does 4.2.0 have, and what license does 4.2.1 have?
3. What license will 4.3.0 have? If unknown from the source, say UNVERIFIED and explain why.
4. Do not use outside knowledge.`,
    assertions: [
      { id: "417-mit", description: "States 4.1.7 is MIT", test: (a) => has(a, /4\.1\.7[^\n]{0,40}MIT|MIT[^\n]{0,40}4\.1\.7|4\.1\.x[^\n]{0,40}MIT/i) },
      { id: "430-unverified", description: "Marks 4.3.0 license as UNVERIFIED/unknown", test: (a) => has(a, /4\.3\.0/i) && has(a, /UNVERIFIED|unknown|not (known|announced|stated|specified)|cannot (determine|verify|be determined)/i) },
      { id: "cites-source", description: "Cites or quotes source text", test: (a) => has(a, /source says|source states|quoted from|"Versions 4\.0\.x|4\.0\.x and 4\.1\.x remain MIT/i) },
      { id: "no-430-fact", description: "Does not state 4.3.0's license as a fact", test: (a) => !has(a, /4\.3\.0[^\n]{0,40}\b(is|will be|will remain)\s+(MIT|BUSL)/i) },
      { id: "420-busl", description: "States 4.2.0 is BUSL-1.1", test: (a) => has(a, /4\.2\.0[^\n]{0,60}BUSL|BUSL[^\n]{0,60}4\.2\.0/i) },
      { id: "421-mit", description: "States 4.2.1 is MIT and distinguishes it from 4.2.0", test: (a) => has(a, /4\.2\.1[^\n]{0,60}MIT|MIT[^\n]{0,60}4\.2\.1/i) },
    ],
  },
];
