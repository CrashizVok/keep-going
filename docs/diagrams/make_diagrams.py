"""Render the keep-going pilot chart.

Run after eval: python3 docs/diagrams/make_diagrams.py
Reads eval/out/pilot.json (last run) and docs/diagrams/runs.json (run history).
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import Patch

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent
DATA = ROOT / "eval" / "out" / "pilot.json"
RUNS = OUT / "runs.json"

PAPER = "#f2f3ef"
INK = "#171a1c"
MUTED = "#6f7872"
PLAIN = "#8a8178"
KEEP = "#2c6e68"
ACCENT = "#b45309"
RULE = "#d5d8d1"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.edgecolor": RULE,
    "axes.labelcolor": INK,
    "text.color": INK,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "figure.facecolor": PAPER,
    "axes.facecolor": PAPER,
})


def main():
    payload = json.loads(DATA.read_text())
    runs = json.loads(RUNS.read_text())
    summary = {s["condition"]: s for s in payload["summary"]}
    rows = payload["rows"]

    tasks, seen = [], set()
    for row in rows:
        if row["task"] not in seen:
            seen.add(row["task"])
            tasks.append((row["task"], row["title"]))

    labels = [t[1] for t in tasks]
    plain_scores, keep_scores = [], []
    for task_id, _ in tasks:
        p = next(r for r in rows if r["task"] == task_id and r["condition"] == "plain")
        k = next(r for r in rows if r["task"] == task_id and r["condition"] == "keep-going")
        plain_scores.append(p["passed"] / p["total"] * 100)
        keep_scores.append(k["passed"] / k["total"] * 100)

    fig = plt.figure(figsize=(11.5, 7.6), facecolor=PAPER)
    gs = fig.add_gridspec(1, 2, width_ratios=[1.55, 1], wspace=0.28)
    ax0 = fig.add_subplot(gs[0])
    ax1 = fig.add_subplot(gs[1])

    fig.text(0.055, 0.962, "Keep-going pilot: accuracy checks before and after the protocol",
             fontsize=17.5, fontweight="bold", color=INK)
    fig.text(0.055, 0.928,
             f"4 self-contained tasks, 1 repetition each, {payload['model']}. Pilot proxy for a prompt protocol, not a full agent runtime.",
             fontsize=9.8, color=MUTED)

    p = summary["plain"]
    k = summary["keep-going"]
    delta = (k["assertionRate"] - p["assertionRate"]) * 100
    fig.text(0.055, 0.902,
             f"This run: plain {p['assertionRate'] * 100:.1f}%, keep-going {k['assertionRate'] * 100:.1f}% ({delta:+.1f} points).",
             fontsize=9.6, color=ACCENT if delta < 0 else KEEP)
    fig.text(0.055, 0.878,
             f"The previous run went {abs(delta):.1f} points the other way. One repetition per cell, so neither run supports a claim of improvement.",
             fontsize=9.6, color=ACCENT if delta < 0 else KEEP)

    w = 0.36
    x = range(len(labels))
    b1 = ax0.bar([i - w / 2 for i in x], plain_scores, w, color=PLAIN, edgecolor="none", label="Plain accuracy prompt")
    b2 = ax0.bar([i + w / 2 for i in x], keep_scores, w, color=KEEP, edgecolor="none", label="Keep-going protocol")
    for bars, vals in ((b1, plain_scores), (b2, keep_scores)):
        for bar, v in zip(bars, vals):
            ax0.text(bar.get_x() + bar.get_width() / 2, v + 2, f"{v:.0f}%",
                     ha="center", va="bottom", fontsize=9.5, color=INK)
    ax0.set_xticks(list(x))
    ax0.set_xticklabels(["misleading\nclaim", "subtle\nbug", "conflicting\nspec", "source\ngrounding"],
                        fontsize=10, color=INK)
    ax0.set_ylim(0, 118)
    ax0.set_ylabel("Assertion pass rate (%)", fontsize=10, color=MUTED)
    ax0.set_title("Last run, per task", fontsize=12, color=INK, loc="left", pad=12)
    ax0.tick_params(axis="x", length=0, pad=8)
    ax0.grid(axis="y", color=RULE, linewidth=0.8, alpha=0.9)
    ax0.set_axisbelow(True)
    for spine in ("top", "right", "left"):
        ax0.spines[spine].set_visible(False)
    ax0.spines["bottom"].set_color(RULE)

    run_labels = [r["run"] for r in runs]
    deltas = [((r["keepGoing"]["passed"] - r["plain"]["passed"]) / r["plain"]["total"] * 100) for r in runs]
    colors = [KEEP if d > 0 else ACCENT if d < 0 else MUTED for d in deltas]
    bars = ax1.bar(range(len(runs)), deltas, 0.5, color=colors, edgecolor="none")
    for bar, d in zip(bars, deltas):
        ax1.text(bar.get_x() + bar.get_width() / 2, d + (2 if d >= 0 else -2),
                 f"{d:+.1f}", ha="center", va="bottom" if d >= 0 else "top",
                 fontsize=10.5, color=INK)
    ax1.axhline(0, color=INK, linewidth=1.0)
    ax1.set_xticks(range(len(runs)))
    ax1.set_xticklabels(["run 1\ncap 4096", "run 2\ncap 8192"], fontsize=10, color=INK)
    ax1.set_ylim(-14, 14)
    ax1.set_ylabel("Keep-going minus plain (points)", fontsize=10, color=MUTED)
    ax1.set_title("Same tasks, two runs: the sign flips", fontsize=12, color=INK, loc="left", pad=12)
    ax1.tick_params(axis="x", length=0, pad=8)
    ax1.grid(axis="y", color=RULE, linewidth=0.8, alpha=0.9)
    ax1.set_axisbelow(True)
    for spine in ("top", "right", "left"):
        ax1.spines[spine].set_visible(False)
    ax1.spines["bottom"].set_color(RULE)

    fig.legend(handles=[
        Patch(facecolor=PLAIN, label="Plain accuracy prompt"),
        Patch(facecolor=KEEP, label="Keep-going protocol"),
    ], loc="lower center", bbox_to_anchor=(0.5, 0.012), ncol=2, frameon=False, fontsize=10)

    fig.subplots_adjust(left=0.07, right=0.975, top=0.785, bottom=0.14)
    out = OUT / "pilot.png"
    fig.savefig(out, dpi=180)
    plt.close(fig)
    print(out)


if __name__ == "__main__":
    main()
