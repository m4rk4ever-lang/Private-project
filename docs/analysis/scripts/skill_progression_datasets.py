#!/usr/bin/env python3
"""Datasets for the skill-progression analysis (docs/analysis/2026-11-22-skill-progressie.md).

    python3 -I docs/analysis/scripts/skill_progression_datasets.py --repo . \
        --out docs/analysis/2026-11-22 [--mmg-html /path/to/Money_making_guide.html]

Writes:
- monster-weakness.csv: every attackable monster that has a spawn on this server, with its
  defence per attack style and the style it is weakest to (target side only: the attacker's own
  bonuses are not in it). Source: server/data/definitions/monsters-complete.json + npc-spawns.json.
- training-targets.csv: per stage of the bots' combat_training activity, the monsters in that
  stage's level range ranked by how easy they are to hit, with hitpoints and max hit.
- money-making.csv (with --mmg-html): the OSRS Wiki money making table, rendered page saved with
  `curl 'https://oldschool.runescape.wiki/w/Money_making_guide?action=render'`.
  Wiki content is CC BY-NC-SA 3.0; the CSV credits the source page.
"""
import argparse
import collections as C
import csv
import json
import os
import re
from html.parser import HTMLParser

ELEMENTS = {1: "air", 2: "water", 3: "earth", 4: "fire"}


def eff(level, bonus):
    """OSRS defence roll shape: (level + 9) * (bonus + 64)."""
    return (max(0, level or 0) + 9) * (max(-64, bonus or 0) + 64)


def style_profile(m):
    melee = {k: m.get(f"defence_{k}") or 0 for k in ("stab", "slash", "crush")}
    melee_style = min(melee, key=melee.get) if len(set(melee.values())) > 1 else "any"
    ranged = {k: m.get(f"defence_ranged_{k}") if m.get(f"defence_ranged_{k}") is not None else m.get("defence_ranged") or 0
              for k in ("light", "standard", "heavy")}
    ranged_style = min(ranged, key=ranged.get) if len(set(ranged.values())) > 1 else "any"
    rolls = {
        f"melee_{melee_style}": eff(m.get("defence_level"), min(melee.values())),
        f"ranged_{ranged_style}": eff(m.get("defence_level"), min(ranged.values())),
        "magic": eff(m.get("magic_level"), m.get("defence_magic")),
    }
    weak = m.get("elemental_weakness_type")
    pct = m.get("elemental_weakness_percent") or 0
    if weak in ELEMENTS and pct > 0:
        rolls["magic"] = rolls["magic"] / (1 + pct / 100)
    best = min(rolls, key=rolls.get)
    return melee, melee_style, ranged, ranged_style, rolls, best, ELEMENTS.get(weak, ""), pct


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as handle:
        out = csv.writer(handle)
        out.writerow(header)
        out.writerows(rows)
    print("wrote", path, len(rows), "rows")


def monsters(repo):
    defs = os.path.join(repo, "server/data/definitions")
    data = json.load(open(os.path.join(defs, "monsters-complete.json"), encoding="utf-8"))
    spawns = json.load(open(os.path.join(defs, "npc-spawns.json"), encoding="utf-8"))
    spawns = [s for s in spawns if "id" in s]
    count = C.Counter(s["id"] for s in spawns)
    where = {}
    for s in spawns:
        where.setdefault(s["id"], (s["x"], s["y"]))
    out = {}
    for key, m in data.items():
        mid = m.get("id")
        if not count.get(mid) or not m.get("combat_level") or not m.get("hitpoints"):
            continue
        out[mid] = (m, count[mid], where[mid])
    return out


def monster_rows(mons):
    rows = []
    for mid, (m, spawns, (x, y)) in sorted(mons.items(), key=lambda kv: (kv[1][0]["combat_level"], kv[1][0]["name"])):
        melee, ms, ranged, rs, rolls, best, element, pct = style_profile(m)
        rows.append([mid, m["name"], m["combat_level"], m["hitpoints"], m.get("max_hit") or 0,
                     "/".join(m.get("attack_type") or []), int(bool(m.get("aggressive"))),
                     int(bool(m.get("poisonous") or m.get("venomous"))), m.get("defence_level") or 0,
                     melee["stab"], melee["slash"], melee["crush"], ranged["light"], ranged["standard"], ranged["heavy"],
                     m.get("magic_level") or 0, m.get("defence_magic") or 0, element, pct, best,
                     round(rolls[best]), m.get("slayer_level") or "", "/".join(m.get("slayer_masters") or []),
                     spawns, x, y, int(bool(m.get("members")))])
    return rows


def hubs(repo):
    data = json.load(open(os.path.join(repo, "server/plugins/bots/data/travel-hubs.json"), encoding="utf-8"))
    return {k: v for k, v in data["hubs"].items() if isinstance(v, list) and len(v) >= 2 and all(isinstance(n, (int, float)) for n in v[:2])}


def nearest_hub(points, xy):
    best = min(points.items(), key=lambda kv: max(abs(kv[1][0] - xy[0]), abs(kv[1][1] - xy[1])))
    return best[0], max(abs(best[1][0] - xy[0]), abs(best[1][1] - xy[1]))


def training_rows(repo, mons, max_hub_tiles=120):
    points = hubs(repo)
    acts = json.load(open(os.path.join(repo, "server/data/definitions/bot-activities.json"), encoding="utf-8"))["activities"]
    spec = next(a for a in acts if a["id"] == "combat_training")["actions"][0]
    excluded = {n.lower() for n in spec.get("excludeNames", [])}
    rows = []
    for stage in spec["stages"]:
        lo, hi = stage["npcLevels"]["min"], stage["npcLevels"]["max"]
        cands = C.defaultdict(lambda: [None, 0, None])
        for mid, (m, spawns, xy) in mons.items():
            name = m["name"]
            if not (lo <= m["combat_level"] <= hi) or name.lower() in excluded or m["hitpoints"] < 5:
                continue
            entry = cands[(name, m["combat_level"])]
            entry[0] = m
            entry[1] += spawns
            entry[2] = entry[2] or xy
        ranked = []
        for (name, lvl), (m, spawns, xy) in cands.items():
            if spawns < 3:
                continue
            if 2944 <= xy[0] <= 3392 and 3520 <= xy[1] <= 3970:  # Wilderness: never a training spot
                continue
            hub, tiles = nearest_hub(points, xy)
            if tiles > max_hub_tiles:
                continue
            melee, ms, ranged, rs, rolls, best, element, pct = style_profile(m)
            melee_roll = rolls[f"melee_{ms}"]
            # Easy to hit and enough hitpoints that the walk to the next one matters less.
            score = (m["hitpoints"] / (m["hitpoints"] + 15)) * 10000 / max(1, melee_roll)
            ranked.append((score, name, lvl, m, spawns, xy, ms, best, element, pct, hub, tiles))
        ranked.sort(key=lambda r: -r[0])
        for rank, (score, name, lvl, m, spawns, xy, ms, best, element, pct, hub, tiles) in enumerate(ranked[:12], 1):
            rows.append([stage["id"], stage["minLevel"], f"{lo}-{hi}", rank, name, lvl, m["hitpoints"], m.get("max_hit") or 0,
                         int(bool(m.get("aggressive"))), ms, best, element, round(score, 2), spawns, xy[0], xy[1], hub, tiles])
    return rows


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.depth, self.row, self.cell = [], 0, None, None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            self.depth += 1
            if self.depth == 1:
                self.tables.append([])
        if self.depth == 1 and tag == "tr":
            self.row = []
        if self.depth == 1 and tag in ("td", "th"):
            self.cell = ""
        if tag == "img" and self.cell is not None:
            alt = (attrs.get("alt") or "").replace(" icon", "").replace(".png", "")
            if alt:
                self.cell += " " + alt.split(" ")[0] + ":"

    def handle_endtag(self, tag):
        if tag == "table":
            self.depth -= 1
        if self.depth == 1 and tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(re.sub(r"\s+", " ", self.cell).strip())
            self.cell = None
        if self.depth == 1 and tag == "tr" and self.row is not None:
            self.tables[-1].append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data


def money_rows(path):
    parser = TableParser()
    parser.feed(open(path, encoding="utf-8").read())
    rows = []
    for r in parser.tables[0][1:]:
        if len(r) < 5:
            continue
        reqs = dict((k.strip(), v.strip()) for k, v in re.findall(r"([A-Z][a-z]+):\s*([0-9]+\+?)", r[2]))
        quest = "yes" if re.search(r"Quest|quest", r[2]) else ""
        profit = int(re.sub(r"[^0-9-]", "", r[1]) or 0)
        rows.append(["hourly", r[0], profit, r[3], r[4], json.dumps(reqs), quest, int("Members" in r[5])])
    for r in parser.tables[1][1:]:
        if len(r) < 7:
            continue
        reqs = dict((k.strip(), v.strip()) for k, v in re.findall(r"([A-Z][a-z]+):\s*([0-9]+\+?)", r[5]))
        profit = int(re.sub(r"[^0-9-]", "", r[3]) or 0)
        rows.append(["recurring", r[0], profit, r[6], "", json.dumps(reqs), "yes" if "Quest" in r[5] else "", int("Members" in r[7]) if len(r) > 7 else 1])
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", required=True)
    parser.add_argument("--mmg-html")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    mons = monsters(args.repo)
    write_csv(os.path.join(args.out, "monster-weakness.csv"),
              ["id", "name", "combat", "hitpoints", "max_hit", "attack_types", "aggressive", "poison_or_venom",
               "defence_level", "def_stab", "def_slash", "def_crush", "def_ranged_light", "def_ranged_standard",
               "def_ranged_heavy", "magic_level", "def_magic", "elemental_weakness", "elemental_pct",
               "lowest_defence_roll_style", "lowest_defence_roll", "slayer_level", "slayer_masters", "spawns", "x", "y", "members"],
              monster_rows(mons))
    write_csv(os.path.join(args.out, "training-targets.csv"),
              ["stage", "bot_min_combat", "npc_levels", "rank", "name", "combat", "hitpoints", "max_hit", "aggressive",
               "best_melee_style", "lowest_defence_roll_style", "elemental_weakness", "score", "spawns", "x", "y", "nearest_hub", "hub_tiles"],
              training_rows(args.repo, mons))
    if args.mmg_html:
        path = os.path.join(args.out, "money-making.csv")
        rows = money_rows(args.mmg_html)
        with open(path, "w", newline="", encoding="utf-8") as handle:
            handle.write("# Source: https://oldschool.runescape.wiki/w/Money_making_guide (CC BY-NC-SA 3.0); prices change, regenerate before use\n")
            out = csv.writer(handle)
            out.writerow(["kind", "method", "gp_per_hour_or_effective", "category", "intensity", "skill_requirements", "has_quest_requirement", "members"])
            out.writerows(rows)
        print("wrote", path, len(rows), "rows")


if __name__ == "__main__":
    main()
