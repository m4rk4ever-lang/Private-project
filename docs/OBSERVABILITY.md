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
| `::volg <naam>` | Camera op de bot, chat met zijn acties, inventaris, uitrusting, skills, quests en combattab gespiegeld | Eigenaar in game |
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

Events in `bot.events`: `stuck`, `walkBlocked`, `errandIdle`, `idle`, `questFailed`, `fledLowHp`,
`died`, `teleportedOut`, `targetReached`, en nieuw `bankNothing`.

## Kerncijfers

Deze cijfers zeggen het meest over de gezondheid van het platform. Ze zijn uit de `bot`-regels af
te leiden zonder nieuwe instrumentatie.

| Cijfer | Hoe | Stand 17-11-2026 (`7a8e40b`, 4,9 uur, 60 avonturiers) |
| --- | --- | --- |
| Werkaandeel | `time.working` / som van `time` | 15,1% |
| Errand-aandeel | `time.errand` / som van `time` | 57,6% (44,3% zonder de bevroren bots) |
| Bevroren bots | Bot met 0 XP en dezelfde `where` in 6 of meer opeenvolgende `bot`-regels (30 min) | 15 van 60 |
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
# Bevroren: zelfde tegel, geen XP, 30 minuten of langer
streak, frozen = {}, set()
for r in bots:
    key = (tuple(r["where"]), bool(r.get("xpGained")))
    s = streak.get(r["bot"])
    streak[r["bot"]] = (key, s[1] + 1) if s and s[0] == key and not key[1] else (key, 1)
    if streak[r["bot"]][1] >= 6: frozen.add(r["bot"])
print("bevroren", sorted(frozen))
print("stuck", C.Counter((r.get("activity"), r.get("reason")) for r in rows if r["kind"] == "stuck").most_common(10))
print("job.ended", C.Counter(r.get("ended") for r in rows if r["kind"] == "job").most_common(10))
```

## Gaten ten opzichte van de constitution

| § | Vraag | Nu | Gat |
| --- | --- | --- | --- |
| 30 | `::volg` toont Current Goal, Subgoal, Activity, State, Location, Route, Inventory, Equipment, Wealth, Skill, XP Rate | Inventory, Equipment, skills, quests en een chatverslag van acties | Doel, subdoel, reden, route, wealth en XP/uur staan wel in de metrics maar niet in `::volg` |
| 31 | "Wat doet hij en waarom?" | `plan.reason` en `goal` in de metrics en op het dashboard | Niet als één regel "Goal / Activity / Reason" op één plek |
| 32 | Reconstructie van keuzes | Journaal en momentopnames bij stuck/idle/walk_blocked | De planner logt niet welke opties hij woog en waarom hij koos |
| 33 | Read Only / Advisory / Override | Override deels (`::advtrain`, `::advquest`, `grantedQuests`) | Geen Read Only of Advisory modus |
| 5 | Stil falen voorkomen | Meeste lussen tellen een event | De banklus was stil (opgelost in ADR-0005). Andere stille lussen zijn niet systematisch gezocht |

De aanbevolen volgorde staat in [ADVENTURER_ROADMAP.md](ADVENTURER_ROADMAP.md).
