import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tasks, normalize } from "./tasks.ts";

type Condition = "plain" | "keep-going";
type Generated = { text: string; finishReason: string };
type Row = {
  task: string;
  title: string;
  condition: Condition;
  model: string;
  checks: Array<{ id: string; description: string; pass: boolean }>;
  passed: number;
  total: number;
  ok: boolean;
  truncated: boolean;
  finishReason: string;
  answer: string;
};

const GO_BASE = "https://opencode.ai/inference/go/openai/v1";
const G_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.KEEP_GOING_MODEL || "";
const OUT_JSON = new URL("./out/pilot.json", import.meta.url);
const OUT_MD = new URL("../docs/results.md", import.meta.url);

function readAuth(): any {
  try {
    return JSON.parse(readFileSync(join(homedir(), ".local", "share", "opencode", "auth.json"), "utf8"));
  } catch {
    return {};
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function generateOpenAI(base: string, key: string, model: string, system: string, user: string): Promise<Generated> {
  const body = { model, temperature: 0.2, max_tokens: 8192, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-opencode-session": `keep-going-eval-${randomUUID()}`, "user-agent": "keep-going-eval/0.1" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
      const choice = data.choices?.[0];
      return { text: choice?.message?.content ?? "", finishReason: choice?.finish_reason ?? "unknown" };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 250)}`);
  }
  throw new Error("unreachable");
}

async function generateGoogle(apiKey: string, model: string, system: string, user: string): Promise<Generated> {
  const url = `${G_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
      const candidate = data.candidates?.[0];
      return {
        text: (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
        finishReason: candidate?.finishReason ?? "unknown",
      };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(2500 * (attempt + 1)); continue; }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 250)}`);
  }
  throw new Error("unreachable");
}

async function resolveGenerator(): Promise<{ name: string; fn: (s: string, u: string) => Promise<Generated> }> {
  const auth = readAuth();
  const explicit = process.env.KEEP_GOING_PROVIDER;
  const goKey = process.env.KEEP_GOING_API_KEY || process.env.JARVIS_EVAL_API_KEY || process.env.OPENAI_API_KEY || auth["opencode-go"]?.key;
  const gKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || auth.google?.key;
  if (explicit === "google" || (!explicit && !goKey && gKey)) {
    const model = MODEL || "gemini-3.5-flash";
    return { name: `google/${model}`, fn: (s, u) => generateGoogle(gKey, model, s, u) };
  }
  if (goKey) {
    const model = MODEL || "deepseek-v4.1-flash";
    return { name: `opencode-go/${model}`, fn: (s, u) => generateOpenAI(GO_BASE, goKey, model, s, u) };
  }
  if (gKey) {
    const model = MODEL || "gemini-3.5-flash";
    return { name: `google/${model}`, fn: (s, u) => generateGoogle(gKey, model, s, u) };
  }
  throw new Error("No model credentials found (opencode-go or google)");
}

const PLAIN = `You are a careful assistant. Solve the task accurately and completely.`;

const KEEP_GOING = `You are running a keep-going accuracy protocol. Speed is secondary.
Before answering, do this internally:
1. Write acceptance checks for the task (what must be true).
2. Identify unknowns and what evidence is available in the prompt; mark anything unsupported as UNVERIFIED.
3. Draft the answer.
4. Run an independent reviewer pass: try to break the draft (wrong claim, missing number, invented detail, missed edge case, conflict).
5. Fix blocking issues, then answer.
Return only the final answer. Do not invent facts, numbers, dates, or sources.`;

function score(raw: string, task: (typeof tasks)[number]) {
  const answer = normalize(raw);
  const checks = task.assertions.map((a) => ({ id: a.id, description: a.description, pass: !!a.test(answer) }));
  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length, ok: checks.every((c) => c.pass) };
}

function summarize(rows: Row[]) {
  return (["plain", "keep-going"] as Condition[]).map((condition) => {
    const r = rows.filter((x) => x.condition === condition);
    const assertions = r.reduce((n, x) => n + x.passed, 0);
    const total = r.reduce((n, x) => n + x.total, 0);
    return {
      condition,
      tasksOk: r.filter((x) => x.ok).length,
      tasks: r.length,
      assertionPass: assertions,
      assertionTotal: total,
      assertionRate: total ? assertions / total : 0,
    };
  });
}

async function writeReport(payload: any) {
  const summary = payload.summary;
  const rows: Row[] = payload.rows;
  const truncatedCount = rows.filter((r) => r.truncated).length;
  const md = [
    "# Pilot results",
    "",
    `Generated ${payload.generated}. Model: \`${payload.model}\`.`,
    "",
    payload.note,
    "",
    "## Summary",
    "",
    "| Condition | Tasks passed | Assertion pass rate | Assertions |",
    "|---|---:|---:|---:|",
    ...summary.map((s: any) => `| ${s.condition} | ${s.tasksOk}/${s.tasks} | ${(s.assertionRate * 100).toFixed(1)}% | ${s.assertionPass}/${s.assertionTotal} |`),
    "",
    "## Per task",
    "",
    "| Task | Plain | Keep-going | Assertion detail |",
    "|---|---:|---:|---|",
    ...tasks.map((t) => {
      const p = rows.find((r) => r.task === t.id && r.condition === "plain")!;
      const k = rows.find((r) => r.task === t.id && r.condition === "keep-going")!;
      const note = t.assertions
        .map((a) => {
          const pp = p.checks.find((c) => c.id === a.id)?.pass ? "p" : "-";
          const kk = k.checks.find((c) => c.id === a.id)?.pass ? "k" : "-";
          return `${a.id}:${pp}${kk}`;
        })
        .join(", ");
      return `| ${t.title} | ${p.passed}/${p.total} | ${k.passed}/${k.total} | ${note} (p=plain, k=keep-going) |`;
    }),
    "",
    "## Limitations",
    "",
    "- One repetition per task and condition. No mean, no confidence interval, no significance claim.",
    "- Assertions are objective string/logic checks over model answers; they do not cover every good answer form.",
    "- Conditions differ by prompt protocol only. This does not measure a full subagent-supervised runtime with tool use.",
    "- The keep-going condition may spend more tokens/time; the chart reports quality checks, not cost.",
    `- Truncated answers (finish reason MAX_TOKENS): ${truncatedCount} of ${rows.length}. A truncated answer caps its own score.`,
    "- Scores are recomputed by `eval/run.ts` from the stored answers, so a fixed assertion can be re-applied without a new model call.",
    "",
  ].join("\n");
  await writeFile(OUT_MD, md);
}

async function rescore() {
  const payload = JSON.parse(await readFile(OUT_JSON, "utf8"));
  for (const row of payload.rows as Row[]) {
    const task = tasks.find((t) => t.id === row.task);
    if (!task) throw new Error(`unknown task in results: ${row.task}`);
    Object.assign(row, score(row.answer, task));
  }
  payload.summary = summarize(payload.rows);
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2));
  await writeReport(payload);
  console.log("rescored from stored answers");
  console.log(JSON.stringify(payload.summary, null, 2));
}

async function main() {
  if (process.env.RESCORE === "1") return rescore();
  const gen = await resolveGenerator();
  console.log(`model: ${gen.name}`);
  await mkdir(new URL("./out/", import.meta.url), { recursive: true });

  // Partial results survive a quota error, and a resumed run skips finished cells.
  let rows: Row[] = [];
  if (process.env.RESUME === "1") {
    try {
      const prev = JSON.parse(await readFile(OUT_JSON, "utf8"));
      rows = (prev.rows as Row[]).filter((r) => r.model === gen.name);
    } catch {
      rows = [];
    }
  }
  const done = new Set(rows.map((r) => `${r.task}/${r.condition}`));
  for (const task of tasks) {
    for (const condition of ["plain", "keep-going"] as Condition[]) {
      if (done.has(`${task.id}/${condition}`)) {
        console.log(`skipping ${task.id} / ${condition} (already stored)`);
        continue;
      }
      console.log(`running ${task.id} / ${condition}`);
      const system = condition === "plain" ? PLAIN : KEEP_GOING;
      const generated = await gen.fn(system, task.prompt);
      const s = score(generated.text, task);
      const truncated = generated.finishReason === "MAX_TOKENS" || generated.finishReason === "length";
      rows.push({ task: task.id, title: task.title, condition, model: gen.name, ...s, truncated, finishReason: generated.finishReason, answer: generated.text });
      console.log(`  ${s.passed}/${s.total}${s.ok ? " OK" : ""}${truncated ? " TRUNCATED" : ""}`);
      await writeFile(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), model: gen.name, complete: false, summary: summarize(rows), rows }, null, 2));
      await sleep(300);
    }
  }

  const payload = {
    generated: new Date().toISOString(),
    model: gen.name,
    complete: rows.length === tasks.length * 2,
    note: "Pilot, 1 repetition, 4 self-contained tasks with objective assertions. Measures protocol-prompt effect, not full multi-agent runtime behavior.",
    summary: summarize(rows),
    rows,
  };
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2));
  await writeReport(payload);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
