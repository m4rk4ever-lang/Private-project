#!/usr/bin/env python3
"""Runtime analysis of the adventurer logs (branch bot-logs).

Reproduces the figures in docs/analysis/2026-11-21-runtime-analyse.md and writes the
datasets next to it. Run it outside the repository data, on a copy of the logs:

    git fetch --depth 1 origin +refs/heads/bot-logs:refs/remotes/origin/bot-logs
    mkdir -p /tmp/bot-logs
    for f in adventurers-activity adventurers-metrics adventurer-quest-feedback; do
      git show origin/bot-logs:bot-logs/$f.jsonl > /tmp/bot-logs/$f.jsonl
    done
    python3 -I docs/analysis/scripts/bot_log_analysis.py /tmp/bot-logs \
        --since 2026-11-21T08:48 --repo . --out docs/analysis/2026-11-21

--since filters on `at` (UTC, ISO prefix). Without --out it only prints.
"""
import argparse
import collections as C
import csv
import json
import os
import sys


def load(path):
    with open(path, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def minutes(row):
    return sum((row.get("time") or {}).values())


def time_share(bots):
    total = C.Counter()
    for row in bots:
        for kind, mins in (row.get("time") or {}).items():
            total[kind] += mins
    whole = sum(total.values()) or 1
    return {k: round(v / whole * 100, 1) for k, v in total.most_common()}, whole


def frozen_bots(bots):
    """0 XP and within 15 tiles on the same floor for 6+ consecutive bot rows (30 min)."""
    streak, frozen = {}, C.Counter()
    for row in bots:
        where = row.get("where") or [0, 0, 0]
        prev = streak.get(row["bot"])
        near = prev and max(abs(where[0] - prev[0][0]), abs(where[1] - prev[0][1])) <= 15 and where[2] == prev[0][2]
        streak[row["bot"]] = (prev[0], prev[1] + 1) if prev and near and not row.get("xpGained") else (where, 1)
        if streak[row["bot"]][1] >= 6:
            frozen[row["bot"]] += 1
    return frozen


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as handle:
        out = csv.writer(handle)
        out.writerow(header)
        out.writerows(rows)
    print("wrote", path)


def activity_health(rows):
    """Per mode: bot-minutes, time split, main skill and its XP/hour, jobs, stuck."""
    per = C.defaultdict(lambda: {"min": 0.0, "time": C.Counter(), "xp": C.Counter(), "jobs": 0, "short": 0, "stuck": 0})
    for row in rows:
        if row["kind"] == "bot":
            entry = per[row.get("mode") or row.get("phase") or "?"]
            entry["min"] += minutes(row)
            for kind, mins in (row.get("time") or {}).items():
                entry["time"][kind] += mins
            for skill, xp in (row.get("xpGained") or {}).items():
                entry["xp"][skill] += xp
        elif row["kind"] == "job":
            entry = per[row.get("mode") or "?"]
            entry["jobs"] += 1
            entry["short"] += 1 if row.get("minutes", 0) < 2 else 0
            if row.get("ended") == "stuck":
                entry["stuck"] += 1
    out = []
    for mode, e in sorted(per.items(), key=lambda kv: -kv[1]["min"]):
        if e["min"] < 1:
            continue
        skill, xp = e["xp"].most_common(1)[0] if e["xp"] else ("", 0)
        whole = sum(e["time"].values()) or 1
        out.append([mode, round(e["min"]), skill.lower(), round(xp / (e["min"] / 60)) if skill else 0,
                    round(e["time"]["working"] / whole * 100, 1), round(e["time"]["errand"] / whole * 100, 1),
                    round(e["time"]["idle"] / whole * 100, 1), e["jobs"], e["short"], e["stuck"]])
    return out


def errands(rows):
    per = C.defaultdict(lambda: [0, 0.0, C.Counter()])
    for row in rows:
        if row["kind"] != "errand":
            continue
        entry = per[(row.get("reason"), row.get("to"))]
        entry[0] += 1
        entry[1] += row.get("seconds", 0)
        entry[2][row.get("ended")] += 1
    out = []
    for (reason, to), (n, secs, ended) in sorted(per.items(), key=lambda kv: -kv[1][1]):
        out.append([reason, to, n, round(secs / 60), round(secs / n), ended["arrived"], ended["near"], ended["blocked"],
                    round(ended["near"] / n * 100), round(ended["blocked"] / n * 100)])
    return out


def walk_hotspots(rows):
    per = C.defaultdict(list)
    for row in rows:
        if row["kind"] == "walk_blocked" and row.get("where"):
            w = row["where"]
            per[(w[0] // 8 * 8, w[1] // 8 * 8, w[2])].append(row)
    out = []
    for (x, y, z), hits in sorted(per.items(), key=lambda kv: -len(kv[1])):
        if len(hits) < 5:
            break
        door = C.Counter((r.get("door") or {}).get("outcome") or "none" for r in hits)
        plan = C.Counter((r.get("route") or {}).get("plan") or "none" for r in hits)
        to = C.Counter((r.get("to") or {}).get("name") for r in hits).most_common(2)
        out.append([x, y, z, len(hits), len({r["bot"] for r in hits}), "; ".join(f"{k} {v}" for k, v in door.most_common(3)),
                    "; ".join(f"{k} {v}" for k, v in plan.most_common(3)), "; ".join(f"{k} ({v})" for k, v in to)])
    return out


def quests(rows):
    per = C.defaultdict(C.Counter)
    mins = C.Counter()
    for row in rows:
        if row["kind"] == "quest_end":
            per[row["quest"]][row["outcome"]] += 1
            mins[row["quest"]] += row.get("minutes", 0)
    out = []
    for quest, counts in sorted(per.items(), key=lambda kv: -sum(kv[1].values())):
        n = sum(counts.values())
        out.append([quest, n, counts["done"], round(counts["done"] / n * 100), counts["failed"], counts["gather"], round(mins[quest])])
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("logs")
    parser.add_argument("--since", default="")
    parser.add_argument("--repo", default=None, help="repository root, for the registry audit")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    rows = [r for r in load(os.path.join(args.logs, "adventurers-metrics.jsonl")) if r["at"] >= args.since]
    bots = [r for r in rows if r["kind"] == "bot"]
    share, whole = time_share(bots)
    print(f"window {rows[0]['at']} .. {rows[-1]['at']}, {len({r['bot'] for r in bots})} bots, {round(whole)} bot-min")
    print("time %", share)
    print("frozen", frozen_bots(bots).most_common(10))
    versions = C.OrderedDict()
    for r in rows:
        versions.setdefault(r.get("v"), [r["at"], r["at"]])[1] = r["at"]
    print("versions", {v: f"{a[11:16]}-{b[11:16]}" for v, (a, b) in versions.items()})
    slow = [r for r in rows if r["kind"] == "slow_bot"]
    print("slow_bot by activity", C.Counter((r.get("before") or {}).get("activity") for r in slow).most_common())
    dec = [r for r in rows if r["kind"] == "decision"]
    print("blocked before choice", C.Counter((k, v.get("why")) for r in dec for k, v in (r.get("blocked") or {}).items()).most_common(10))
    print("deaths", [(r["bot"], r.get("killer"), r.get("reason")) for r in rows if r["kind"] == "death"])

    if not args.out:
        return
    os.makedirs(args.out, exist_ok=True)
    write_csv(os.path.join(args.out, "activity-health.csv"),
              ["mode", "bot_min", "main_skill", "xp_per_hour", "work_pct", "errand_pct", "idle_pct", "jobs", "jobs_under_2min", "jobs_stuck"],
              activity_health(rows))
    write_csv(os.path.join(args.out, "errands.csv"),
              ["reason", "to", "n", "minutes", "avg_seconds", "arrived", "near", "blocked", "near_pct", "blocked_pct"], errands(rows))
    write_csv(os.path.join(args.out, "walk-blocked-hotspots.csv"),
              ["x8", "y8", "z", "events", "bots", "door_outcome", "route_plan", "top_destinations"], walk_hotspots(rows))
    write_csv(os.path.join(args.out, "quest-outcomes.csv"),
              ["quest", "attempts", "done", "done_pct", "failed", "gather", "minutes"], quests(rows))

    if args.repo:
        acts = json.load(open(os.path.join(args.repo, "server/data/definitions/bot-activities.json"), encoding="utf-8"))
        acts = acts if isinstance(acts, list) else acts.get("activities", [])
        wanted = ["requires", "produces", "xpBand", "gp", "risk", "travel", "unlocks"]
        write_csv(os.path.join(args.out, "activity-registry-audit.csv"),
                  ["id", "mode", "template"] + [f"has_{k}" for k in wanted],
                  [[a.get("id"), a.get("mode", ""), a.get("template", "")] + [int(k in a) for k in wanted] for a in acts])
        bots_dir = os.path.join(args.repo, "server/plugins/bots/data")
        data = json.load(open(os.path.join(bots_dir, "adventurers.json"), encoding="utf-8"))
        granted = set(data["grantedQuests"]["quests"])
        gear = json.load(open(os.path.join(bots_dir, "adventurer-gear.json"), encoding="utf-8"))
        hits = []

        def walk(node):
            if isinstance(node, dict):
                needed = node.get("quests") or node.get("quest") or []
                for quest in needed if isinstance(needed, list) else [needed]:
                    if quest in granted:
                        hits.append([node.get("item") or node.get("name"), quest, node.get("level", "")])
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        walk(gear)
        write_csv(os.path.join(args.out, "gear-behind-granted-quests.csv"), ["item", "granted_quest", "level"], hits)


if __name__ == "__main__":
    sys.exit(main())
