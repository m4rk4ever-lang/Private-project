# Observability

Hoe een operator ziet wat een avonturier doet, waarom, en waar het misgaat. Grondslag:
[`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) §29 tot §33. Beschermd volgens
[ADR-0004](adr/0004-beschermde-functionaliteit.md): bestaande bronnen en velden blijven bestaan.

## Bronnen

| Bron | Wat | Voor wie |
| --- | --- | --- |
| `server/logs/adventurers-activity.jsonl` | Elke journaalregel van elke avonturier, met tijd, plek en `v` | Terugkijken wat er gebeurde |
| `server/logs/adventurers-metrics.jsonl` | Metrics per 5 minuten en per gebeurtenis (zie hieronder) | Prioriteren, analyseren |
| `server/logs/adventurer-quest-feedback.jsonl` | Vastgelopen quests: stap, helperstap, plek, dialoog, pogingen | Quest-fixes |
| Branch `bot-logs` | De laatste 20.000 regels van elk log, elke 5 minuten en bij afsluiten gepusht door de server | Lezen vanaf een andere machine |
| `/api/adventurers` en `client/public/adventurers.html` | Dashboard: clans, levels, gear, journaal, achievements, `questFeedback` | Eigenaar |
| `::volg <naam>` | Camera op de bot, chat met zijn acties, inventaris, uitrusting, skills, quests en combattab gespiegeld. **Nieuw (20-11-2026):** bij een avonturier ook `Doel / Bezig / Reden` en `Onderweg naar … : …` zodra die veranderen, en elke 2 min XP/uur, vermogen en plek (event `adventurers:status`) | Eigenaar in game |
| `::botinfo <naam>` | Looptarget en huidig segment van een bot | Debuggen van routes |
| Serverlog (`LOG_DISABLED_TYPES=npc.face,Combat`) | `bot_errand_failed` (stuck, no-closer, too-long), `bot_errand_replan`, `bot_errand_teleport` | Debuggen van errands |

Elke regel in de drie JSONL-logs heeft `at` (ISO-tijd, UTC) en `v` (korte git-commit van de
draaiende server). Vergelijk altijd per `v`: een fix telt pas als de regels van de nieuwe versie
het laten zien.

## Ophalen

```bash
git fetch --depth 1 origin +refs/heads/bot-logs:refs/remotes/origin/bot-logs
mkdir -p /tmp/bot-logs
for f in adventurers-activity adventurers-metrics adventurer-quest-feedback; do
  git show origin/bot-logs:bot-logs/$f.jsonl > /tmp/bot-logs/$f.jsonl
done
```

De cap van 20.000 regels per log betekent dat het activiteitenlog vaak maar 4 à 5 uur dekt. Kijk
naar de eerste en laatste `at` voordat je conclusies trekt.

## Metric-soorten (`kind`)

| `kind` | Wanneer | Belangrijkste velden |
| --- | --- | --- |
| `bot` | Elke 5 min per avonturier (`ADVENTURER_METRICS_MS`) | `phase`, `mode`, `reason`, `goal`, `where`, `xpGained`, `xpPerHour`, `coins`, `time` (minuten per soort: working, walking, errand, quest, idle, new, waiting), `events`, `inventory`, `freeSlots`, `errand`, `savedTask` |
| `job` | Einde van een klus | `mode`, `ended`, `minutes`, `xp`, `coinsPerHour`, `targetMet` |
| `goal` | Doel gezet, gehaald of geschrapt | minuten sinds zetten |
| `idle` | Een minuut zonder XP op de klus | plek, hp, in gevecht, vrije slots |
| `stuck` | Klus zonder voortgang (max 1 per minuut per bot) | `activity`, `action`, `describe`, `npcsNear`, `where`, `home` |
| `walk_blocked` | Route die niet lukte | `reason`, `to`, `where`, `tilesLeft`, `doorAttempt` |
| `stranded` | Home teleport na 3 keer vastlopen op dezelfde plek | `where` |
| `death` | Avonturier stierf | `killer`, `killerLevel`, `hadFood`, `reason` |
| `teleport` | Teleport onderweg | `how`, `name`, `to`, `reason` |
| `toll_gate`, `level_hop` | Tolpoort Al Kharid, trap of ladder op een route | |
| `quest_done`, `quest_fetch` | Quest voltooid, quest-item gehaald | `dialogue`, `got`, `have` |
| `barrows_run` | Eén Barrows-run | kosten en lootwaarde |
| `skills` | Elke 5 min: welke skills getraind, door wie, `untouched` | |
| `server` | Elke 5 min: aantallen, tick-duur, geheugen, `questsBlocked` | |
| `bank_nothing` | **Nieuw (20-11-2026).** Bank bij een volle tas kon niets aannemen | `bank`, `where`, `freeSlots`, `bag` |
| `decision` | **Nieuw (20-11-2026).** Elke keuze van de planner (`chooseNext`), ook als de klus niet startte | `attempt`, `started`, `path` (`boss`, `quest`, `money`, `money_boss`, `quest_gap`, `weighted`, `fallback`), `chosen` (`kind`, `mode`, `skill`, `quest`, `boss`, `reason`), `chance` (% bij `weighted`), `alternatives` (beste 3: `mode` met `weight` en `chance`, of `gpPerHour` bij `money`, of quests), `candidates`, `quest` en `missing` (bij `quest_gap`), `excluded`, `goal`, en sinds Fase 4 `failure` als de klus niet startte: `{ why, detail }` met `why` = `no_style_gear`, `no_bank_near`, `no_agility_course`, `no_activity`, `place_unreachable` (met `place` x, y, z), `tool_unbuyable`, `no_site`, `no_buy_plan`, `too_poor`, `skill_level`, `no_quest_playthrough`, `item_missing`, `not_buyable` (met `because`: `no_exchange_price`, `coins`, `exchange_resting`, `exchange_blocked`), `errand_refused` (met `why`: `busy`, `errands_resting`, `place_blocked`, `loop_blocked`, `on_roof`, `no_brain`, en `to`/`place`) of `unknown`; en `blocked` (alleen bij `attempt` 0): wat `canExecute` vóór de keuze uitsloot, per modus of `boss:<id>`, met `why` en `detail` (`remembered: true` als het een onthouden mislukking is) |
| `loop` | **Nieuw (20-11-2026, na `e59bc71`).** Dezelfde boodschap (reden en plek) 8 keer in 5 min zonder XP; die boodschap 15 min geweigerd | `reason`, `to`, `repeats`, `seconds`, `recent` (laatste 10 boodschappen), `phase`, `plan`, `savedTask`, `goal`, `trade` (waarom `trade()` ging: `waiting`, `fund`, `worth`, `full`, `cluttered`, `goods`), `ge` (`finished`, `waiting`, `freeSlots`), `coins`, `freeSlots` |
| `buy_nothing` | **Nieuw (20-11-2026, na `84ecd13`).** Koopbezoek aan de GE dat niets kocht; 30 min geen nieuw GE-koopbezoek | `items`, `why` (`no-slot`, `not-exchangeable`, `refused`, `coins`, `unknown`), `geFreeSlots`, `geWaiting`, `geWaitingBuys`, `coins` |
| `errand` | **Nieuw (20-11-2026, na `e210ce9`).** Einde van elke boodschap via `walkTo` | `reason`, `to`, `ended` (`arrived`, `near`, `toll_gate`, `blocked`), `why` (`stuck`, `no-closer`, `too-long`, of `null` bij aankomst), `seconds`, `tilesLeft`, `teleport`, `hop`, `where` |

`errand.ended`: `arrived` = binnen 3 tegels (`ARRIVE_TILES`). `near` = de runner gaf op, maar de
bot stond binnen 15 tegels (`NEAR_ENOUGH_TILES`) en dat telt als aangekomen; vaak een bank door de
muur, na minstens 45 seconden stilstaan. Een errand die stopt omdat de bot stierf of uitlogde
schrijft geen regel. Een trap of ladder onderweg geeft twee regels; de eerste heeft `hop: true`.
Vanaf de versie na `84ecd13`: een errand korter dan 3 seconden (`INSTANT_ERRAND_MS`, de bot stond
er al) krijgt geen eigen regel maar telt als event `errandInstant` in `bot.events`. Een hoog getal
daar is een lus. In `84ecd13` zelf schreven zulke lussen 12.000 regels per uur.

Events in `bot.events`: `stuck`, `walkBlocked`, `errandIdle`, `idle`, `questFailed`, `fledLowHp`,
`died`, `teleportedOut`, `targetReached`, en nieuw `bankNothing`, `buyNothing`, `errandInstant`, `loop` en `loadoutBanked` (een bankbezoek zette spullen buiten de loadout weg).

## Kerncijfers

Deze cijfers zeggen het meest over de gezondheid van het platform. Ze zijn uit de `bot`-regels af
te leiden zonder nieuwe instrumentatie.

| Cijfer | Hoe | Stand 17-11-2026 (`7a8e40b`, 4,9 uur, 60 avonturiers) |
| --- | --- | --- |
| Werkaandeel | `time.working` / som van `time` | 15,1% |
| Errand-aandeel | `time.errand` / som van `time` | 57,6% (44,3% zonder de bevroren bots) |
| Bevroren bots | Bot met 0 XP en binnen 15 tegels in 6 of meer opeenvolgende `bot`-regels (30 min) | 15 van 60 |
| Stuck per uur | `events.stuck` per bot per uur | zie analyse |
| Doden zonder eten | `death.reason` | 24 van 24 |

## Analyse-recept

Een minimale Python-analyse, per serverversie. Draai die op een kopie van de logs, buiten de
repository.

```python
import json, collections as C
rows = [json.loads(l) for l in open("/tmp/bot-logs/adventurers-metrics.jsonl")]
v = rows[-1]["v"]                      # nieuwste versie
rows = [r for r in rows if r["v"] == v]
bots = [r for r in rows if r["kind"] == "bot"]
time = C.Counter()
for r in bots:
    for k, m in (r.get("time") or {}).items(): time[k] += m
total = sum(time.values())
print({k: round(m / total * 100, 1) for k, m in time.most_common()})
# Bevroren: geen XP en binnen 15 tegels van waar de reeks begon, 30 minuten of langer (een bot
# die in een tunnel heen en weer schuift telt ook: Markbot 18, 20-11-2026)
streak, frozen = {}, set()
for r in bots:
    s = streak.get(r["bot"])
    near = s and max(abs(r["where"][0] - s[0][0]), abs(r["where"][1] - s[0][1])) <= 15 and r["where"][2] == s[0][2]
    streak[r["bot"]] = (s[0], s[1] + 1) if s and near and not r.get("xpGained") else (r["where"], 1)
    if streak[r["bot"]][1] >= 6: frozen.add(r["bot"])
print("bevroren", sorted(frozen))
print("stuck", C.Counter((r.get("activity"), r.get("reason")) for r in rows if r["kind"] == "stuck").most_common(10))
print("job.ended", C.Counter(r.get("ended") for r in rows if r["kind"] == "job").most_common(10))
# Errands (vanaf de versie na e210ce9): minuten en afloop per bestemming, duurste eerst
err = [r for r in rows if r["kind"] == "errand"]
per = C.defaultdict(lambda: [0, 0, C.Counter()])
for r in err:
    p = per[(r["reason"], r["to"])]; p[0] += 1; p[1] += r["seconds"]; p[2][r["ended"]] += 1
for (reason, to), (n, s, ended) in sorted(per.items(), key=lambda x: -x[1][1])[:15]:
    print(f"{reason:10} {to:28} n={n:4} min={s/60:6.1f} gem={s/n:5.0f}s {dict(ended)}")
# Keuzes van de planner: langs welke weg, hoe vaak de klus niet startte, wat het meest gekozen werd
dec = [r for r in rows if r["kind"] == "decision"]
print("path", C.Counter((r["path"], r["started"]) for r in dec).most_common())
print("niet gestart", C.Counter(r["chosen"]["mode"] or r["chosen"]["kind"] for r in dec if not r["started"]).most_common(10))
# Tas bij gathering (Fase 4b): bezette vakjes buiten grondstoffen, en vrije vakjes
g = [r for r in bots if r.get("mode") in ("woodcutting", "mining", "fishing") and r.get("phase") == "training"]
print("gathering vrij gem", round(sum(r["freeSlots"] for r in g) / max(1, len(g)), 1),
      "loadoutBanked", sum(r["events"].get("loadoutBanked", 0) for r in bots))
print("vooraf uitgesloten", C.Counter((k, v["why"]) for r in dec for k, v in (r.get("blocked") or {}).items()).most_common(10))
print("waarom niet", C.Counter(((r.get("failure") or {}).get("why"), r["chosen"]["mode"]) for r in dec if not r["started"]).most_common(10))
```

## Gaten ten opzichte van de constitution

| § | Vraag | Nu | Gat |
| --- | --- | --- | --- |
| 30 | `::volg` toont Current Goal, Subgoal, Activity, State, Location, Route, Inventory, Equipment, Wealth, Skill, XP Rate | Alles, sinds 20-11-2026: doel, bezig (activiteit of fase), reden (subdoel), route, plek, vermogen, skill en XP/uur in de chat; inventaris, uitrusting en skills in de tabs | Subdoel is de reden van het plan, geen aparte stap uit een dependency-keten (§9) |
| 31 | "Wat doet hij en waarom?" | Eén regel `Doel / Bezig / Reden` in `::volg` | Nog niet op het dashboard |
| 32 | Reconstructie van keuzes | Journaal, momentopnames bij stuck/idle/walk_blocked, `decision` per planner-keuze, `loop` met de laatste boodschappen | Keuzes buiten de planner (`trade`, `upgrade`, hervatten) alleen via `errand` en `loop` |
| 33 | Read Only / Advisory / Override | Override deels (`::advtrain`, `::advquest`, `grantedQuests`) | Geen Read Only of Advisory modus |
| 5 | Stil falen voorkomen | Meeste lussen tellen een event | De banklus was stil (opgelost in ADR-0005). Andere stille lussen zijn niet systematisch gezocht |

De aanbevolen volgorde staat in [ADVENTURER_ROADMAP.md](ADVENTURER_ROADMAP.md).
