#!/usr/bin/env python3
"""Money making methods from the OSRS Wiki, with profit recomputed at this server's prices.

    # 1. fetch (polite: 50 pages per request, 1 s apart); writes <dir>/pages.json
    python3 -I docs/analysis/scripts/mmg_scrape.py fetch /tmp/mmg
    # 2. parse and price; writes money-making-methods.json and .csv into --out
    python3 -I docs/analysis/scripts/mmg_scrape.py parse /tmp/mmg --repo . --out docs/analysis/2026-11-24

Source: every "Money making guide/<method>" page with an {{Mmgtable}} template (activity, skills,
items, quests, inputs and outputs per action or per hour, actions per hour, location, category,
members, intensity). Wiki content is CC BY-NC-SA 3.0; the output credits the source.

Profit at server prices: inputs and outputs priced at the midpoint of server/data/definitions/
item-prices.json (the server's Grand Exchange reference). "Coins" counts as 1. Items the server
has no price for are listed in `unpriced`, and the profit is then marked incomplete.
"""
import argparse
import csv
import json
import os
import re
import subprocess
import time
import urllib.parse

API = "https://oldschool.runescape.wiki/api.php"
UA = "osrs-analysis-script (research)"


def curl(url):
    out = subprocess.run(["curl", "-sS", "-A", UA, "--max-time", "60", url], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def fetch(folder):
    os.makedirs(folder, exist_ok=True)
    titles, cont = [], None
    while True:
        url = f"{API}?action=query&list=allpages&apprefix=Money%20making%20guide/&aplimit=500&format=json"
        if cont:
            url += "&apcontinue=" + urllib.parse.quote(cont)
        data = curl(url)
        titles += [p["title"] for p in data["query"]["allpages"]]
        cont = (data.get("continue") or {}).get("apcontinue")
        if not cont:
            break
    titles = [t for t in titles if t.rstrip("/") != "Money making guide"]
    pages = {}
    for i in range(0, len(titles), 50):
        url = (f"{API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles="
               + urllib.parse.quote("|".join(titles[i:i + 50])))
        for page in curl(url)["query"]["pages"]:
            if page.get("revisions"):
                pages[page["title"]] = page["revisions"][0]["slots"]["main"]["content"]
        time.sleep(1)
    with open(os.path.join(folder, "pages.json"), "w", encoding="utf-8") as handle:
        json.dump(pages, handle)
    print("fetched", len(pages), "pages")


def template(text, name="Mmgtable"):
    """The parameters of the first {{name ...}}, nested templates and links kept intact."""
    start = text.lower().find("{{" + name.lower())
    if start < 0:
        return None
    depth, i = 0, start
    while i < len(text):
        if text.startswith("{{", i):
            depth += 1
            i += 2
            continue
        if text.startswith("}}", i):
            depth -= 1
            i += 2
            if depth == 0:
                break
            continue
        i += 1
    body = text[start + 2 + len(name):i - 2]
    params, current, depth_t, depth_l = [], "", 0, 0
    j = 0
    while j < len(body):
        two = body[j:j + 2]
        if two == "{{":
            depth_t += 1; current += two; j += 2; continue
        if two == "}}":
            depth_t -= 1; current += two; j += 2; continue
        if two == "[[":
            depth_l += 1; current += two; j += 2; continue
        if two == "]]":
            depth_l -= 1; current += two; j += 2; continue
        if body[j] == "|" and depth_t == 0 and depth_l == 0:
            params.append(current); current = ""; j += 1; continue
        current += body[j]
        j += 1
    params.append(current)
    out = {}
    for part in params:
        if "=" in part:
            key, value = part.split("=", 1)
            out[key.strip()] = value.strip()
    return out


def plain(value):
    value = re.sub(r"<!--.*?-->", "", value or "", flags=re.S)
    value = re.sub(r"\{\{SCP\|([^|}]+)\|([^|}]+)[^}]*\}\}", r"\1 \2", value)
    value = re.sub(r"\{\{(?:Coins|coins)\|([^}]*)\}\}", r"\1 coins", value)
    value = re.sub(r"\{\{[^{}]*\}\}", "", value)
    value = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", value)
    value = re.sub(r"<br\s*/?>", "; ", value)
    value = re.sub(r"<[^>]+>|'''?", "", value)
    return re.sub(r"\s+", " ", value).strip()


def number(value):
    """A quantity such as '60 / 27' or '1.5' (simple arithmetic only)."""
    text = plain(value).replace(",", "")
    if not re.fullmatch(r"[0-9.+\-*/() ]+", text or "x"):
        return None
    try:
        return float(eval(text, {"__builtins__": {}}, {}))  # digits and operators only
    except Exception:
        return None


def skills(value):
    return {s.strip(): int(l) for s, l in re.findall(r"\{\{SCP\|([^|}]+)\|(\d+)", value or "")}


def wiki_profits(path):
    """Hourly profit as the wiki's own table states it (money-making.csv from skill_progression_datasets.py)."""
    out = {}
    if path and os.path.exists(path):
        for row in csv.reader(open(path, encoding="utf-8")):
            if row and row[0] == "hourly":
                out[row[1].strip().lower()] = int(row[2])
    return out


def parse(folder, repo, out, wiki_csv=None):
    pages = json.load(open(os.path.join(folder, "pages.json"), encoding="utf-8"))
    defs = os.path.join(repo, "server/data/definitions")
    names = {}
    for item in json.load(open(os.path.join(defs, "item-gameplay.json"), encoding="utf-8")):
        if not item.get("noted"):
            names.setdefault(item["name"].lower(), item["id"])
    prices = json.load(open(os.path.join(defs, "item-prices.json"), encoding="utf-8"))["data"]
    # Buy limits per 4 hours, as the server's Grand Exchange applies them.
    market = json.load(open(os.path.join(repo, "server/plugins/interface/data/grand-exchange.json"), encoding="utf-8"))["data"]

    def price(name, buying):
        """Conservative: a bot that trades quickly buys at the high price and sells at the low one
        (illiquid items have a wide gap, e.g. unstrung comp bow 39,000 high, 938 low)."""
        if name.lower() == "coins":
            return 1.0
        item_id = names.get(name.lower())
        entry = prices.get(str(item_id)) if item_id is not None else None
        if not entry:
            return None
        high, low = entry.get("high"), entry.get("low")
        values = [v for v in ((high, low) if buying else (low, high)) if isinstance(v, (int, float))]
        return float(values[0]) if values else None

    wiki = wiki_profits(wiki_csv)
    methods = []
    for title, text in sorted(pages.items()):
        t = template(text)
        if not t or not t.get("Activity"):
            continue
        per_action = (t.get("isperkill") or "").lower().startswith("y")
        per_hour_count = number(t.get("kph", "")) if per_action else 1.0
        flows, unpriced, total = [], [], 0.0
        for kind, sign in (("Input", -1), ("Output", 1)):
            for n in range(1, 30):
                name = plain(t.get(f"{kind}{n}", ""))
                if not name:
                    continue
                count = number(t.get(f"{kind}{n}num", "1"))
                if count is None:
                    count = 1.0
                is_ph = (t.get(f"{kind}{n}isph") or "").lower().startswith("y")
                hourly = count * (1 if (is_ph or not per_action) else (per_hour_count or 0))
                unit = price(name, buying=sign < 0)
                if unit is None:
                    unpriced.append(name)
                else:
                    total += sign * unit * hourly
                flows.append({"kind": kind.lower(), "item": name, "perHour": round(hourly, 2), "price": unit})
        xp = {}
        for n in range(1, 10):
            skill = plain(t.get(f"Experience{n}", ""))
            amount = number(t.get(f"Experience{n}num", ""))
            if skill and amount:
                xp[skill] = round(amount * (per_hour_count if per_action and per_hour_count else 1))
        methods.append({
            "method": plain(t["Activity"]), "page": "https://oldschool.runescape.wiki/w/" + urllib.parse.quote(title.replace(" ", "_")),
            "category": plain(t.get("Category", "")), "skillCategory": plain(t.get("SkillCategory", "")),
            "intensity": plain(t.get("Intensity", "")), "members": plain(t.get("Members", "")).lower().startswith("y"),
            "skills": skills(t.get("Skill", "")), "skillsText": plain(t.get("Skill", "")),
            "quests": plain(t.get("Quest", "")), "items": plain(t.get("Item", "")), "other": plain(t.get("Other", "")),
            "location": plain(t.get("Location", "")), "actionsPerHour": per_hour_count if per_action else None,
            "xpPerHour": xp, "flows": flows, "serverProfitPerHour": round(total), "unpriced": sorted(set(unpriced)),
            "complete": not unpriced,
        })
        m = methods[-1]
        # The share of the hourly rate the buy limits allow: every bought input at most limit/4 an hour.
        cap = 1.0
        for flow in flows:
            if flow["kind"] != "input" or flow["item"].lower() == "coins" or not flow["perHour"]:
                continue
            limit = (market.get(str(names.get(flow["item"].lower()))) or {}).get("limit")
            if limit:
                cap = min(cap, (limit / 4) / flow["perHour"])
        m["buyLimitShare"] = round(cap, 3)
        m["serverProfitPerHourWithinLimits"] = round(total * cap)
        m["wikiProfitPerHour"] = wiki.get(m["method"].lower())
        w = m["wikiProfitPerHour"]
        # Drop tables (combat) and odd page maths do not reprice well: flag what differs over 3x.
        m["check"] = bool(not m["complete"] or m["category"].startswith("Combat") or
                          (w and w > 0 and not (w / 3 <= m["serverProfitPerHour"] <= w * 3)))
    os.makedirs(out, exist_ok=True)
    meta = {"source": "https://oldschool.runescape.wiki/w/Money_making_guide (CC BY-NC-SA 3.0)",
            "prices": "server/data/definitions/item-prices.json (midpoint of high and low)", "methods": methods}
    with open(os.path.join(out, "money-making-methods.json"), "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=1, ensure_ascii=False)
    with open(os.path.join(out, "money-making-methods.csv"), "w", newline="", encoding="utf-8") as handle:
        handle.write("# " + meta["source"] + "; profit at server prices, " + meta["prices"] + "\n")
        w = csv.writer(handle)
        w.writerow(["method", "category", "skill_category", "intensity", "members", "skills", "quests", "location",
                    "actions_per_hour", "server_profit_per_hour", "within_buy_limits", "wiki_profit_per_hour", "check", "complete", "xp_per_hour",
                    "inputs", "outputs", "page"])
        for m in sorted(methods, key=lambda m: -m["serverProfitPerHour"]):
            w.writerow([m["method"], m["category"], m["skillCategory"], m["intensity"], int(m["members"]),
                        json.dumps(m["skills"]), m["quests"], m["location"], m["actionsPerHour"] or "",
                        m["serverProfitPerHour"], m["serverProfitPerHourWithinLimits"], m["wikiProfitPerHour"] if m["wikiProfitPerHour"] is not None else "",
                        int(m["check"]), int(m["complete"]), json.dumps(m["xpPerHour"]),
                        "; ".join(f"{f['item']} {f['perHour']}/h" for f in m["flows"] if f["kind"] == "input"),
                        "; ".join(f"{f['item']} {f['perHour']}/h" for f in m["flows"] if f["kind"] == "output"), m["page"]])
    print("methods", len(methods), "complete", sum(m["complete"] for m in methods), "to check", sum(m["check"] for m in methods))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["fetch", "parse"])
    parser.add_argument("folder")
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", default=None)
    parser.add_argument("--wiki-csv", default="docs/analysis/2026-11-22/money-making.csv")
    args = parser.parse_args()
    if args.step == "fetch":
        fetch(args.folder)
    else:
        parse(args.folder, args.repo, args.out or args.folder, args.wiki_csv)


if __name__ == "__main__":
    main()
