#!/usr/bin/env python3
"""Compare server versions on the adventurer logs: one block of key figures per group of versions.

    python3 -I docs/analysis/scripts/version_report.py /tmp/bot-logs \
        --group "57=b943103e0,3f8a80352,f0f7b9959" --group "61=aa5373793"

Each --group is name=v1,v2,... (versions with the same bot code). Without --group, the last three
versions each get their own block. Figures: time split, slow_bot (with brainSnapshot), held
activities still running, combat stuck share, money-choice reasons, quest-gather jobs, deaths,
Barrows outcomes, loot refusals, the knowledge tables' measured entries, walk_blocked hotspots.
"""
import argparse
import collections as C
import json
import os

HELD = ("boss_giant_mole", "process_runecrafting_air")


def load(path):
    with open(path, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def report(name, rows, activity):
    bots = [r for r in rows if r["kind"] == "bot"]
    if not bots:
        print(f"\n== {name}: no bot rows")
        return
    time = C.Counter()
    for r in bots:
        for k, m in (r.get("time") or {}).items():
            time[k] += m
    total = sum(time.values()) or 1
    jobs = [r for r in rows if r["kind"] == "job"]
    combat = [r for r in jobs if r.get("mode") == "combat_training"]
    decisions = [r for r in rows if r["kind"] == "decision"]
    money = [r for r in decisions if r["path"] == "money"]
    print(f"\n== {name}: {rows[0]['at'][5:16]} .. {rows[-1]['at'][5:16]}, {len({r['bot'] for r in bots})} bots, {round(total)} bot-min")
    print("  time %:", {k: round(v / total * 100, 1) for k, v in time.most_common()})
    slow = [r for r in rows if r["kind"] == "slow_bot"]
    print("  slow_bot:", len(slow), [((r.get("before") or {}).get("activity"), r.get("ms"), json.dumps(r.get("brainSnapshot"))[:70]) for r in slow][:8])
    held = [r for r in bots if r.get("activity") in HELD]
    print("  held activities still running (bot rows):", len(held), C.Counter((r.get("activity"), r.get("reason")) for r in held).most_common(4))
    print("  combat jobs:", len(combat), "stuck:", sum(1 for r in combat if r.get("ended") == "stuck"))
    print("  money decisions:", len(money), C.Counter((r["chosen"].get("reason") or "")[:40] for r in money).most_common(5))
    gather = [r for r in jobs if " voor " in (r.get("reason") or "") and r.get("ended") == "full bag"]
    print("  quest-gather jobs ending on a full bag:", len(gather), C.Counter(r.get("activity") for r in gather).most_common(3))
    print("  deaths:", [(r["bot"], r.get("killer"), r.get("reason")) for r in rows if r["kind"] == "death"])
    print("  barrows:", C.Counter((r.get("result"), r.get("why")) for r in rows if r["kind"] == "barrows_run"))
    refused = [a for a in activity if "refused" in a.get("text", "").lower() or "laat liggen" in a.get("text", "").lower() or "niet oprapen" in a.get("text", "").lower()]
    print("  loot refused lines:", len(refused))
    knowledge = {}
    for r in rows:
        if r["kind"] == "knowledge":
            knowledge[r["clan"]] = sum(1 for v in r["table"].values() if (v.get("n") or 0) > 0)
    print("  knowledge measured entries per clan:", knowledge)
    print("  stuck:", C.Counter(r.get("activity") for r in rows if r["kind"] == "stuck").most_common(6))
    print("  walk_blocked:", C.Counter((r.get("to") or {}).get("name") for r in rows if r["kind"] == "walk_blocked").most_common(5))
    quests = [r for r in rows if r["kind"] == "quest_end"]
    print("  quest_end:", C.Counter(r["outcome"] for r in quests))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("logs")
    parser.add_argument("--group", action="append", default=[])
    args = parser.parse_args()
    rows = load(os.path.join(args.logs, "adventurers-metrics.jsonl"))
    activity = load(os.path.join(args.logs, "adventurers-activity.jsonl"))
    groups = []
    for spec in args.group:
        name, versions = spec.split("=", 1)
        groups.append((name, set(versions.split(","))))
    if not groups:
        order = list(dict.fromkeys(r.get("v") for r in rows))
        groups = [(v, {v}) for v in order[-3:]]
    for name, versions in groups:
        report(name, [r for r in rows if r.get("v") in versions], [a for a in activity if a.get("v") in versions])


if __name__ == "__main__":
    main()
