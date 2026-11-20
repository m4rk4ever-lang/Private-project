# Adventurer Roadmap

Waar het Adventurer Platform staat ten opzichte van [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md)
en in welke volgorde de gaten dicht gaan. De volgorde komt uit runtime-data
([RUNTIME_POLICY.md](RUNTIME_POLICY.md)), niet uit de volgorde van de constitution. Werk de status
bij als een stap klaar is; de dagelijkse werklijst blijft in `server/docs/agents/adventurers.md`.

Stand: 20-11-2026. Runtime-basis: metrics van versie `7a8e40b` (17-11-2026 17:13 tot 22:08 UTC,
60 avonturiers, 26,9 miljoen XP).

## Gap-analyse

Legenda: **Er** = werkt en is in de logs gezien. **Deels** = bestaat, met bekende gaten.
**Nee** = ontbreekt.

| § | Onderwerp | Stand | Wat er is | Gat |
| --- | --- | --- | --- | --- |
| 1, 4 | Van level 3 naar capes zonder account-scripting | Deels | Planner, doelen, quests, 45 quests op het pad, 3 bosses, Slayer, Barrows | Geen pad naar Quest Cape, Diary Cape of Max Cape; 21 quests tijdelijk "granted" zonder beloning |
| 5 | Runtime First | Er | 3 JSONL-logs met `v`, branch `bot-logs`, momentopnames | Logcap 20.000 regels dekt een paar uur |
| 6 | Drie lagen, niet mengen | Deels | Modules per onderwerp | `Adventurers.PlayerBots.js` (4.650 regels) mengt alle lagen |
| 7 | `CanExecute()` voor elke actie | Deels | Losse checks: quest-reqs uit de cache, gear-levels en quests (`adventurer-gear.json`), teleports quest-locked, Morytania na Priest in Peril, `onFoot`-gebieden | Geen centrale `CanExecute`; checks verspreid en per onderdeel anders |
| 8 | Knowledge Graph, één waarheid | Deels | `snapshot()` per beslissing, quest-status via events | Geen centrale bron; elk onderdeel vraagt zelf |
| 9 | Dependency Resolution | Deels | `missing()` geeft ontbrekende skills en quests voor een quest; gear-doelen sparen GP | Geen keten doel → quest → skill → travel → GP → gear |
| 10, 11 | Progression op unlock-waarde | Nee | Gewogen keuze op achterstand, doel en drukte (`trainingWeight`) | Geen unlock-scores; planner kiest op XP-logica, niet op toekomstige waarde |
| 12 | Skilling met reden | Deels | Gathering, buy-to-train voor 10 skills, geldklussen op gemeten gp/uur | Construction, Farming, Fletching weinig of niet; reden per skill niet altijd een unlock |
| 13 | Activity Registry data-driven | Deels | 61 activiteiten in `bot-activities.json`, plekken in JSON | Velden van §13 (requirements, gear, xp, gp, risk, travel, duration, unlocks) niet als vast schema |
| 14 | Economic Planning | Deels | Spaardoelen, verkopen om te financieren, `moneyChance`, gp/uur per klus | Geen check "kan ik mijn volgende doel betalen" op planningsniveau |
| 15 | World Navigation, plane-aware, action-based | Deels | Hubs (38), errands, deuren, trappen, ladders, shortcuts, toll gate, ondergronds via `transports.json` | Errands kosten 44% van de tijd van werkende bots; muren bij banken; ondergrondse plekken beperkt |
| 16 | Transportation | Deels | Spreuken, tablets, geladen sieraden, home teleport | Geen fairy rings, spirit trees, gliders, boten, POH, minigame-teleports in routeplanning |
| 17 | Instance Awareness | Deels | Barrows-crypten en tunnels | Geen algemeen begrip van instances |
| 18 | Recovery | Deels | Stuck na 2 min, retries met uitsluiting, `unstrand`, `blockedPlaces`, errand-watchdog, graf terughalen | Stille lussen bestonden (banklus, opgelost 20-11-2026); niet systematisch afgedekt |
| 19 | Banking | Deels | Deposit, withdraw, noted wisselen, bank per behoefte | Geen placeholders of tabs; classificatie gear/resources/supplies/quest/junk is impliciet in `keepIds` |
| 20 | Best Obtainable Item | Er | Gear-lijsten met level-, quest- en GP-eisen, sparen | Upgrades kopen soms dubbel (zie dubbele staffs in de logs) |
| 21 | Quests via QuestHelper | Er | Bridge, stappen, feedbacklog, `::advquestall` sweep | 616 feedbackregels; top: "too many tries", "talked, but the step did not advance", bridge-fouten |
| 22 | Combat | Deels | Training, Slayer, eten, prayer potions, protection prayer en flicking | 24 van 24 doden "geen eten bij zich"; combatstijl per zwakte ontbreekt |
| 23 | Bossing na fundamenten | Deels | Barrows, Giant Mole, Sarachnis; boss pas vanaf `bossLevel` | Configuratie per boss beperkt; Barrows-runs nog niet volledig in logs gezien |
| 24 | Memory & Learning | Deels | gp/uur per klus (`entry.earn`) | XP/uur, deaths, succesratio en reistijden worden gelogd maar niet gebruikt in keuzes |
| 25 | Clan Intelligence | Deels | Clans, giften, achievements-race | Geen gedeelde, geaggregeerde kennis tussen avonturiers |
| 26 | Personality | Deels | Testprofielen, persona's voor AI-bots, eigen gewichten | Geen affiniteitsprofiel per avonturier zoals §26 |
| 27 | Diversity | Deels | Drukte halveert gewicht, willekeur, spreiding over plekken | Geen activity fatigue |
| 28 | Human Override zonder code | Deels | `::advtrain`, `::advquest`, `::advquestall`, `grantedQuests` in JSON | Geen Ban Goal/Quest/Activity, Preferred Region/Boss |
| 29-32 | Observability, `::volg`, Explainability, Replay | Deels | Zie [OBSERVABILITY.md](OBSERVABILITY.md) | Doel/subdoel/reden/route ontbreken in `::volg`; planner-keuzes niet gelogd |
| 33 | Operator Modes | Nee | | Geen Read Only of Advisory |

## Grootste bottleneck

Gekozen uit: Requirements, Progression, Skilling, Economy, Navigation, Observability, Telemetry.

**Navigation**, gemeten aan de tijd: avonturiers zijn 57,6% van hun tijd op boodschap (errand) en
12,9% aan het lopen naar een klus. Ze werken 15,1% van de tijd.

Binnen Navigation was de grootste enkele oorzaak geen route, maar een banklus: 15 van 60
avonturiers stonden 4,5 uur stil bij een bank, goed voor 25% van alle bot-minuten en 42% van alle
errand-minuten. De oorzaak lag in de bewaarregels van de tas en de lus was onzichtbaar. Opgelost
in [ADR-0005](adr/0005-een-van-elk-en-geen-stille-banklus.md). Zonder die bots blijft errand 44,3%
van de tijd; dat is de volgende stap.

## Volgorde

Elke fase heeft een meetbaar eindcriterium uit de metrics. Een fase begint pas als de logs van de
vorige versie zijn bekeken.

### Fase 1: Fundament (20-11-2026, klaar)

- Documenten: dit bestand, [ARCHITECTURE.md](ARCHITECTURE.md#adventurer-platform),
  [OBSERVABILITY.md](OBSERVABILITY.md), [RUNTIME_POLICY.md](RUNTIME_POLICY.md),
  [AI_HANDOVER.md](AI_HANDOVER.md), [ADR's](adr/README.md).
- Banklus opgelost en zichtbaar gemaakt (ADR-0005).
- Klaar als: in logs van de nieuwe versie geen bevroren bots (recept in OBSERVABILITY.md) en
  `bank_nothing` hooguit af en toe.

### Fase 2: Reliability van errands (Navigation)

- Bewijs: errand 44,3% van de tijd bij werkende bots; bank-errands het grootst (Draynor,
  Edgeville, Varrock West, GE); `walk_blocked` 262 keer in 4,9 uur.
- Eerst meten: per bank de duur van een bank-errand en hoe vaak hij eindigt via "binnen 15 tegels"
  in plaats van echt aankomen. **Instrumentatie klaar (20-11-2026):** metric `errand` met
  `ended`, `why` en `seconds` ([OBSERVABILITY.md](OBSERVABILITY.md#metric-soorten-kind)). Nog te
  doen: een paar uur data van de nieuwe versie bekijken, dan de grootste oorzaak oplossen.
- Klaar als: errand-aandeel onder 30% bij gelijk aantal avonturiers.

### Fase 2b: Algemene lusbewaking (§18), afgesproken 20-11-2026

- Bewijs: op 20-11-2026 drie lussen na elkaar, elk pas zichtbaar na de vorige fix: banklus
  (ADR-0005), kooplus bij de GE (`buy_nothing`), uitrusting heen en weer naar de bank
  (`errandInstant`). Elke fix was lokaal; de beslisstap kijkt niet of een actie iets opleverde.
- Eén bewaking in de beslisstap: dezelfde boodschap of beslissing een aantal keer zonder XP, geld
  of voortgang → event, metric met de reeks, en een andere keuze.
- **Gebouwd 20-11-2026** voor boodschappen (`Loops.PlayerBots.js`, metric `loop`). Beslissingen
  zonder boodschap (een klus die steeds opnieuw start) vallen er nog buiten.
- Klaar als: geen bot met een hoog `errandInstant` of een herhalende reeks zonder voortgang in de
  logs, ook bij nieuwe oorzaken.

Afgesproken volgorde daarna: Fase 3 (`::volg` Goal / Activity / Reason), Fase 4 (`CanExecute`,
met als eerste bewijs niet-verhandelbare quest-items die op de GE gekocht worden, zoals lit
candle), Fase 5 (unlock-waarde).

### Fase 3: Observability van keuzes (§30, §31)

- `::volg` uitbreiden met doel, subdoel (plan.reason), huidige activiteit, fase, route (errand.to)
  en XP/uur. Alles staat al in het geheugen van de avonturier.
- Een `decision`-metric bij elke planner-keuze: gekozen optie, reden, top 3 alternatieven met
  gewicht.
- Klaar als: een operator in `::volg` "Goal / Activity / Reason" ziet zoals in §31.
- **Deel 1 gebouwd 20-11-2026:** `::volg` toont doel, bezig, reden, route, XP/uur, vermogen en
  plek (`adventurers:status`).
- **Deel 2 gebouwd 20-11-2026:** metric `decision` bij elke planner-keuze (weg, gekozen optie,
  kans, beste 3 alternatieven, uitgesloten modi).

### Fase 4: Requirements (§7)

- Eén `canExecute(entry, action)` in de Knowledge-laag die de bestaande losse checks bundelt
  (skills, quests, items, GP, gebied, transport). Eerst alleen gebruiken op de plekken waar logs
  falen tonen door een ontbrekende eis.
- Klaar als: geen quest- of job-failures meer met een eis als oorzaak.

### Fase 5: Progression op unlock-waarde (§10, §11)

- Unlock-scores als data (JSON), beginnend met de voorbeelden uit §11. De planner weegt ze naast
  de bestaande gewichten, niet in plaats daarvan.
- Klaar als: de metrics laten zien dat avonturiers unlocks halen (quest_done, goal reached) in
  plaats van alleen XP.

### Later, op volgorde van bewijs

- Survivability: eten mee bij combat (24 van 24 doden zonder eten).
- Quest-failures uit `adventurer-quest-feedback.jsonl` per reden.
- Memory & Clan Intelligence: gemeten XP/uur, deaths en reistijden gebruiken in keuzes.
- Human Override: ban/prefer-lijsten in JSON.
- Transport: fairy rings, spirit trees, gliders als routeopties.
- Operator Modes.
