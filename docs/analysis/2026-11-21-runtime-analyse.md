# Runtime-analyse en bouwspecificatie, 21-11-2026

Avonturiers werken 16,3% van hun tijd. Dit document zegt per werkpakket wat te bouwen, waar, en
wanneer het klaar is. Elk pakket is één probleem
([RUNTIME_POLICY](../RUNTIME_POLICY.md) §2) en eindigt op een meetbaar criterium uit de metrics.

- **Meetbasis:** branch `bot-logs`, venster 21-11-2026 08:48-14:50 UTC, 60 avonturiers, 12.503
  bot-minuten, versies `2f294017e` t/m `e75bbc441` (main op het moment van schrijven), plus
  1.126 regels `adventurer-quest-feedback.jsonl` (16-11 t/m 21-11).
- **Reproduceren:** [`scripts/bot_log_analysis.py`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/scripts/bot_log_analysis.py) (recept in de kop
  van het script). Datasets in [`2026-11-21/`](https://github.com/m4rk4ever-lang/private-project/tree/main/docs/analysis/2026-11-21).
- **Bronnen van waarheid:** `AI_Constitution.md` (root), [ARCHITECTURE](../ARCHITECTURE.md),
  [ADVENTURER_ROADMAP](../ADVENTURER_ROADMAP.md), [RUNTIME_POLICY](../RUNTIME_POLICY.md),
  [OBSERVABILITY](../OBSERVABILITY.md), [AI_HANDOVER](../AI_HANDOVER.md).
- **Status:** analyse en ontwerp. Er is geen productiecode gewijzigd.

## Werkwijze voor de developer

1. Pak de pakketten in volgorde van prioriteit, één per sessie.
2. Draai eerst het script op verse logs. Zijn de cijfers veranderd, werk dan eerst dit document bij.
3. Sluit elk pakket af volgens RUNTIME_POLICY §7: changelog-regel, AI_HANDOVER-regel en zo nodig een ADR.
4. Vink het pakket af in de tabel hieronder, met de versie (`v`) waarin het bevestigd is.

## Overzicht

| Prio | Pakket | Bewijs | Klaar als | Status |
| --- | --- | --- | --- | --- |
| P0 | 1. Agility-lag | 27× `slow_bot`, alle agility; tick tot 19,6 s | 0 `slow_bot` met agility in 2 uur | gebouwd 22-11; eerste 25 min in `8b75ca8`: 0 met agility, 2 uur nog te halen ([validatie](2026-11-22-validatie-8b75ca8.md)) |
| P0 | 2. Hunter tijdelijk uit | 1.673 bot-min, 0,7% werken, Hunter-XP ~0 | 0 keer gekozen tot pakket 4 bestaat | deels 22-11 (#54): Hunter-plekken zonder XP op hold, te controleren |
| P0 | 3. Deploydiscipline | 13 versies in 6 uur, 3 korter dan 3 min | ≥ 60 min per versie | open |
| P0 | 12. Granted quests lekken gear (§7) | 7 items achter quests die nooit gespeeld zijn | Geen item achter een granted quest | open |
| P1 | 4. Activity Health | Hunter, Slayer, Canifis, Wintertodt lekten uren | Slechte activiteit zakt binnen 2 bot-uur | open |
| P1 | 5. Quest-verificatiecontract | 8 van 119 pogingen gehaald (6,7%) | ≥ 40% `done` op de regressieset | open |
| P1 | 6. Morytania afsluiten | Mazchna 44/46, Canifis 27/27 `blocked` | 0 errands naar Morytania tot bewezen | gebouwd 22-11; `8b75ca8`: 0 errands naar Morytania, Slayer-XP > 0 ([validatie](2026-11-22-validatie-8b75ca8.md)) |
| P1 | 7. Bankcoördinaten | Burthorpe 215/238 `near` | `near` < 20% per bank | gebouwd 22-11; `8b75ca8`: `near` 9% over alle errands ([validatie](2026-11-22-validatie-8b75ca8.md)) |
| P1 | 13. Combat-training vindt geen doel | 108 van 135 klussen `stuck` | `stuck` < 20% van de klussen | stap 1 gebouwd 22-11 (`npcs=` in describe), oorzaak nog open |
| P1 | 14. Vast in quest-gebied of instance (§17) | 69 + 10 `walk_blocked`, 5 bots | Geen bot > 10 min vast in een instance | open |
| P2 | 8. Telemetrie-gaten | `decision` zonder coins, lege `brainSnapshot` | Velden in de nieuwe `v` | open |
| P2 | 9. XP-bandbreedte | herblore 1,45M XP/uur | Metric `xp_anomaly` bestaat | open |
| P2 | 10. Docs- en logdieet | 106 KB handover; log dekt 5,5 uur | Leeswerk < 60 KB; log ≥ 24 uur | open |
| P2 | 15. Recovery-mechanismen bundelen | ≥ 9 losse pogingen/afkoelingen; Patrickbot 17 toch 25 vensters bevroren | Eén faalgeheugen | open |
| P1 | 17. Runecrafting levert niets op (nieuw 22-11) | 113 bot-min, 0 XP; 18× vast bij de air-ruïnes | Runecraft-XP > 0 per venster | **uit (hold) 22-11, moet terug**: oorzaak in game zoeken (agent-MCP: wat gebeurt na Use talisman on ruins), dan `hold` weg in `adventurers.json` `buyToTrain.RUNECRAFTING` ([validatie](2026-11-22-validatie-8b75ca8.md)) |
| P1 | 18. Giant Mole-lus (nieuw 22-11) | 66× graven voor 2 kills; botbeurt 3,1 s; dode zonder eten | ≥ 1 kill per 10 min boss-tijd, 0 doden zonder eten | **uit (hold) 22-11, moet terug**: graven moet tot het hol en een kill leiden, dan `hold` weg bij `boss_giant_mole` in `adventurers.json` ([validatie](2026-11-22-validatie-8b75ca8.md)) |
| P2 | 16. Schaal en tokens meten | Geen meting van kosten per bot of LLM-tokens | Metrics `server.perBot`, `ai_usage` | open |
| P3 | 11. Fundamenten A-D | Registry: 6 van 68 met `requires` | Zie sectie Fundamenten | open |

## Kerncijfers

| Cijfer | 17-11 (`7a8e40b`) | 21-11 08:48-14:50 | `e75bbc441` (35 min) |
| --- | --- | --- | --- |
| Werken | 15,1% | 16,3% | 13,6% |
| Errand | 57,6% | 35,6% | 30,2% |
| Lopen | 12,9% | 20,3% | 30,8% |
| Idle | | 15,1% | 14,9% |
| Bevroren bots (≥ 30 min) | 15 van 60 | 10 | 1 |
| Quests gehaald | | 8 van 119 | |
| Doden zonder eten | 24 van 24 | 3 van 3 (1 onbekend) | |

Het errand-aandeel daalde, maar lopen steeg ongeveer even hard: de tijd verschoof, hij werd niet
gewonnen. Het werkaandeel staat sinds 17-11 stil.

## Activiteiten (uit `2026-11-21/activity-health.csv`)

| Modus | Bot-min | XP/uur hoofdskill | Werken | Errand | Idle | Klussen | Waarvan `stuck` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mining | 1.999 | 17.980 | 13,1% | 25,1% | 10,3% | 172 | 8 |
| thieving | 1.839 | 102.853 | 19,9% | 32,3% | 36,1% | 176 | 62 |
| hunter | 1.673 | ~0 Hunter (1.707 Fletching) | 0,7% | 54,1% | 35,8% | 72 | 37 |
| combat_training | 1.221 | 31.626 (Defence) | 6,2% | 35,6% | 7,0% | 135 | 108 |
| agility | 1.149 | 164.197 | 8,6% | 28,6% | 1,8% | 127 | 76 |
| fishing | 614 | 190.611 | 42,8% | 29,8% | 18,4% | 63 | 11 |
| buy_herblore | 319 | 1.447.874 | 78,2% | 13,7% | 1,4% | 1.003 | 0 |

Volledige lijst in de CSV.

---

## P0: nu doen

### 1. Agility-lag (Reliability)

**Bewijs.** 27 `slow_bot`-events, alle agility: Falador 14, Seers 6, Varrock 5, Canifis 1, Gnome 1.
Elke beurt duurde 2,3-2,8 s met `planMs` 0. `slow_tick.ms` ≈ `slowestBotMs`: één bot houdt de tick
vast, met pieken van 19,6 s en 13,0 s. Routeplanning (`server.planning.route.maxMs`) blijft onder
80 ms en is dus niet de oorzaak. Dat weerlegt de hint over Patrickbot 18 in AI_HANDOVER (21-11 15:20).

**Hypothese (niet gemeten).** `server/plugins/bots/brain/actions/RunCourse.PlayerBots.js`, functie
`nearestObject` (r. 41-70). Op een dak (z > 0) valt de bot bij een lege
`objectSearch.findCandidatesByIds` terug op een scan van 25 × 25 tegels in `MapObjects`. Vindt hij
dan niets, dan herhaalt de lus op r. 136 dat per obstakel van de baan. Dat is per beurt tot ~12
regiozoektochten plus ~7.500 tegel-lookups, elke tick opnieuw.

**Bouwen.**
1. Meten eerst: `runtime/SlowEntries.PlayerBots.js` vult `brainSnapshot` bij agility niet (altijd
   `null`). Neem de actienaam en `describe()` mee, plus tellers in die beurt (aanroepen van
   `nearestObject`, gescande tegels).
2. Bevestigt de meting de hypothese: cache `nearestObject` per (baan, obstakel-index, z) voor de duur
   van een lap. Een lege uitkomst krijgt een negatieve cache van 10 ticks.
3. De fallback over alle obstakels (r. 136) gebruikt één gedeelde scan, niet één per obstakel.
4. Een event `agilityLost` als een bot vaker dan 2 keer per 5 min in de fallback valt. Dat hangt
   vermoedelijk samen met de 44 klussen die eindigden op `off the roof` en 76 `stuck`.

**Klaar als.** In 2 uur logs van de nieuwe `v`: geen `slow_bot` met een agility-activiteit en geen
`slow_tick` > 1 s door een agility-bot. Bot-tests niet slechter dan de basislijn (14 fails).

### 2. Hunter tijdelijk uit (Configuratie)

**Bewijs.** Modus `hunter`: 1.673 bot-minuten (13% van alle tijd), Hunter-XP vrijwel nul, 0,7%
werken. Sinds `1c9f840`: 43 `bot`-regels, 0 Hunter-XP. Naar Feldip Hills: 115 errands, 635 min,
gemiddeld 331 s, 32× `blocked`. Vooraf uitgesloten op gereedschap: 140× (`BIRD_SNARE`, `ROPE`).

**Bouwen.**
1. `activityHold` in `server/plugins/bots/data/adventurers.json`, naar het model van `questHold`:
   per modus of activiteit `name`, `since` en `reason`. De planner (`Planner.PlayerBots.js`,
   `exclude`, r. 124) neemt die set mee en `decision.excluded` krijgt reden `held`. Dit is §28 "Ban
   Activity" zonder codewijziging voor het volgende geval.
2. Zet `hunter` erin met het bewijs hierboven.
3. Hunter komt terug als pakket 4 bestaat én een proef met 3 bots ≥ 5.000 Hunter-XP/uur haalt.

**Klaar als.** 0 `decision` met `chosen.mode = hunter` in de nieuwe `v`, en een hoger werkaandeel.

### 3. Deploydiscipline (Proces)

**Bewijs.** In het venster 13 versies in 6 uur; `b1aa83ebe` stond 0 min, `36b49691b` 1 min,
`398b5ad6b` 2 min. RUNTIME_POLICY §1 en §4 vragen bevestiging per `v`, en dat kan zo niet. Er
gingen regressies live (`idOfName`-ReferenceError, lag na `1c9f840`). In AI_HANDOVER staat bij veel
fixes "niet in de game bevestigd".

**Afspraak.**
- Een versie draait minstens 60 minuten voor de volgende. Uitzondering alleen voor een hotfix van
  een crash of ReferenceError.
- Kleine fixes worden gebundeld; per fix in AI_HANDOVER de metric die hem moet bevestigen.
- Na elke release het script of het recept uit OBSERVABILITY draaien op de nieuwe `v` en de uitkomst
  noteren.
- Vóór elke release: eslint `no-undef` en de bot-tests (zie Validatie).

**Klaar als.** Een dag lang elke versie ≥ 60 min, en elke handover-regel noemt zijn bevestigende metric.

### 12. Granted quests lekken gear (§7, nieuw)

**Bewijs.** 21 quests staan in `grantedQuests` als voltooid, zonder beloning, "tot ze speelbaar zijn
uitgewerkt". `adventurer-gear.json` gebruikt dezelfde quest-status als eis. Daardoor mogen avonturiers
deze items kopen en dragen zonder de quest te spelen
([`gear-behind-granted-quests.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-21/gear-behind-granted-quests.csv)):

| Item | Eis | Granted quest |
| --- | --- | --- |
| Dragon scimitar | 60 Attack | Monkey Madness I |
| Rune platebody | 40 Defence | Dragon Slayer I |
| Berserker, archer en farseer helm | 45 Defence | The Fremennik Trials |
| Crystal axe en crystal pickaxe | 71 | Song of the Elves |

"Dragon Scimitar zonder Monkey Madness I" en "Rune Platebody zonder Dragon Slayer" zijn letterlijk
de verboden voorbeelden uit §7.

**Bouwen.**
1. Maak onderscheid tussen "voltooid voor routes en gebieden" en "voltooid voor beloningen en eisen".
   Granted geldt alleen voor het eerste: toegang tot een gebied, skill of minigame.
2. Bij een gear-eis (`Shopping`, `Trade.wearBest`, `bankUpgrades`) telt alleen een echt gespeelde quest.
3. Bestaande avonturiers die deze items al dragen houden ze (ADR-0004: niets verslechteren zonder
   vraag), maar kopen er geen nieuwe. Leg die keuze vast in een ADR.
4. Unit-test: elk item in `adventurer-gear.json` met een quest-eis wordt geweigerd als die quest
   alleen granted is.

**Klaar als.** In de nieuwe `v` geen aankoop of `wear` van deze items door een bot die de quest niet
echt speelde. De CSV uit het script is leeg, of de items staan op een uitzonderingslijst van de eigenaar.

---

## P1: deze week

### 4. Activity Health (§24, §25, §27)

**Waarom.** Hunter, Slayer via Mazchna, Canifis Rooftop en Wintertodt lekten elk uren tijd voordat
iemand het zag. Elke fix tot nu toe was lokaal. Eén algemeen mechanisme had ze alle vier laten zakken.

**Ontwerp.** Een module in de Knowledge-laag, bijvoorbeeld
`adventurers/ActivityHealth.PlayerBots.js`, gevoed door de bestaande `job`- en `bot`-metrics. Er is
geen nieuwe instrumentatie nodig.

| Veld | Bron | Venster |
| --- | --- | --- |
| `xpPerHour` (hoofdskill) | `bot.xpGained` per modus/activiteit | laatste 6 bot-uur |
| `workShare` | `bot.time.working` / som van `time` | idem |
| `failRate` | `job.ended` in (`stuck`, `low hp, no food`, quest failed) / klussen | idem |
| `travelMin` | `errand.seconds` met reden training of agility, per bestemming | idem |
| `deathsPerHour` | `death` per activiteit | 24 uur |
| `samples` | bot-uren | |

**Regel.** Onder een drempel gaat de activiteit 2 uur in quarantaine: de planner vermenigvuldigt
zijn gewicht met 0,1. Voorstel voor de drempel: `workShare` < 10%, of `xpPerHour` < 20% van de mediaan
voor die skill, met ≥ 2 bot-uur data. Daarna draait hij weer, met hooguit 2 bots als proef. Elke
overgang schrijft metric `activity_health` (`activity`, `state`: healthy, quarantined, probation,
`why`, cijfers). De score is gedeeld over alle avonturiers (§25).

**Waar.** Het gewicht in `Planner.PlayerBots.js` (`trainingWeight`, naast drukte), niet in
`Adventurers.PlayerBots.js`. Dit **vervangt** de 30-minuten "remembered failure" in `canExecute`
(`Requirements.PlayerBots.js`) en komt er niet naast (zie pakket 15).

**Klaar als.** Een unit-test met de echte metrics van 21-11 als fixture zet Hunter, Slayer-Mazchna en
Canifis binnen 2 bot-uur in quarantaine. In game daalt het aandeel bot-tijd op activiteiten met < 10%
werken van ~25% naar < 10%.

### 5. Quest-verificatiecontract (§21, §9)

**Bewijs.** 119 `quest_end`, 8 `done` (6,7%): Cook's Assistant 5, Sheep Shearer 2, Romeo & Juliet 1.
500 quest-minuten, waarvan 51 in een voltooide quest; quest-errands kostten nog eens 482 min.
Automatisch geblokkeerd voor iedereen: Sheep Shearer, Imp Catcher, The Restless Ghost, Witch's
Potion en The Knight's Sword
([`quest-outcomes.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-21/quest-outcomes.csv)).

| Faalklasse (feedbacklog, 16-21 nov) | Aantal | Plek in code |
| --- | --- | --- |
| step did not advance (praten 174, object 103) | 277 | `QuestPlay.PlayerBots.js` r. 802, 811, 837 |
| 3 uur geblokkeerd voor iedereen | 217 | `Adventurers.PlayerBots.js`, `noteQuestFailure` (r. ~2730) |
| too many tries | 180 | `QuestPlay` r. 865 |
| geen trap/ladder naar verdieping 0 | 81 | Climbing |
| quest helper error: fetch failed | 80 | bridge |
| stap zonder tegel | 71 | helper geeft geen `at` |

**Probleem.** Na een stap weet de bot niet wát er had moeten veranderen. Hij telt `tries` op en
stopt, zonder te loggen welke varp/varbit hij verwachtte en welke waarde er stond. Daardoor wordt elk
geval een losse onderzoekssessie.

**Bouwen.**
1. Bij het begin van elke helperstap de quest-varp/varbit lezen (de bridge weet bij welke waarde de
   stap hoort) en `expect: { varbit, from }` bewaren.
2. Na de actie: is de waarde gelijk gebleven, dan is de reden `no_state_change` met
   `{ varbit, value, dialogue }` in `quest_end` en in de feedbackregel. Is hij veranderd maar geeft de
   helper dezelfde stap, dan `helper_out_of_sync`.
3. Blokkeer per (quest, stap), niet per quest: de sleutel in `questsBlocked` wordt
   `quest#helperStep`.
4. `fetch failed` wordt afloop `bridge_down` en telt niet als quest-falen. Nu blokkeert een
   bridge-storing quests voor 3 uur.
5. Regressieset na elke wijziging aan QuestPlay: de 5 geblokkeerde F2P-quests plus Doric's Quest en
   X Marks the Spot, via `::advquestall` op de eigen worktree-poort.

**Klaar als.** ≥ 40% `done` op de regressieset (nu 0-17%), en elke `failed` heeft een
`no_state_change`- of `helper_out_of_sync`-detail.

### 6. Morytania afsluiten tot de route bewezen is (Data)

**Bewijs.** Mazchna 46 errands (44 `blocked`, 155 min), Canifis Rooftop 27 (27 `blocked`). Rond
Paterdomus (3400,3480) 36 `walk_blocked` door 17 bots, 22× `door.outcome = none_helps`, en 36 keer
`route.plan = none`. Slayer leverde in 45 van de 45 vensters geen XP op; 40 Slayer-keuzes
`errand_refused`. De link `paterdomus`-`canifis` van 20-11 werkt in de praktijk niet.

**Bouwen.**
1. Markeer Mazchna, Canifis Rooftop, Mort'ton en Slayer Tower als onbereikbaar in `canExecute`, via een
   vlag op de hub of bestemming in `travel-hubs.json`, met reden `route_unproven` in `decision.blocked`.
2. Slayer kiest zolang een meester buiten Morytania als de data dat toelaat (Turael, Vannaka); anders
   blijft Slayer uitgesloten met dezelfde reden.
3. Bewijs de route apart in game met de agent-MCP: een bot van Varrock-oost naar Canifis, per stap het
   `door`-detail (valluik 3405,3506, Holy barrier 3423,3485). De vlag gaat eraf na 3 geslaagde loopjes.

**Klaar als.** 0 errands naar Morytania in de nieuwe `v` en geen `walk_blocked` rond 3400,3480.

### 7. Bankcoördinaten (Data)

**Bewijs.** Een bank-errand eindigt op `near` als de bot ≥ 45 s stilstaat binnen 15 tegels.

| Bank | `near` / totaal | Minuten |
| --- | --- | --- |
| Burthorpe | 215 / 238 | 180 |
| Seers' Village | 89 / 110 | 79 |
| Catherby | 74 / 101 | 87 |
| Ardougne Zuid | 29 / 197 | 105 |

**Bouwen.**
1. Corrigeer in `adventurers.json` (`banks`) Seers (nu 2725,3491) en Catherby (nu 2809,3440) naar een
   tegel vóór de balie, gecontroleerd op de collision map.
2. "burthorpe" staat niet in `banks`. De bot kwam uit op 2846,3543, bij de Warriors' Guild. Zoek waar
   die bestemming vandaan komt (bank-errands in `Adventurers.PlayerBots.js`, r. 2206, 3198, 5222) en
   maak er een echte bank van of haal hem weg.
3. Patrickbot 17 deed 182 errands daarheen en stond 25 vensters bevroren; `loop` ging maar 8× af.
   Zoek uit waarom `Loops.PlayerBots.js` dit niet als lus zag.
4. Zet de verhouding `near`/totaal per bank als vaste controle in het recept van OBSERVABILITY.

**Klaar als.** Per bank `near` < 20%, en de errandminuten van deze vier banken ruim gehalveerd.

### 13. Combat-training vindt geen doel (nieuw)

**Bewijs.** `combat_training`: 135 klussen, waarvan 108 `stuck` (80%); werkaandeel 6,2%. De
`stuck`-momentopname zegt bijna altijd `target=none approach=none settled=false`, op vaste plekken:
3120,3474 (Varrock-noord), 3416,3477 (Paterdomus), 2894,3440 (Taverley), 2659,3332 (Ardougne) en
3112,3514.

**Bouwen.**
1. Log per `stuck` hoeveel geschikte NPC's er in de site-radius staan en waarom ze afvielen (te hoog
   level, al in gevecht met een ander, onbereikbaar, geen spawn).
2. Is het spawn of bezetting: de site krijgt een capaciteit uit `npc-spawns.json` (aantal geschikte
   NPC's), en de drukte-regel uit de planner gebruikt die.
3. Ligt de site in een gebied dat elders ook faalt (3416,3477 is Paterdomus, pakket 6), dan valt hij
   onder dezelfde vlag.

**Klaar als.** `combat_training` heeft < 20% `stuck`-klussen en ≥ 30% werkaandeel.

### 14. Vast in een quest-gebied of instance (§17, nieuw)

**Bewijs** ([`walk-blocked-hotspots.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-21/walk-blocked-hotspots.csv)):
- Rond 1632,4800: 69 `walk_blocked` door 4 bots (Patrickbot 12: 30, Jorgbot 14: 19, Patrickbot 13:
  12), op weg naar quest-tegel 1615,4828 of naar Veos. Dat is een apart kaartgebied zonder hub.
- Rond 8205,1614: 10 `walk_blocked` door Jorgbot 2 op weg naar Doric (5.041 tegels te gaan). Dat
  coördinaat ligt in een instance-gebied (vermoedelijk het eigen huis van Construction).
- 87 keer `stranded` (home teleport na 3 keer vast).

**Bouwen.**
1. Een `context` in de Knowledge-laag: `world`, `instance` of `quest_area`, af te leiden uit de
   regio. Een errand vanuit een andere context dan het doel begint met "verlaat de context" (portaal,
   exit, home teleport) in plaats van te lopen.
2. `walk_blocked` en `stranded` krijgen het veld `context`.
3. Construction: na bouwen altijd via het exit-portaal (`Construct.PlayerBots.js`), en een watchdog
   als de bot na 2 min nog in de instance staat zonder Construction-XP.

**Klaar als.** Geen `walk_blocked` meer met een start in een instance, en geen bot langer dan 10 min
vast in een quest-gebied.

---

## P2: meten, eerlijkheid, proces

### 8. Telemetrie-gaten

| Gat | Gevolg nu | Toevoegen |
| --- | --- | --- |
| `decision.blocked` met `tool_unbuyable` heeft geen coins (520×) | Onbekend of de bot te arm is of de winkel niet kent | `coins`, `price`, `shopsConsidered` (id, afstand) |
| `slow_bot.brainSnapshot` is `null` bij agility | Oorzaak van de lag niet te zien | actienaam + `describe()` (pakket 1) |
| Wintertodt `place_unreachable` 456× | Ruis: één vaste reden in bijna elke keuze | Vaste uitsluiting één keer per 30 min loggen, met teller |
| `buy_herblore` 1.003 klussen, alle korter dan 2 min | Job-metrics tellen ladingen, geen klussen | Eén `job` per klus, ladingen als teller `loads` |
| Startkapitaal in `coins` | 7 bots met 720M-4,39 miljard (testprofielen) vervuilen economische metingen | `seededCoins` in `bot`; wealth-metrics rekenen `total - seededCoins` |
| Doden: 3 van 3 zonder eten | Oorzaak in `Loadout` niet te zien | `death.loadout`: wat had hij mee bij vertrek |
| Lange errands zonder teleport: 1.142 van 1.382, 667 met lege tas | Grootste hefboom op looptijd (30,8% in `e75bbc441`) | Al gelogd (`carried`); gebruiken in de transport-stappen van de roadmap |

**Klaar als.** Elk veld staat in de eerste `v` na de release en in de tabel van OBSERVABILITY.

### 9. XP-bandbreedte per activiteit (eerlijkheid)

| Modus | XP/uur gemeten | Oordeel |
| --- | --- | --- |
| buy_herblore | 1.447.874 | Verdacht |
| buy_firemaking | 1.306.194 | Verdacht |
| buy_fletching | 1.133.089 | Mogelijk (darts), controleren |
| buy_cooking | 434.043 | Controleren |
| fishing | 190.611 | Verdacht |
| buy_prayer | 190.604 | Controleren |
| agility | 164.197 | Verdacht |
| woodcutting | 133.613 | Controleren |
| thieving | 102.853 | Controleren |

De oordelen zijn op basis van kennis van OSRS en niet opgezocht. Toets elke band aan de OSRS Wiki
voordat hij in de data komt. `experienceMultiplier` is 1, dus het zit in de actiesnelheid (ticks per
actie) of in de hoeveelheid per actie. Let op: XP per modus telt ook de errand-tijd in die modus mee,
dus de echte snelheid tijdens het werken ligt nog hoger.

**Bouwen.**
1. Veld `xpBand: { <skill>: [laag, hoog] }` per activiteit in `bot-activities.json`, met de bron in een `$comment`.
2. In de 5-minutenmetric: XP/uur boven `hoog × 1,25` met ≥ 30 min data schrijft `xp_anomaly`
   (`bot`, `activity`, `xpPerHour`, `band`, ticks per actie).
3. Per verdachte modus de actie naast een echte speler-tick leggen. Dat is werk per skill, maar de
   detectie is algemeen.

**Klaar als.** `xp_anomaly` bestaat, en na de fixes per skill geen `xp_anomaly` meer over 6 uur.

### 10. Docs- en logdieet (token-efficiëntie voor agents)

**Bewijs.** Verplicht leeswerk per sessie: `AI_HANDOVER.md` 106 KB (1.310 regels, ~45 sessies in 2
dagen, niet strikt chronologisch), `server/docs/agents/adventurers.md` 27 KB, roadmap 21 KB,
OBSERVABILITY 14 KB, constitution 10 KB. Samen ~185 KB, naar schatting 45-50k tokens vóór het eerste
werk. Het activiteitenlog dekt door de cap van 20.000 regels 5,5 uur, het metricslog ~5,6 uur bij
3.571 regels per uur.

**Bouwen.**
1. `docs/AI_HANDOVER.md` houdt alleen de laatste 5 sessies plus een tabel *Open problemen*. Oudere
   sessies gaan naar `docs/handover/<datum>.md` (archief, niet verplicht).
2. Een `docs/STATUS.md` van één scherm met de kerncijfers per laatste versie, bijgewerkt na elke release.
3. AGENTS.md en RUNTIME_POLICY §1 noemen STATUS en de laatste 5 sessies als verplicht; de rest is naslag.
4. Logs: elke dag één gzip per log naar `bot-logs/<datum>/` via `scripts/share-bot-logs.sh`,
   14 dagen bewaren.

**Klaar als.** Verplicht leeswerk < 60 KB, en een analyse over 24 uur kan zonder serververbinding.

### 15. Recovery-mechanismen bundelen (over-engineering, nieuw)

**Bewijs.** RUNTIME_POLICY §3 noemt al minstens negen losse herstel- of afkoelmechanismen, elk met
een eigen timer en eigen geheugen: `blockedPlaces`, `noErrandUntil`, `unstrand`, `clearBag`, de
errand-watchdog, `fullBagBankAt`, `noExchangeBuyUntil`, `Loops` (15 min) en de onthouden mislukking
in `canExecute` (30 min). Daarbovenop komen `questsBlocked` (3 uur) en de rust van errands. Toch
stond Patrickbot 17 25 vensters bevroren (182 errands naar dezelfde plek), en bleven Hunter en
Morytania uren draaien. De mechanismen werken niet samen: elk ziet een eigen stukje.

**Bouwen.**
1. Eén faalgeheugen in de Knowledge-laag: sleutel (bot of iedereen, soort, doel), met aantal, laatste
   keer, reden en afkoeling. Dezelfde API voor plek, aankoop, quest-stap en activiteit.
2. Bestaande mechanismen gaan er één voor één naartoe, telkens bij een fix die toch in de buurt zit
   (ADR-0002: geen rewrite). Nieuwe code gebruikt alleen nog dit geheugen.
3. Activity Health (pakket 4) is de verzameling van dit geheugen per activiteit, geen tweede systeem.

**Klaar als.** Geen nieuwe losse afkoeltimer meer in de code; `loop` en `stuck` verwijzen naar een
sleutel in het faalgeheugen.

### 16. Schaal en tokens meten (nieuw)

**Bewijs.**
- Server bij 61 bots: tick gemiddeld 15-38 ms, maximaal 124-641 ms (buiten de `slow_tick`-pieken),
  heap 1,0-1,6 GB, RSS 1,4-2,0 GB. Een basislijn zonder bots ontbreekt, dus de kosten per bot zijn
  onbekend.
- Er is een LLM-laag voor de AI-bots (`server/plugins/bots/ai/`): Haiku 4.5 als eerste provider,
  `max_tokens` 4000, cache op de system prompt, maximaal 4 calls per bot per minuut en 30 in totaal.
  `usage` gaat alleen naar de serverlog (`ai_bot_decision`) en niet naar de metrics. Tokens per uur
  zijn dus niet te volgen. De avonturiers zelf gebruiken geen LLM: hun planner is deterministisch en
  kost geen tokens, en dat moet zo blijven.

**Bouwen.**
1. Een meting met 0, 30, 60 en 120 bots (testprofielen) op de eigen worktree-poort: tick-gemiddelde,
   p99, heap. Daaruit de kosten per bot en het maximum op deze hardware.
2. `server`-metric: `perBot` (ms per bot-beurt, gemiddelde en p99 per soort action).
3. Metric `ai_usage` elke 5 min: calls, input-, output- en cache-read-tokens, weigeringen, per provider.

**Klaar als.** Een tabel "bots × tick/heap" in STATUS.md, en tokens per uur in de metrics.

---

## P3: fundamenten A-D (Knowledge-laag)

Dit zijn vier datastructuren die elk toekomstig systeem deelt. Zonder ze wordt elk nieuw systeem een
eigen module van honderden regels, zoals Hunter, Farming en Construction nu. Ze horen in de
Knowledge-laag (§6), niet in `Adventurers.PlayerBots.js`; dat bestand is nu 6.019 regels, terwijl
ARCHITECTURE nog ~4.650 noemt.

**Stand.** Plekken staan in minstens zes bronnen: `travel-destinations.json`, `travel-hubs.json`,
`adventurers.json` (`banks`, `combatSiteMaxLevel`, `activitySites`), `bot-activities.json`,
`plugins/agent/data/transports.json` en `object-index.json`. Van de 68 activiteiten hebben er 6
`requires` en 1 `produces`; geen enkele heeft `xp`, `gp`, `risk`, `travel`, `duration` of `unlocks`
([`activity-registry-audit.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-21/activity-registry-audit.csv)).

**Transportdata die al bestaat maar niet gebruikt wordt.** `transports.json` (uit Shortest Path)
heeft 5.763 deuren, trappen en ladders, 708 agility shortcuts, 404 charter-ship-verbindingen, 141
boten, 129 portalen, 45 kano's, 40 teleportation boxes, 36 schepen, 14 mijnkarren, 13 magische
tapijten en 7 hendels. Allemaal met kolommen voor skills, items, quests, varbits en varps. De
routeplanner (`travel-hubs.json`) gebruikt daarvan een handvol handgeschreven boten. Voor §16 hoeft
de transport-registry dus niet gebouwd te worden: hij moet aangesloten worden.

### A. Unlock-graaf (§8, §9, §11)

Eén gegenereerd bestand `server/plugins/bots/data/unlock-graph.json`, afgeleid van de quest-eisen uit
de cache (`Quests.PlayerBots.js`), `adventurer-gear.json` en `transports.json`. Alleen de waarden zijn
handwerk.

```json
{
  "nodes": {
    "quest:monkey_madness_i": { "kind": "quest", "value": 0 },
    "item:dragon_scimitar":    { "kind": "item", "value": 900 },
    "skill:attack:60":         { "kind": "level", "value": 0 },
    "transport:fairy_rings":   { "kind": "transport", "value": 1000 }
  },
  "edges": [
    { "from": "item:dragon_scimitar", "requires": "quest:monkey_madness_i" },
    { "from": "item:dragon_scimitar", "requires": "skill:attack:60" }
  ]
}
```

- Waarde van een knoop = eigen waarde (lijst uit §11) plus de verdisconteerde waarde van wat hij ontsluit.
- `missing(node, snapshot)` geeft de keten van ontbrekende knopen in volgorde. Dat is de Dependency
  Resolution Engine van §9 en de bron van "subdoel" in `::volg`.
- Granted quests tellen als voltooid voor gebieden, niet voor beloningen (pakket 12).
- Eerste gebruik: Fase 5 van de roadmap.

### B. Activity Registry v2 (§13)

```yaml
id: crimson_swifts_feldip
template: hunt_birds
requires: { skills: { HUNTER: 1 }, quests: [], items: [BIRD_SNARE], area: feldip_hills }
produces: [RAW_BIRD_MEAT, BONES]
xpBand: { HUNTER: [3000, 9000] }       # pakket 9; bron in $comment
gp: 0
risk: low                              # low | medium | high | wilderness
travel: { hub: yanille }
unlocks: []                            # knopen in graaf A
# gemeten, gegenereerd in data/activity-health.json (pakket 4):
# xpPerHour, workShare, failRate, travelMin, deathsPerHour, samples
```

**Migratie.** Eerst de 10 activiteiten met de meeste bot-minuten (zie de activiteitentabel). Een
schematest faalt op een activiteit zonder `requires` of `risk`. De rest volgt per skill als daar toch
aan gewerkt wordt.

### C. Item Source Graph

```json
{ "LOBSTER_POT": [
    { "kind": "shop", "shop": "port_sarim_fishing", "price": 20 },
    { "kind": "ge" },
    { "kind": "drop", "npc": "...", "rate": 0.0 }
  ] }
```

- Eerste nut: `tool_unbuyable` (520×: snare, lobster pot, candle, harpoon, feather) wordt een
  opzoeking in plaats van een gok.
- Tweede nut: Ironman is een filter op `kind`.
- Gegenereerd uit de shop-definities, de npc-drop-data en `produces` uit B. Een test controleert dat
  elk `requires.items` uit B minstens één bron heeft.

### D. Accountprofiel (§26, §28)

```yaml
accountType: normal          # normal | ironman | hardcore | ultimate
riskTolerance: 0.5
affinity: { combat: 0.6, quest: 0.4, skilling: 0.5, wealth: 0.3, exploration: 0.2, efficiency: 0.7 }
overrides: { banGoal: [], banQuest: [], banActivity: [], preferRegion: null, preferBoss: null }
seededCoins: 0
```

`questHold` en `activityHold` (pakket 2) zijn de globale variant van `overrides`; dit is de variant
per avonturier.

**Klaar als.** A-D zijn bestanden met een schematest; de planner leest A en B; `tool_unbuyable` en
`excluded` verwijzen naar een bron of knoop in plaats van vrije tekst.

---

## Toekomstige systemen: nu ontwerpen, bouwen achter een poort

Geen van deze systemen wordt nu gebouwd, behalve Market Intelligence als pure meting. Elk systeem
heeft een poort: een metric die eerst gehaald moet zijn.

```
           Hardcore Ironman      Collection Log        Economie
                 ↑                     ↑                   ↑
Skill-pad     Ironman                 PvM          Market Intelligence (nu: alleen meten)
    ↑            ↑                     ↑                   ↑
 ──────────── Fundamenten: A Unlock-graaf · B Registry v2 · C Item Sources · D Accountprofiel ────────────
```

| Systeem | Eerste bouwstap | Poort (metric) | Bewijs nu |
| --- | --- | --- | --- |
| Skill-pad | Waarde van een level = waarde van wat het in A ontsluit; methode per levelband uit B op gemeten XP/uur × slagingskans; keten in `::volg` | Geen skill 45/45 vensters onaangeroerd; geen `xp_anomaly` | Slayer, Runecrafting, Construction, Sailing 45/45 onaangeroerd; Hunter 40/45 |
| Ironman | Filter op C (geen `ge`, geen clangeschenk); de planner maakt zelf gathering-doelen | C heeft een bron voor elk gear-item | `produces` bij 1 van 68 activiteiten; code: "The adventurers are never Ironmen" |
| Hardcore Ironman | `riskTolerance` begrenst `risk`; activiteiten met recente doden verboden; vluchtdrempel en minimum eten | ≥ 90% van de doden met eten bij zich, 24 uur | 3 van 3 doden zonder eten (17-11: 24 van 24) |
| PvM | Boss Registry als configuratie; DPS uit de formules van het spel (`DamageFormulas.ts`), geen eigen simulator | ≥ 80% Barrows-runs met loot | 6 Barrows-runs, 0 geloot; Giant Mole 181× uitgesloten op spade/candle |
| Collection Log | Per ontbrekend slot: bron in C, kills = 1/kans, tijd = kills × gemeten killtijd | Gemeten killtijd voor ≥ 3 bosses | Log-plugin bestaat (`plugins/achievements/collectionlog/`) |
| Market Intelligence | Metric `ge_fill`: item, prijs, aantal, seconden tot gevuld; geen gedrag | Geen; nu bouwen | `buy_nothing`, `exchange_blocked`; mediaan gp/uur: smelting 23,9k, fishing 23,3k, mining 18,7k, thieving 3,7k, hunter 1,5k |
| Economie tussen avonturiers | Clan deelt vraag; skillers leveren via echte GE-offers binnen een prijsband van Market | `seededCoins` apart (pakket 8) | 7 bots met 720M-4,39 miljard startkapitaal |

**Boss Registry (schema).**

```yaml
id: giant_mole
requires: { combat: 65, items: [SPADE, LIGHT_SOURCE], quests: [] }
access: { kind: dig, at: [2984, 3387, 0] }
setup: { style: melee, prayer: protect_melee, food: { min: 8 } }
instance: false
# gemeten (activity-health): killMin, deathsPerHour, gpPerHour, suppliesPerKill
```

**Eerlijkheid, beslissing van de eigenaar.** De huidige Hardcore-bots (gewone bots, geen avonturiers)
sterven via een kans: `DOWNFALL_CHANCE = 0.08` per 5 minuten in `brain/Ironmen.PlayerBots.js`
("about one an hour"). Dat is een gesimuleerde dood en botst met §3 en RUNTIME_POLICY §6. Voor
avonturiers mag een HCIM alleen sterven door een echte klap in het spel. Leg de keuze voor de gewone
bots vast in een ADR.

---

## Wat ontbrak in de eerste versie van deze analyse

Een kritische vergelijking met de opdracht ("zoek pathfinding-problemen, requirement-fouten,
progression bottlenecks, inefficiënte activiteiten, slechte abstracties, over-engineering; produceer
registries en dependency-graphs; richt je op schaalbaarheid en token-efficiëntie"). Wat hieronder
"nu toegevoegd" heet, staat hierboven als pakket.

| Opdracht | Eerste versie | Nu |
| --- | --- | --- |
| Requirement-fouten | Alleen `tool_unbuyable` | Pakket 12: granted quests lekken 7 gear-items, de verboden voorbeelden uit §7 |
| Pathfinding | Morytania en Taverley-poort | Pakket 14 (instances, quest-gebieden); `route.plan = none` bij 201 van 539 `walk_blocked` (Wizards' Tower 29, Mazchna 24, Canifis 23, Veos 16, Gnome Stronghold 16) |
| Inefficiënte activiteiten | Hunter | Pakket 13: combat-training 80% `stuck` |
| Over-engineering | Niet onderzocht | Pakket 15: ≥ 9 losse recovery-mechanismen die niet samenwerken. Ook mijn eigen voorstel (Activity Health) mag geen tiende worden |
| Schaalbaarheid | Niet onderzocht | Pakket 16: geen basislijn per bot; meting voorgeschreven |
| Token-efficiëntie | Alleen docs | Pakket 16: LLM-tokens van de AI-bots niet gemeten |
| Transportation registry | Alleen genoemd | Bestaat al als data (7.300 verbindingen); moet aangesloten worden |
| Activity registry | Alleen een schema | Audit van alle 68 activiteiten en gemeten gezondheid als CSV |
| Quest dependency tree en unlock graph | Alleen een schema | **Nog niet gemaakt**: vraagt de OSRS-cache (niet in de repo) of een draaiende server. Eerste taak van fundament A |
| Gear progression dataset | Niet gemaakt | Alleen de integriteitscontrole (pakket 12); de dataset volgt uit A en C |
| Boss registry | Schema | Schema; echte waarden pas na Activity Health (killtijd en doden zijn niet gemeten) |

**Zwakke plekken in de methode.**
- Het venster mengt 13 serverversies. Per versie zijn de aantallen te klein voor harde conclusies,
  behalve waar een patroon in elke versie terugkomt (Morytania, agility, Hunter).
- XP per modus telt de errand-tijd mee. Die snelheden zijn ondergrenzen voor de echte werk-snelheid.
- De agility-hypothese en de bankoorzaken zijn niet in game getoetst: in de analyse-omgeving draait
  geen server en staat geen cache.
- De XP-banden van OSRS komen uit kennis, niet uit de wiki.

## Risico's

| Risico | Ernst | Afgedekt door |
| --- | --- | --- |
| Fixes stapelen zonder bevestiging per `v`; regressies gaan live | Hoog | Pakket 3 |
| Eén bot laat de tick 13-20 s stilstaan; ook echte spelers lijden | Hoog | Pakket 1 |
| Gear zonder quest breekt §7 en vervalst de progressie | Hoog | Pakket 12 |
| Zonder werkende quests geen unlock-graaf, dus geen Fase 5 en geen Quest Cape | Hoog | Pakket 5, dan A |
| `Adventurers.PlayerBots.js` (6.019 regels) blijft groeien | Middel-hoog | Nieuwe code in eigen modules; splitsen alleen bij een fix daar (ADR-0002) |
| Een eigen action per skill drijft af naar losse scripts (§3) | Middel | Fundament B |
| XP buiten de OSRS-band maakt gemeten XP/uur onbruikbaar | Middel | Pakket 9 |
| Recovery-lagen blijven groeien zonder samen te werken | Middel | Pakket 15 |

## Open vragen voor de eigenaar

- [x] Mag Hunter tijdelijk uit (pakket 2)? **Alleen als het niet werkt** (eigenaar, 22-11): aan laten voor test- en skilldata. De snare-fixes van #45 draaiden maar ~1 uur in het venster. Beslissen op 60 min logs van de nieuwe `v`: nog steeds ~0 Hunter-XP, dan `activityHold`.
- [x] Akkoord met minimaal 60 minuten per serverversie (pakket 3)? **Ja** (eigenaar, 22-11), langer mag ook.
- [x] Gear achter granted quests: nieuwe aankopen blokkeren en bestaande houden, of ook bestaande afnemen (pakket 12)? **Ook bestaande afnemen, maar per quest pas als die quest speelbaar is** (eigenaar, 22-11). Zolang een quest granted is, is afnemen oneerlijk en helpt het het testen niet. Pakket 12 wordt daarmee: zodra een quest uit `grantedQuests` gaat, telt hij voor gear-eisen alleen nog als hij echt gespeeld is, en nemen bots zonder die quest het item terug naar de bank.
- [x] Blijft de dood per kans voor de gewone Hardcore-bots (ADR)? **Nee** (eigenaar, 22-11): geen dood per kans; alleen een echte klap in het spel. Nog te bouwen (`DOWNFALL_CHANCE` in `brain/Ironmen.PlayerBots.js`) en vast te leggen in een ADR.
- [x] Mogen de testprofielen met 720M-4,39 miljard coins blijven? **Ja** (eigenaar, 22-11): daarmee wordt ook getest.
- [ ] Waar hoort de bank "burthorpe" vandaan te komen?
- [ ] Drempel voor Activity Health: quarantaine (gewicht × 0,1) of helemaal uit?

## Validatie per pakket

1. Vóór en na de bot-tests draaien; het aantal fails mag niet stijgen (basislijn 14):

   ```bash
   cd server && node --test tests/bot-*.test.cjs tests/player-bot-*.test.cjs
   ```

2. Eslint `no-undef` op elk gewijzigd bestand:

   ```bash
   npx eslint --no-eslintrc --env node,es2022 --parser-options=ecmaVersion:2022 --rule '{"no-undef":"error"}' <bestanden>
   ```

3. Waar mogelijk een unit-test die de echte failure naspeelt, met regels uit `bot-logs` als fixture.
4. In game op de eigen worktree-poort via de agent-MCP (`server/docs/agents/testing.md`).
5. Na release ≥ 60 min logs van de nieuwe `v`, en het script draaien met `--since` op de releasetijd.
6. Uitkomst in AI_HANDOVER, een changelog-regel als een speler of beheerder het merkt, en de
   kerncijfers in STATUS.md.

## Samenvatting volgens de constitution

1. **Findings:** het werkaandeel staat sinds 17-11 stil op ~16%. De grootste lekken: Hunter (13% van
   de tijd, ~0 XP), combat-training (80% `stuck`), Morytania (100% `blocked`) en quests (6,7%
   gehaald). Agility veroorzaakt de serverlag. Granted quests geven gear die §7 verbiedt. Transportdata
   ligt klaar maar wordt niet gebruikt.
2. **Risks:** validatie loopt achter op fixes; tick-stilstand raakt echte spelers; de
   eerlijkheidsregels worden geschonden door gear en XP-snelheden; recovery- en godmodule groeien.
3. **Recommendations:** P0-pakketten 1, 2, 3 en 12 nu; daarna Activity Health en het
   quest-verificatiecontract als algemene mechanismen in plaats van fixes per geval; fundamenten
   A-D voordat er nieuwe systemen komen.
4. **Priority:** zie het overzicht bovenaan.
5. **Expected Value:** pakket 2 geeft ~13% bot-tijd terug; pakket 1 haalt stilstanden van 2-20 s
   weg; pakketten 6, 7 en 13 samen naar schatting 5-10% bot-tijd; pakket 5 kan het aantal voltooide
   quests ongeveer zesvoudigen (bij 40% slagen). Die laatste opent de unlock-graaf en daarmee het pad
   naar de capes.
