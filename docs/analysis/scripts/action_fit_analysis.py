#!/usr/bin/env python3
"""Does the action a bot chose fit its level? (docs/analysis/2026-11-22-actiekeuze.md)

    python3 -I docs/analysis/scripts/action_fit_analysis.py /tmp/bot-logs --repo . \
        [--since 2026-11-21T08:48] [--out docs/analysis/2026-11-22]

Per 5-minute `bot` row: the activity, the bot's level in that skill (from the hourly `levels`
row), the activity's required level, and the best activity of that skill the bot could have
picked at that level. Also: combat stage band against the bot's combat level, the material tier of
buy-to-train jobs against the bot's level, and measured coins per hour of money jobs.
"""
import argparse
import bisect
import collections as C
import csv
import json
import os
import re

TEMPLATE_SKILL = {"chop_trees": "woodcutting", "mine_rocks": "mining", "catch_fish": "fishing",
                  "steal_from_stalls": "thieving"}
MODE_SKILL = {"mining": "mining", "woodcutting": "woodcutting", "fishing": "fishing", "thieving": "thieving",
              "agility": "agility", "hunter": "hunter", "farming": "farming"}
BUY_SKILL = {"buy_fletching": "fletching", "buy_firemaking": "firemaking", "buy_crafting": "crafting",
             "buy_herblore": "herblore", "buy_cooking": "cooking", "buy_smithing": "smithing",
             "buy_smelting": "smithing", "buy_prayer": "prayer", "buy_runecrafting": "runecrafting"}


def load(path):
    with open(path, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def activity_levels(repo):
    acts = json.load(open(os.path.join(repo, "server/data/definitions/bot-activities.json"), encoding="utf-8"))["activities"]
    out = {}
    for a in acts:
        fields = a.get("fields") if isinstance(a.get("fields"), dict) else {}
        skill = TEMPLATE_SKILL.get(a.get("template")) or MODE_SKILL.get(a.get("mode"))
        level = fields.get("level")
        if skill and isinstance(level, int):
            out[a["id"]] = (skill, level)
    return out


def buy_tiers(repo):
    data = json.load(open(os.path.join(repo, "server/plugins/bots/data/adventurers.json"), encoding="utf-8"))["buyToTrain"]
    out = {}
    for key, spec in data.items():
        if not isinstance(spec, dict) or "tiers" not in spec:
            continue
        tiers = []
        for level, items in spec["tiers"]:
            for item in items if isinstance(items, list) else [items]:
                tiers.append((level, re.sub(r"[^a-z]", "", item.lower())))
        out["buy_" + key.lower()] = sorted(tiers, reverse=True)
    return out


def level_lookup(rows):
    per = C.defaultdict(list)
    for r in rows:
        if r["kind"] == "levels":
            per[r["bot"]].append((r["at"], r["levels"], r.get("combat")))
    for v in per.values():
        v.sort(key=lambda x: x[0])

    def get(bot, at):
        series = per.get(bot)
        if not series:
            return None, None
        i = bisect.bisect_right([s[0] for s in series], at) - 1
        _, levels, combat = series[max(i, 0)]
        return levels, combat
    return get


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("logs")
    parser.add_argument("--repo", default=".")
    parser.add_argument("--since", default="")
    parser.add_argument("--out")
    args = parser.parse_args()
    rows = [r for r in load(os.path.join(args.logs, "adventurers-metrics.jsonl")) if r["at"] >= args.since]
    acts = activity_levels(args.repo)
    tiers = buy_tiers(args.repo)
    levels_at = level_lookup(rows)
    best_by_skill = C.defaultdict(list)
    for aid, (skill, lvl) in acts.items():
        best_by_skill[skill].append((lvl, aid))

    out, gap_minutes = [], C.Counter()
    for r in rows:
        if r["kind"] != "bot":
            continue
        minutes = sum((r.get("time") or {}).values())
        levels, combat = levels_at(r["bot"], r["at"])
        if not levels:
            continue
        aid, mode, reason = r.get("activity"), r.get("mode"), r.get("reason") or ""
        if aid in acts:
            skill, req = acts[aid]
            have = levels.get(skill, 1)
            best = max((lvl for lvl, a in best_by_skill[skill] if lvl <= have), default=req)
            best_ids = [a for lvl, a in best_by_skill[skill] if lvl == best]
            out.append(["activity", r["at"], r["bot"], mode, aid, skill, have, req, have - req, best, "/".join(best_ids),
                        best - req, round(minutes, 1), reason, combat])
        elif mode in BUY_SKILL and r.get("inventory"):
            skill = BUY_SKILL[mode]
            have = levels.get(skill, 1)
            names = {re.sub(r"[^a-z]", "", i["item"].lower()) for i in r["inventory"]}
            used = [lvl for lvl, item in tiers.get(mode, []) if any(item in n or n in item for n in names)]
            if used:
                req = max(used)
                best = max((lvl for lvl, _ in tiers.get(mode, []) if lvl <= have), default=req)
                out.append(["buy_tier", r["at"], r["bot"], mode, mode, skill, have, req, have - req, best, "",
                            best - req, round(minutes, 1), reason, combat])
        elif mode == "combat_training" and combat:
            target = (r.get("target") or {}).get("level")
            out.append(["combat", r["at"], r["bot"], mode, aid or "", "combat", combat, target or "", "", "", "", "",
                        round(minutes, 1), reason, combat])

    # Summary: minutes where a bot ran an activity 30+ levels below what it could do.
    big = [o for o in out if o[0] in ("activity", "buy_tier") and isinstance(o[11], int) and o[11] >= 15 and o[8] >= 30]
    total = sum(o[12] for o in out if o[0] in ("activity", "buy_tier"))
    print(f"rows {len(out)}; activity+buy minutes {round(total)}; 30+ levels over the activity while a 15+ level better one existed: {round(sum(o[12] for o in big))} min")
    why = C.Counter()
    for o in big:
        why[(o[4], re.sub(r"[0-9.]+", "#", o[13])[:40])] += o[12]
    for (aid, reason), m in why.most_common(15):
        print(f"  {aid:22} {round(m):5} min  {reason}")
    combat = [o for o in out if o[0] == "combat"]
    print("combat target vs combat level (min):", C.Counter((o[6] // 10 * 10, o[7]) for o in combat).most_common(12))

    money = [r for r in rows if r["kind"] == "job" and isinstance(r.get("coinsPerHour"), (int, float))]
    gp = C.defaultdict(list)
    for r in money:
        gp[r.get("activity") or r.get("mode")].append(r["coinsPerHour"])
    print("measured coins/hour (median, n):", sorted(((a, sorted(v)[len(v) // 2], len(v)) for a, v in gp.items()), key=lambda x: -x[1])[:15])

    if args.out:
        os.makedirs(args.out, exist_ok=True)
        path = os.path.join(args.out, "action-fit.csv")
        with open(path, "w", newline="", encoding="utf-8") as handle:
            w = csv.writer(handle)
            w.writerow(["kind", "at", "bot", "mode", "activity", "skill", "bot_level", "activity_level", "level_over",
                        "best_level", "best_activity", "best_minus_chosen", "minutes", "reason", "combat"])
            w.writerows(out)
        print("wrote", path, len(out))


if __name__ == "__main__":
    main()
