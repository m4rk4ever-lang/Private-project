# AI Handover

Overdracht tussen sessies aan het Adventurer Platform. Bovenaan staat de nieuwste sessie. Lees
eerst [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) en [RUNTIME_POLICY.md](RUNTIME_POLICY.md).

---

## 23-11-2026 15:30: validatie 441b072 (#71) verwerkt: bank-pingpong (branch `adventurers/analysis-p7`)

Niet in game getest.

- **Oorzaak:** `fetchTools` deed `withdraw(id, 1000)`. Voor Construction (packFor: 20 planken) vulde dat de tas met planken; de volle-tas-route (`Trade.keepIds`, zonder klusmateriaal) zette ze terug; packFor miste ze weer. Slayed Soul 155x. Hammers: alle hammers van de bank mee, `clearBag` zette de extra's terug.
- **Fix:** `fetchTools(entry, plan, ids, amounts)`: 1 per gereedschap of het packFor-aantal, en voor niet-stapelbaar nooit meer dan `vrije vakjes - (fullSlots+1)`. De volle-tas-deposit gebruikt `keepAtExchange` (met `workingMaterials`). `bankUnusedTools` laat `workingMaterials` liggen.
- **Detector:** zelfde item 3x in 10 min gehaald: metric `bank_pingpong` (item, mode, activity, `lastDeposit` met reden `full_bag`/`clear_bag`, vrije vakjes), event `bankPingpong`, en het item 1 uur in `questKeep` (blijft uit elke deposit).
- **Niet gedaan:** lus-escalatie op klusniveau (de pingpong-oorzaak is weg; eerst kijken of lussen dalen), Death Plateau (Jorgbot 12 liep van Seers naar 2853,3591 tijdens combat; route onduidelijk, eerst meer data), magic-tree zoekkosten, shark fishing Catherby, walk_blocked "lumbridge swamp mine": dat is niet de mijnplek maar een bank-booth op 3122,3124 (reason `bank`, alleen de naam komt van de nieuwe plek); nakijken of dat een echte bank is, pakket 5.
- **Validatie:** suite 170 pass, 14 fail (baseline); eslint no-undef schoon.

## 23-11-2026 14:15: validatie `441b072` (#68, #70) (branch `analysis/validatie-441b072`)

- **Logs:** 11:15-13:07 UTC (112 min, 96 bot-uren). Telt.
- **Beter:** 25.472 OSRS-XP per bot-uur (+70% t.o.v. 21-11), 68% van de tijd met XP, combat 0 van 45 vast, `walk_blocked` 1,18 per bot-uur, mining-lopen 51% (was 75-81%), lus-escalatie werkt.
- **Nieuw, belangrijkst:** bank-pingpong. Slayed Soul haalde 155× een plank en zette hem 156× terug, Jorgbot 7 105× een hammer ("hammer, hammer" terug). De escalatie verplaatst de lus naar de volgende bank: lussen per bot-uur 0,40 → 0,91. Zelfde soort fout als op 20-11 en ADR-0005.
- **Verder:** quests 0 van 31; Markbot 12, Jorgbot 14 en Patrickbot 13 opnieuw 0 XP; trage magic-tree-beurten (4,5-5 s, `far` target); shark fishing vast bij Catherby; Jorgbot 12 dood op Death Plateau (combat-training-site); `lumbridge_swamp_mine` geeft `walk_blocked` vanaf de eigen tegel.
- **Details:** [analysis/2026-11-23-validatie-441b072.md](analysis/2026-11-23-validatie-441b072.md).

## 23-11-2026 13:00: voortgangsanalyse (#69) verwerkt: mijnplek, lus-escalatie, werkmaatstaf (branch `adventurers/analysis-p6`)

Uit `docs/analysis/2026-11-23-voortgang-en-aandachtspunten.md`. Niet in game getest.

- **Mithril zonder erts (Jorgbot 14, Patrickbot 11):** de oorzaak was de plek. `lumbridge_swamp` (3228,3150) is de oostmijn (koper/tin); de coal/mithril/adamant-rotsen staan bij 3143-3148,3144-3153 (object-index: 5 mithril, 2 adamant). Daar kwam geen rots binnen bereik, de zoekloop liep naar het westen of naar Al Kharid (2 mithril, bezet) en terug. Nieuwe bestemming `lumbridge_swamp_mine` (3146,3148, minLevel 30, `activities` coal/mithril/adamantite); `activitySites` daarop omgezet.
- **Wachten op respawn:** `interactObject` krijgt `crowdWaitSeconds` (standaard 60); `mine_rocks` wacht 300 s bij een bezette mijn.
- **Lus-escalatie (Markbot 12, Seers):** tweede `loop` naar dezelfde plek binnen 2 uur zet die plek 2 uur in `blockedPlaces` (nearestBank kiest dan een andere). Niet voor de Grand Exchange. Metric `loop` heeft `escalated`.
- **Werkmaatstaf:** weg van de klusplek met XP in de laatste 60 s telt als `working`, niet `walking`. Bij de klus blijft idle na 20 s. Cijfers vanaf deze versie zijn dus niet 1-op-1 te vergelijken: lopen daalt en werken stijgt door de meting.
- **Niet gedaan:** gem stalls als geldbron, Herblore/Fletching-gewichten, boss voor maxed accounts, pakket 5, transport als route-optie.
- **Validatie:** suite 170 pass, 14 fail (baseline); eslint no-undef schoon; JSON geldig.

## 23-11-2026 11:30: voortgang sinds 21-11 en aandachtspunten (branch `analysis/voortgang-23-11`)

- **Beter:** OSRS-XP per bot-uur 15,0k → 20,9k (+39%); tijd in blokken met XP 54% → 62%; combat `stuck` 76% → 3%; vastlopers per bot-uur −50%, `walk_blocked` −43%, `stranded` −56%.
- **Kritisch:** "werken" deugt niet als maatstaf (27% van de XP in blokken zonder "working"; yew 95%, combat 73%); lopen + errand niet gedaald (55% → 59%); quests staan stil (6-11%); Hunter, Herblore, Fletching, Ranged nauwelijks getraind; maxed accounts (3) hebben geen werkende boss.
- **Tussenuit:** Markbot 12 2,2 uur vast bij Seers' Village (lusbewaking escaleert niet); Jorgbot 14 en Patrickbot 11 2,2 uur mithril zonder erts (wisselen meteen van mijn); idle bij harpoon fishing en gem stalls.
- **Nieuw script:** `docs/analysis/scripts/period_compare.py`.
- **Details:** [analysis/2026-11-23-voortgang-en-aandachtspunten.md](analysis/2026-11-23-voortgang-en-aandachtspunten.md).

## 23-11-2026 12:30: validatie f0c01e1 verwerkt: Barrows-lus, eten, gilde-bank (branch `adventurers/analysis-p5`)

Uit `docs/analysis/2026-11-23-validatie-f0c01e1.md`. Niet in game getest.

- **Barrows-lus:** `BarrowsRun.fail` onder de grond breekt een Varrock-tablet (anders home) en zet `entry.barrowsAsideUntil` op 30 min. `startBarrows` geeft dan `cannot place_unreachable` (`need: barrows_tunnel`).
- **Barrows-reden:** `Barrows.plugin` `useDoor` zet `lastDoor` (`crossing`, `not_on_side`, `locked`, `puzzle`, `crossed`, met deur, tegel, kamer) in de bot-view. `barrows_run` failed heeft nu `at`, `room`, `lastDoor`, `openDoors`, `npcsNear`, `attacked`, `doorTries`. Volgende validatie: hieruit de echte deur-oorzaak halen.
- **Spade:** de drie "geen spade" kwamen direct na "8 keer in 2 min naar de Grand Exchange" (GE-wandeling in rust), niet door een onkoopbare spade. De melding noemt nu de reden (`exchange_blocked`, `coins`, ...).
- **Eten (Eeshwar):** eerlijke bot zonder eten stopt nu ook midden in een gevecht onder 1/3 HP (was alleen zonder doel onder 1/2).
- **`reachable()`:** een "nee" wordt 60 s onthouden per NPC (8x8-cel van de bot + tegel van de NPC).
- **Fishing Guild:** `walk_blocked` ging naar de bank-booth ín het gilde (`nearestBooth`, naam via `describeLocation`). Booths binnen 20 tegels van een `*_guild`-bestemming met onvervulde `requires.skills` tellen niet meer.
- **Niet gedaan:** Wizards' Tower-route, Seers obstakel 5, pakket 5.
- **Validatie:** suite 170 pass, 14 fail (baseline); eslint no-undef schoon; `node --check` op alle vier bestanden.

## 23-11-2026 11:00: `4baf1a2` bevestigd, `f0c01e1` (#66) eerste 45 min (branch `analysis/validatie-f0c01e1`)

- **`4baf1a2` (73 min):** combat 0 van 28 `stuck` (bevestigd), holds en clay goed, Farming plant, 0 doden. Barrows-tunnels (#64) niet opgelost.
- **#66:** lopen 39,5% → 31,8%, mithril-bots 13 → 9, ontbrekende shortcut 15× → 1×. Mithril-bots lopen nog 75%.
- **Barrows:** 16 runs, 0 loot, alle vast in de tunnels (0→3, 0→1). Na het opgeven begint de bot meteen een nieuwe run in de tunnels (Markbot 17 3× op 3535,9706). De reden per deurklik uit het voorwerk zit nog niet in `barrows_run`.
- **Verder:** trage `trainCombat`-beurten bij onbereikbare NPC's (`reachable()`), Eeshwar dood zonder eten, `walk_blocked` naar de Fishing Guild groeit (17×), 3× geen spade voor Barrows, quests 2 van 18.
- **Details:** [analysis/2026-11-23-validatie-f0c01e1.md](analysis/2026-11-23-validatie-f0c01e1.md).

## 23-11-2026 11:20: validatie 4baf1a2 verwerkt: drukte bij mining, ontbrekende shortcut (branch `adventurers/analysis-p4`)

Uit `docs/analysis/2026-11-23-validatie-4baf1a2.md` (41 min: combat 0 van 13 vast, 0 trage beurten, 0 doden; lopen 39%). Niet in game getest.

- **Drukte (17 bots bij mithril/adamantite, 80% lopen):** de view krijgt `crowd` (per mode hoeveel andere avonturiers, alle clans, nu op een trainingsplan zitten). Geldkeuze: score gedeeld door `max(1, (crowd+1)/CROWD_FREE)` (`CROWD_FREE` 4). Gewogen keuze (afwisseling, spaardoelen): gewicht × `CROWD_FREE/(crowd+1)` vanaf 4. De capaciteit in `bot-activities.json` (mithril 160, adamantite 80) is niet aangepast: het echte aantal rotsen per plek is niet zonder cache te tellen.
- **Ontbrekende shortcut (14x "Vond de jump-to broken raft naar Al Kharid niet"):** `missingShortcuts` (gedeeld, 30 min) bij een niet-gevonden shortcut-object, metric `shortcut_missing`. Was alleen per bot en alleen bij een mislukte landing.
- **Niet gedaan:** Seers obstakel 5 (11x `stuck`, in game nakijken), Slayer-meester-route rond Draynor, Wizards' Tower-route, pakket 5.
- **Validatie:** suite 170 pass, 14 fail (baseline); `bot-knowledge` +1; eslint no-undef schoon.

## 23-11-2026 09:45: validatie `4baf1a2` (#61, #63, #64) (branch `analysis/validatie-4baf1a2`)

- **Logs:** 08:46-09:27 UTC (41 min).
- **Werkt:** combat-training 0 van 13 `stuck` (was 80%), 0 trage beurten, 0 doden, holds en clay goed, Farming plant weer (4.725 XP), geldkeuzes op clanmetingen.
- **Nieuw:** lopen 39,3% (was 19,8%), vooral mining: 17 bots op mithril/adamantite die tussen Lumbridge Swamp en Al Kharid pendelen (81% lopen); `capacity` 160/80 remt niets af; de clankennis (mining ~32k gp/uur) trekt meerdere bots tegelijk. 14× een shortcut die niet gevonden wordt ("jump-to broken raft").
- **Verder:** Seers obstakel 5 (11× `stuck`), Wizards' Tower nog steeds `walk_blocked`, quests 1 van 12.
- **Script:** `version_report.py` telt spaardoelen niet meer als questklussen.
- **Details:** [analysis/2026-11-23-validatie-4baf1a2.md](analysis/2026-11-23-validatie-4baf1a2.md).

## 23-11-2026 10:10: Barrows-tunnels (A2) (branch `adventurers/barrows-tunnels`)

Ontwerp uit `docs/analysis/2026-11-22-voorwerk-oorzaken.md` A2. Niet in game getest.

- **Gang (kamer -1):** de lange deuren (0-2, 0-6, ...) eindigen in een gang; de bot wachtte daar eeuwig (`if (room < 0) return "running"`). Nu loopt hij naar het midden van de kamer die de route als volgende noemde (`run.nextRoom`, `v.roomCentre`).
- **Monsters eerst:** wie de bot aanvalt, wordt eerst bevochten (`fight`), dan pas naar de deur.
- **Deur direct vanaf de zijtegel:** `useDoor` in de plugin neemt de deur alleen van precies die tegel; de klik via `walkToObject` kon hem eraf halen. Nu `emitObjectInteraction` direct, één keer per 3 s.
- **Reden bij falen:** na 4 klikken op de zijtegel zonder oversteek: `fail` met deur-varbit, kamers, zijtegel, of de deur open staat en hoeveel NPC's dichtbij. Stap 1 van het ontwerp (de reden uit de plugin zelf) is daarmee vanuit de bot gedekt; de plugin is niet aangepast.
- **Bevestigen:** ≥ 80% van de Barrows-runs met loot; geen "tunnel x→y" die blijft hangen.
- **Validatie:** suite 169 pass, 14 fail (baseline); eslint no-undef schoon. Geen unit-test: BarrowsRun vraagt de plugin-view; in game nakijken.

## 23-11-2026 09:55: validatie #61 verwerkt: Farming en Wander (branch `adventurers/analysis-p3`)

Uit `docs/analysis/2026-11-23-validatie-61.md`. Niet in game getest.

- **Farming (6 van 6 vast bij Falador, steeds "rake"):** `FarmPatches.click` stuurt de optie direct binnen 4 tegels (zoals bij de ruïnes; `walkToObject`-execute kwam niet). Rake alleen met een rake in de tas (anders `left: geen rake`). Dezelfde klik op een patch met onveranderde opties telt; na 4 keer wordt die patch deze ronde overgeslagen met reden (`describe`: `left=`, `rake=`). Test in `bot-construct-farm` (de fake world heeft nu een rake).
- **Wander (4,9 s bij de GE):** `describe` met doel en per keuze `acceptMs` (o.a. de greppel-zoektocht via `findNearestObject`, straal 30) en `chooseMs`. Daarmee volgt de oorzaak uit de volgende `slow_bot`.
- **Niet gedaan:** de poort bij 2649,3470 (klikt, blijft dicht: in game nakijken), A2 Barrows-tunnels, pakket 5 quests.
- **Validatie:** suite 169 pass, 14 fail (baseline); eslint no-undef schoon.

## 23-11-2026 09:00: #57 bevestigd, #61 eerste 13 min (branch `analysis/validatie-61`)

- **#57:** ruim 2 uur over drie versies. A1, A3 (clankennis bewaard over de herstart, geldkeuzes op clanmetingen), A5 en A7 bevestigd.
- **#61 (13 min):** holds werken (0 Giant Mole/Runecrafting), clay weg, combat 0 van 2 `stuck`, geen doden, `brainSnapshot` gevuld; Mark logt eerst in.
- **Nieuw:** Farming loopt vast met `rake` zonder effect (`tries=[]`): `walkToObject`-execute bij grote objecten, zoals bij de ruïnes; trage `wander`-beurt 4,9 s bij de GE (`describe` leeg); poort 52/53 bij 2649,3470 klikt maar blijft dicht. Quests 0 gehaald.
- **Nieuw script:** `docs/analysis/scripts/version_report.py` (kerncijfers per groep versies).
- **Details:** [analysis/2026-11-23-validatie-61.md](analysis/2026-11-23-validatie-61.md).

## 22-11-2026 22:30: validatie #57 en voorwerk verwerkt (branch `adventurers/analysis-p2`)

Uit `docs/analysis/2026-11-22-validatie-3f8a803.md` en `2026-11-22-voorwerk-oorzaken.md`. Niet in game getest.

- **Hold-lek:** `heldBy(plan)` in `startTraining` en `startBoss`: boss-`hold`, `buyToTrain[skill].hold`, activiteit-`hold` (de registry bewaart `hold` nu). Elke weg naar een klus (hervatten, samen trainen, achterstand) loopt daarlangs; reden `on_hold` (30 min onthouden).
- **Clay-lus (A4, opnieuw):** oorzaak in de logs: de klus komt terug via `resumeTask` (na elk bankbezoek "Gaat verder met clay rocks") zonder `entry.gather`, dus zonder teller. Een hervatte klus met reden "<item> voor <quest>" zonder gather-stand wordt niet hervat (`gather_dropped`). Questverzamelen telt niet als geldmethode in de clankennis (gp `null`).
- **Geldgok (A3):** niets gemeten (bot en clan): willekeurig onder de onbekende, reden "nog niets gemeten". Wel iets gemeten: een onbekende scoort onder de laagste gemeten waarde.
- **13 buitlus:** `Loot.takeStep` geeft `refused` als oprapen naast het item mislukt. TrainCombat: buit die geweigerd wordt of 20 s achterna gelopen, 2 min negeren; `bot.loot` elke beurt opnieuw getoetst; alleen `taken` telt als voortgang; `describe` toont `loot=`.
- **18 molshoop:** na aankomst naar de molshoop zelf (id uit `GiantMole.plugin` `MOLE_HILL_ID`, binnen 5 tegels) via `walkToGroundItem`, dan pas Dig. 3 digs binnen 10 min zonder succes: `place_unreachable` (30 min). Hold blijft tot een in-game check.
- **17 ruïnes:** binnen 3 tegels van de ruïnes wordt een lopende loop gestopt (die naar de tegel onder het object eindigde nooit); `describe` toont `queue`, `busy`, `near`. Hold blijft tot een in-game check.
- **Doden bij zakkenrollen:** een eerlijke bot at alleen cake (de standaard voor gewone bots). Nu: elk eten via de Eat van het spel; gewond zonder eten: de klus stopt (`failed`).
- **Pakket 8:** `slow_bot.brainSnapshot` als eigen veld (de velden stonden er al los in).
- **Validatie:** suite 168 pass, 14 fail (baseline); nieuw `bot-loot-refused`, `bot-knowledge` +1; eslint no-undef schoon.
- **Open:** A2 Barrows-tunnels (eerst reden-telemetrie in de plugin), Rellekka-vastlopers, `roam`-trage beurten (nu met snapshot te zien), quests (pakket 5).

## 22-11-2026 21:15: validatie bundel #57 (`b943103`/`3f8a803`) (branch `analysis/validatie-3f8a803`)

- **Logs:** 20:04-20:47 UTC (43 min). Werken **20,0%** (beste tot nu toe).
- **Werkt:** A1 (geen "kan de Barrows niet bereiken"), A5 (Rellekka in gebruik), A7 (`job.fit`), clankennis (16-24 gemeten activiteiten per clan na 40 min).
- **Lekt:** holds Giant Mole/Runecrafting via hervatten ("verder"), samen trainen ("samen") en "achterstand" (Slayed Soul 17 min Runecrafting); A4 clay-lus loopt door (23 klussen, alle `full bag`), en clay telt in de clankennis als 33.681 gp/uur; zonder clandata wint thieving nog op de gok van 30.000 ("schatting" 8 van 10).
- **Verder:** combat 18 van 22 `stuck` (buitlus); Eeshwar 2× dood door een Paladin zonder eten, daarna in brons; 7 trage beurten, 3× in `roam`, `brainSnapshot` nog `null`.
- **Details:** [analysis/2026-11-22-validatie-3f8a803.md](analysis/2026-11-22-validatie-3f8a803.md).

## 22-11-2026 21:00: voorwerk, oorzaken van vier vastlopers (branch `analysis/voorwerk`)

- **Wat:** code-onderzoek (geen wijzigingen) naar pakket 13, 17, 18 en A2, met de logs als bewijs. [analysis/2026-11-22-voorwerk-oorzaken.md](analysis/2026-11-22-voorwerk-oorzaken.md).
- **13, combat:** buitlus. `Loot.takeStep` geeft `walking` terug als oprapen naast het item mislukt, `bot.loot` slaat de tascontrole van `lootNear` over, en de buitstap zet `lastProgressAt` op nu. De doelwitkeuze en de vangnet-timer worden zo overgeslagen tot het item verdwijnt (past bij `idle=0s` in de logs).
- **17, Runecrafting:** `CraftRunes` r. 61 geeft elke beurt `running` (bewegingsqueue of `busy`); de loop gaat naar de geblokkeerde oorsprongstegel van de ruïnes (2984,3291). Het stapje blijft `-`.
- **18, Giant Mole:** graven werkt alleen precies op een molshoop (`onMoleHill`); de bot graaft na een errand-aankomst binnen 3 tegels en controleert niet of hij in het hol is.
- **A2, Barrows:** `useDoor` weigert stil als de bot niet precies op een zijtegel staat; na een oversteek in een gang (`roomAt` = -1) wacht de bot (`if (room < 0) return "running"`). De koppeling 0↔2 is een lange gang.
- **Volgende stap:** 13 eerst (grootste winst), dan 18, 17, A2.

## 22-11-2026 20:00: validatie `4101cc8` (PR #54) en correctie XP-snelheden (branch `analysis/validatie-4101cc8`)

- **Logs:** `4101cc8` 19:02-19:39 UTC (37 min). #57 staat op `main` maar draaide nog niet.
- **Correctie:** de "verdachte" XP-snelheden (pakket 9) zijn verklaard: `TieredExperience` staat standaard aan (x25 tot 49, x15 tot 79, x10 tot 89, x5 vanaf 90). Gedeeld door de tier-factor kloppen ze met OSRS (knights ~36k, lobster ~20k, yew ~36k per uur). Pakket 9 en Activity Health moeten met die factor rekenen.
- **Werkt:** werken 17,6% (beste meting tot nu toe), 0 agility-lag, 0 Morytania, `near` 11%, 0 doden, Hunter-XP > 0 na de hold.
- **Open:** combat 12 van 18 `stuck` met vrije NPC's in de band en `failed=0` (oorzaak tussen diagnose en doelwitkeuze); trage beurten bij Patrickbot 18 in `roam` (tot 4,3 s, `brainSnapshot` null); Runecrafting en Giant Mole (holds in #57); Barrows; 16 van 18 geldkeuzes "eens proberen" (A3 in #57).
- **Details:** [analysis/2026-11-22-validatie-4101cc8.md](analysis/2026-11-22-validatie-4101cc8.md).
- **Volgende stap:** #57 live zetten en 60 min meten.

## 22-11-2026 21:15: kennistabel per clan, hogere tiers, vechtband, questgids, action_fit (zelfde branch `adventurers/barrows-travel`)

Bovenop de bundel van 20:40; mergen na ≥ 60 min op `4101cc8`. Niets hiervan is in game getest.

- **A3 kennistabel per clan (`adventurers/Knowledge.PlayerBots.js`):** per clan, per `mode:` en `activity:` de laatste 25 klussen (gp/uur, XP/uur, stuck), in `data/saves/adventurer-knowledge.json`, hooguit eens per minuut weggeschreven (async). `trackJob` schrijft elke beëindigde trainingsklus, ook te korte (alleen de afloop). Planner: eigen meting, dan clanmediaan (≥ 5 metingen), dan gok gedeeld door 4. "Eens proberen" alleen in de 10%-keuze voor wat clan én bot niet kennen; anders "schatting" of "(~X gp/uur, clan, n metingen)". Metric `knowledge` per clan elk half uur (Activity Health: XP/uur en stuck-aandeel per activiteit). Automatisch uitzetten op basis daarvan: nog niet.
- **A5 plafonds:** agility-koersen Pollnivneach (70), Rellekka (80), Ardougne (90) in `adventurers.json` en `bot-activities.json`; starttegels afgeleid uit de koersplugins, **in game te bevestigen**. Prayer: babydragon (30) en dragon bones (50). Herblore: super restore (63), super defence (66), ranging potion (72). Smelten niet: de recepten kennen geen verhouding ore:coal.
- **A6 vechtband:** voor avonturiers het gemiddelde van Attack, Strength en Defence in plaats van het laagste. De stijl van avonturiers komt al uit de planner (`combat_ranged`/`combat_magic` → `honestStyle`); de naam-hash geldt alleen voor gewone bots. Dat klopt niet met de analyse.
- **Pakket 5, punt 4:** "quest helper error: fetch failed / ECONNREFUSED" wordt afloop `bridge_down`: 10 min opzij, telt niet als falen, blokkeert niet voor iedereen.
- **A7:** `job`-metric heeft `fit`: skill, level, eis, beste activiteit voor dat level, `below` (levels eronder).
- **Uitloggen (eigenaar):** `[World] Deregistering player ... reason=<idle_timeout|socket_close|logout|...>` in de console; de reden stond alleen op de speler.
- **Validatie:** suite 166 pass, 14 fail (baseline); nieuw `bot-knowledge` (2 pass); eslint no-undef schoon.

## 22-11-2026 20:40: Barrows-reis, holds, clay-lus, inlogvolgorde (branch `adventurers/barrows-travel`)

Mergen na ≥ 60 min op `4101cc8`.

- **A1 Barrows zonder reisweg (regressie van #53, van mij):** `startBarrows` geeft `place_unreachable` als `lockedAway` de Barrows dicht ziet (geen tablet te krijgen); 30 min onthouden. Was: run start en stopt binnen een minuut, elke 10 s opnieuw (Markbot 18).
- **Holds (eigenaar: mag uit, maar moet terug):** `boss_giant_mole` (pakket 18) en `buyToTrain.RUNECRAFTING` (pakket 17) krijgen een `hold` met reden en terugkeervoorwaarde; `precheck` slaat boss-holds over, `buyableSkills` skill-holds. `bot-holds.test.cjs` eist bij elke hold een datum en een "weer aan"-voorwaarde.
- **Uitgezet, moet terug (de werklijst):**
  - Giant Mole: graven moet tot het hol en een kill leiden; ≥ 1 kill per 10 min, 0 doden zonder eten.
  - Runecrafting: in game uitzoeken wat er na "Use talisman on ruins" gebeurt; Runecraft-XP > 0.
  - Hunter wagtail en salamanders: snares/net trap moeten vangen (S2 skill-progressie).
  - Morytania te voet: Paterdomus-route (valluik, Holy barrier) bewijzen met 3 loopjes.
- **A4 clay-lus:** `gatherFor` verzamelt niet als tas + bank al genoeg hebben (metric `gather_skipped`); bij klaar en bij herstel na een herstart gaat het item in `questKeep` (6 uur, niet verkopen) en terug naar de quest. Bewijs: Jorgbot 5 mijnde 321 clay en zette ze te koop, 6 nodig.
- **A8 inloggen om en om:** `Clans.loginOrder` (Mark, Jorg, Patrick, ...; `loginFirstClan` in `adventurers.json`); `namesOf` ongewijzigd.
- **Validatie:** suite 164 pass, 14 fail (baseline); nieuw `bot-holds`, `bot-clans` +1; eslint no-undef schoon.

## 22-11-2026 20:30: past de actie bij het level, geld, Barrows (branch `analysis/actiekeuze`)

- **Vraag eigenaar:** max-level bots op lage vijanden of lage acties; gem stalls voor geld; Barrows-deuren.
- **Gevonden:** 73% van de skill-tijd is de beste activiteit voor het level; afwijkingen door de clay-lus van Doric's Quest (1.037 bot-min), plafonds in de data (Prayer alleen big bones, Agility tot Seers, Herblore tot 55, smelten tot 30) en vechtstijlen die per botnaam vastliggen (`styleFor`), met de band op het laagste melee-level. Geld: 160 van 177 keuzes "eens proberen"; gem stalls 2.792 gp/uur gemeten. Barrows 0 van 13: reizen zonder tablet kan niet meer sinds #53 (Markbot 18 start elke 10 s een run), en in de tunnels vast op gewone open deuren (de bot kent `openDoors` wel).
- **"Eens proberen":** 188 van 215 geldklussen (87%, bedoeld 10%). Oorzaken: `entry.earn` niet opgeslagen (weg bij elke herstart), metingen pas na 3 min, label bij elke ongemeten keuze, `MONEY_GUESS.thieving` 30.000. Ontwerp gedeelde kennistabel per activiteit (§25) in sectie 3c.
- **Details en pakketten A1-A7:** [analysis/2026-11-22-actiekeuze.md](analysis/2026-11-22-actiekeuze.md).
- **Volgende stap:** A1 (Barrows alleen met reisweg), daarna A2 (tunnel-telemetrie) en A4 (clay-lus).

## 22-11-2026 20:05: eerste logs van 8b75ca8, Hunter deels uit, combat-diagnose (branch `adventurers/combat-diagnose`)

- **Logs 8b75ca8 (13:49-14:14 UTC, 25 min; daarna nog niet gedeeld):** 0 `slow_bot` met agility (was 27 in 2 uur), 2 `slow_tick` (2,0 s `roam`/wander, 3,1 s `trainCombat` bij boss_giant_mole). Planner-tick gem. 41 → 21 ms; planning max 192 ms. Bank `near` 34/175 (19%) → 1/97 (1%), gem. 48 → 41 s. Morytania-errands 30 (28 blocked) → 0.
- **Combat (pakket 13):** `npcs=` laat bij vastgelopen training 10 tot 42 vrije NPC's in de band zien, en toch `target=none approach=none`. Dus weigert `canAttackPermission` ze allemaal of is er geen `reachable`. De diagnose splitst "free" nu in `deny_<CanAttackResponse>`, `unreachable` en `free`.
- **Hunter (besluit eigenaar: uit als het niet werkt):** e75bbc4: crimson swift 3 klussen 1.025 XP in 57 min; wagtail 2 klussen 0 XP; salamander 1 klus 0 XP. 8b75ca8: crimson 2 klussen 0 XP in 37 min. Nieuw veld `hold` in `bot-activities.json` (Planner `bestActivity`/`activitiesFor` slaan het over): wagtail en beide salamanders. Crimson swift blijft aan. Weer aan: `hold` weg.
- **Validatie:** suite 162 pass, 14 fail (baseline); `bot-hunter-sites` 4 pass; eslint no-undef schoon.

## 22-11-2026 19:00: validatie `8b75ca8` (PR #52, #53) (branch `analysis/validatie-8b75ca8`)

- **Logs:** `8b75ca8` 13:49-14:14 UTC (25 min, net na herstart; na 14:14 geen nieuwe logs op `bot-logs`). Voorlopig: RUNTIME_POLICY vraagt 60 min.
- **Werkt:** agility (0 `slow_bot` door agility), Morytania dicht (0 errands, Slayer-XP 12.100 via Spria), banken (`near` 9%).
- **Nieuw:** Runecrafting 0 XP in 113 bot-min, vast bij de air-ruïnes (pakket 17); Giant Mole 66× graven voor 2 kills, `loop`, 3,1 s botbeurt, dode zonder eten (pakket 18); trage beurten in `roam` (2 s). Combat: `npcs=` toont vrije NPC's terwijl `target=none` blijft.
- **Details:** [analysis/2026-11-22-validatie-8b75ca8.md](analysis/2026-11-22-validatie-8b75ca8.md).
- **Volgende stap:** 60 min logs na de volgende start; pakketten 17 en 18 in game bekijken; Hunter beslissen volgens de regel van de eigenaar.

## 22-11-2026 14:45: analysepakketten 6, 7, 13 en de Hardcore-dood (branch `adventurers/analysis-p1`)

Gebundeld; mergen pas na ≥ 60 min op `46cad60` (pakket 3).

- **Hardcore-dood (besluit eigenaar):** `downfall` (8% per 5 min een gedwongen dodelijke klap op een vechtende Hardcore-bot) is weg uit `brain/Ironmen.PlayerBots.js`. Ze sterven alleen nog door een echte klap. Bevestigen: geen `bot-hardcore-downfall`-taak meer; Hardcore-doden alleen met een echte aanvaller.
- **Morytania (pakket 6):** `travel-hubs.json` `lockedAreas` Morytania `onFoot: false` met `onFootWhy`. Daardoor geen sites, Slayer-meester Mazchna, combat-site Paterdomus (3416,3477) of errand erheen te voet; de walk guard (`lockedAway`) laat een teleport nog toe. Agility kiest Canifis niet meer als hij er niet heen kan (`lockedAway` in de koerskeuze). Tests werken met een kopie zonder de hold. Openzetten: de twee velden weg na 3 geslaagde loopjes Varrock-oost naar Canifis. Bevestigen: 0 errands naar Mazchna/Canifis Rooftop te voet, geen `walk_blocked` rond 3402,3484.
- **Bankcoördinaten (pakket 7):** de bankplek is de balie; de loop eindigt 4-6 tegels ervoor (`near`: Burthorpe 215, Catherby 88, Seers 83 keer, met `tilesLeft` 4-6) en wachtte dan 45 s. "burthorpe" is geen bestemming maar de naam van de dichtstbijzijnde hub voor de balie in de Warriors' Guild (2846,3543; `nearestBooth`). Errands kennen nu `nearTiles`: bank-errands (6 tegels) komen aan na 3 s stilstaan binnen die afstand. Bevestigen: `near`/totaal per bank < 20%, errandminuten bank fors lager.
- **Combat-training (pakket 13, stap 1):** de stuck-momentopnamen zeggen `target=none settled=false failed=0` vlak bij het anker. `describe` geeft nu `npcs=` met per NPC rond de site de eerste reden van afvallen (`level`, `busy`, `claimed`, `avoided`, `not_a_target`, `free`), de band en welke NPC's er staan. Daarmee de echte oorzaak kiezen (spawn, level-band of bezetting).
- **Validatie:** suite 161 pass, 14 fail (baseline); nieuwe tests in `bot-errands`, `bot-ironmen`, `bot-travel-hubs`; eslint no-undef schoon. `whyNoTarget` kon hier niet draaien (TrainCombat vraagt de TS-core); hij zit in try/catch.

## 22-11-2026 14:10: agility-lag, oorzaak in de objectindex (branch `adventurers/agility-lag`, pakket 1)

- **Bewijs (analyse 21-11, nagerekend):** 27 `slow_bot`, alle `runCourse` (Falador 14, Seers 6, Varrock 5, Canifis 1, Gnome 1); `slow_tick.ms` ≈ `slowestBotMs` (19.613/19.603, 13.030/13.022).
- **Oorzaak (uit de code):** `TraversalAssist.trackObjectId` zette bij elk nieuw object-id de hele index op ongeldig. De volgende zoektocht deed dan `buildPersistentIndexByScanningMap`: alle regio's scannen (onbekende uit de cache lezen) en `object-index.json` (448 KB) herschrijven, in de beurt van de bot. Agility-obstakels staan niet in de catalogus waarmee de index bij het opstarten wordt gevuld; de fallback in `RunCourse` (r. 136) zoekt alle obstakels van de baan, dus meerdere nieuwe ids, elk een volledige herbouw, in één beurt. Na een herstart begint dat opnieuw. De 25×25-scan uit de analyse-hypothese kost maar milliseconden en is het niet.
- **Fix:** ids die na het opstarten voor het eerst gevraagd worden, zijn "late ids". Die worden per regio geïndexeerd zodra een zoektocht die regio nodig heeft (`coverLateIds`), bij `findNearestIndexedLocation` hoogstens 16 regio's per aanroep, dichtstbij eerst. Ze komen niet in de dump; de vingerafdruk blijft de opstartset. Eén keer na deze update wordt de oude dump (met de vroegere late ids) afgekeurd en eenmalig opnieuw gescand bij het opstarten.
- **Test:** `bot-index-late-ids.test.cjs` (2 pass; faalt op de oude code). Suite 159 pass, 14 fail (baseline); eslint no-undef schoon.
- **Bevestigen met:** `slow_bot` met `activity` agility_* = 0 en `slow_tick` > 1 s door agility = 0, 2 uur op de nieuwe `v`.
- **Eigenaar, open vragen analyse:** testprofielen houden hun kapitaal (ja); Hardcore-dood niet per kans (nee, nog te bouwen). Gear achter granted quests: ook bestaande items afnemen, maar per quest pas als die speelbaar is (tot dan niets veranderen). Hunter blijft aan zolang het werkt (beslissen op 60 min logs van de nieuwe `v`). Minimaal 60 min per serverversie: akkoord.

## 22-11-2026: skill-progressie, money making en gevechtskeuzes (branch `analysis/skill-progression-2026-11-22`)

- **Wat:** per skill het progressiepad uit de OSRS Wiki-trainingsgidsen, gefilterd op wat een bot eerlijk kan, naast wat de bots nu doen; een generiek keuzemodel (doel, methode, combineren, geld); money making per accountfase; vijandkeuze op verdediging en elementzwakte; bossladder tegen de plugins op de server. Uitgewerkt tot pakketten S1-S10 in [analysis/2026-11-22-skill-progressie.md](analysis/2026-11-22-skill-progressie.md), met datasets in `docs/analysis/2026-11-22/`.
- **Belangrijkste vondsten:** de Gemstone Crab (plugin aanwezig) is volgens de wiki de idle-trainingsplek voor melee en ranged vanaf level 30, terwijl 80% van de combat-klussen `stuck` eindigt; `TrainCombat` kiest alleen op combat level terwijl `monsters-complete.json` verdediging en zwakte heeft; de quests die vroege levels overslaan (Restless Ghost, Imp Catcher, Witch's Potion, Knight's Sword, Doric's Quest) zijn precies de geblokkeerde; 50 van de 58 bosses uit de wiki-ladder bestaan als plugin, bots gebruiken er 3.
- **Aangepast:** geen productiecode.
- **Volgende stap:** S1 (Gemstone Crab) en S3 (vijandkeuze op verdediging en zwakte).

## 22-11-2026: runtime-analyse en bouwspecificatie (branch `analysis/runtime-2026-11-21`)

- **Wat:** analyse van `bot-logs` (21-11 08:48-14:50 UTC, 60 avonturiers, 12.503 bot-min, `2f294017e` t/m `e75bbc441`). Uitgewerkt tot 16 werkpakketten met bewijs, bouwstappen en "Klaar als" in [analysis/2026-11-21-runtime-analyse.md](analysis/2026-11-21-runtime-analyse.md). Datasets en een reproduceerbaar script staan in `docs/analysis/`.
- **Belangrijkste vondsten:** werken 16,3% (staat stil sinds 17-11); Hunter 13% van de tijd met ~0 Hunter-XP; combat-training 108 van 135 klussen `stuck`; Morytania 100% `blocked`; quests 8 van 119 gehaald; alle 27 `slow_bot` zijn agility (tick tot 19,6 s, `planMs` 0); `grantedQuests` geven dragon scimitar, rune platebody, Fremennik-helmen en crystal tools zonder quest (§7).
- **Aangepast:** geen productiecode.
- **Volgende stap:** P0 uit het overzicht van de analyse: agility-lag meten (pakket 1), Hunter in een `activityHold` (pakket 2), deploydiscipline (pakket 3), gear achter granted quests (pakket 12).

## 21-11-2026 15:20: meting van lange botbeurten (branch `adventurers/slow-bot`)

- **Logs na #47 (14:03-14:08 UTC):** `planning` gaf route 155x samen 1.551 ms (max 132), stairs 3x (max 9), exit 1x. De stiltes van 23 en 27 s (14:05:11, 14:06:36) kwamen dus niet van de zoektochten. #47 blijft (geen schade, wel een eerlijker budget).
- **Nieuw:** `runtime/SlowEntries`: BehaviorTask meet elke botbeurt; vanaf 500 ms gaat er een `slow_bot`-metric uit (bot, ms, `planMs` in die beurt, `before`/`after` mode en behaviour, plan, errand, plus `brainSnapshot`: action en `describe`). Een tick vanaf 1 s geeft `slow_tick` met `slowestBotMs`: is dat veel kleiner dan `ms`, dan zit de tijd tussen de bots (taakcode zelf), niet in één bot.
- **Hint uit de logs:** Patrickbot 18 (herblore bij de GE, kwuarm potion + limpwurt) stond vlak voor 5 van de stiltes, ook die van 23 s. Niet bewezen.
- **Bijvangst:** `restorePvpBot` gebruikte `isHonest` zonder import (ReferenceError voor een PvP-bot zonder wapen). Import toegevoegd.
- **Validatie:** suite 157 pass, 14 fail (baseline); `bot-slow-entries.test.cjs` 2 pass; eslint no-undef schoon op de gewijzigde bestanden.

## 21-11-2026 15:10: lag na elke herstart, planningsbudget (branch `adventurers/plan-budget`)

- **Eigenaar:** "ik merk nog lag", met de serverconsole van 13:2x tot 13:57 UTC.
- **Waarneming:** na elke herstart duurt `BotBehaviorTask` om de paar ticks 2,2 tot 3,5 s, met uitschieters van 15, 19, 21 en 27 s (`tick_overrun`). Op een server die al lang draaide (begin van de console) bleef die taak onder de 170 ms. De `server`-metric in de botlogs meet alleen de planner (Adventurers): ~20 ms, dus die zag dit niet.
- **Oorzaak (waarschijnlijk, nog niet gemeten):** zoektochten over de kaart (A*, tot 120.000 tegels) als de caches leeg zijn. Het budget in `LongRoutes` (60 ms per 600 ms) begon een nieuw venster op wandklok-tijd: na een zoektocht van 2,5 s vond de volgende bot een vers venster en zocht ook. Zo stapelen ze in één tick. De trappenzoektocht in `Climbing` (per kandidaat-trap een zoektocht) had geen budget.
- **Fix:** één gedeeld budget in `LongRoutePlanner` (`canPlan`, `chargePlan`): een tegoed dat met 60 ms per tick bijvult; wat een zoektocht overschrijdt is schuld, en er start niets nieuws tot die is afbetaald. `LongRoutes` en `Climbing.findStairs` wachten erop (undefined: later opnieuw, niet gecachet); `LevelHops` telt mee maar wacht niet (de weg naar buiten is nu nodig). QuestPlay wacht een tick als de trap nog niet gezocht is, in plaats van een willekeurige weg omlaag te nemen.
- **Meting:** de `server`-metric heeft nu `planning`: per soort (`route`, `stairs`, `exit`) aantal, totaal en langste ms, en `owedMs`. Na de update: is `maxMs` ~2.500, dan zijn het de zoektochten; zo niet, dan zit de tijd elders in de brain.
- **Gevolg:** na een herstart plannen bots trager (lopen eerst recht op het doel af). Een losse zoektocht van 2,5 s blijft mogelijk; volgende stap is een tijdslimiet per zoektocht.
- **Validatie:** suite 155 pass, 14 fail (baseline); nieuwe `bot-plan-budget.test.cjs` (2 pass). `bot-climbing` zet het budget per zoektocht terug (draait hier niet zonder `dist`).

## 21-11-2026 14:55: Taverley-poort en candle (Markbot 18 "geen spade")

- **Vraag:** waarom kon Markbot 18 geen spade krijgen? Niet door een volle tas (`freeSlots` 25).
- **Oorzaak 1:** bij elk GE-bezoek zette hij spade en candle op de bank en daarna te koop (09:16, 11:04 UTC). De spade staat sinds #40 in `KEEP_TOOLS`; de candle nog niet. Nu wel: `CANDLE`, `LIT_CANDLE`.
- **Oorzaak 2:** om 11:20 liep hij vast bij Burthorpe (2876,3546) op weg naar de GE. Daarna was de GE "versperd" (`exchange_blocked`) en kon hij niets kopen: spade, candle, harpoon, rope.
- **Taverley-poort:** de `walk_blocked.door`-data (v 1c9f840) gaf bij 2936,3450 steeds `none_helps`, met als `target` een doel honderden tegels verder. De waypoint van de route ligt een tegel voorbij de poort; staat de bot op de poorttegel, dan verving `maybeOpenDoor` die door het verre doel. Binnen het venster van de route finder hielp de poort daar niet meetbaar. Fix: eerst het segment als maatstaf, het verre doel alleen als tweede. Test in `bot-brain.test.cjs` (draait hier niet zonder `dist`; los nagespeeld: oude code `none_helps`, nieuwe klikt).
- **Burthorpe 2876,3546:** zelfde patroon is niet bewezen (geen `door`-data, oude versie). Na de update kijken of het terugkomt.

## Sessie 21-11-2026 (14:45): talisman op de ruïnes, zaad op de patch (branch `adventurers/rc-ruins`)

- **Eigenaar:** "runecrafting bots lopen vast omdat ze de air talisman niet gebruiken met Use op de ruins."
- **Oorzaak (vermoedelijk):** `CraftRunes` gebruikte de talisman alleen via `walkToObject(..., { execute })`; bij de ruïnes (groot object) kwam die `execute` niet, dus geen item-op-object. De plugin (`handleTalismanOnRuins`) zelf klopt: RUINS_BY_ID kent het id en zijn transforms.
- **Fix:** naast de ruïnes (≤ 3 tegels van het object) of na 2 pogingen: `emitItemOnObject` meteen, met de echte objectlocatie. Hetzelfde in `FarmPatches.useOn` (≤ 4 tegels): wieden werkte (object-klik), zaaien niet (item-op-object).
- **Validatie:** suite 167 tests, 14 fails; eslint no-undef schoon. In de game te zien: "You hold the Air Talisman towards the mysterious ruins" en Runecrafting-XP; Farming-XP na het wieden.
- **Markbot 18 (screenshot, logs):** sinds 11:42 UTC twee uur in een lus naar de bank in Ardougne-zuid (`loop` bank, `trade.full` true, `goods` []). Bij elk bankbezoek nam hij "om te reizen" vijf soorten runes, tien soorten tablets, zijn sieraden en 9 sharks mee: tas vol, niets te verkopen, opnieuw naar de bank. Oorzaak: `travelKit` gaf `null` (alles meenemen) voor elke klus die geen verzamelklus is, en de rijke bots hebben door de teleport-aankopen veel soorten. Fix: elke klus een set (`travelKit`): 2 sieraden, de runes met Magic 25+, 1 tablet (2 zonder runes) van een soort die hij niet kan casten; `travelBeyondKit` zet de rest bij het bankbezoek eerst op de bank. Ook Patrickbot 14 (Ardougne-zuid) en Jorgbot 15 (Al Kharid) liepen in dezelfde lus.
- **Hunter:** met de vooraf-controle (`layable`) legden bots nooit (describe: `laid=- refused=0`); die vond op de stranden geen goede tegel. Nu telt alleen de echte weigering. Vier van de zes plekken gaven in twee uur 0 XP (crimson swift 2, 3; wagtail 2, 3): weggehaald; `HUNT_SITE_CAP` 3.
- **Overig in de logs (11:40-13:39 UTC):** 28 loops (alle bank, tas vol), 100 stuck (combat_training 22, agility Falador/Seers/Canifis/Gnome 29, silver stalls 8).

## Sessie 21-11-2026 (14:40): lag na 1c9f840 (branch `adventurers/lag`)

- **Eigenaar:** "hele erge laggs sinds de voorgaande update". Log: `BotBehaviorTask` 2-8 s per tick, elke ~10 ticks, en de ReferenceError bij elk GE-bezoek.
- **Waarschijnlijke oorzaak:** de fout in `arrive` (PR #43 al gefixt) gooide uit `Errands.tick`, dat in één lus over alle bots loopt: de rest van de errands van die tick viel weg en bots bleven opnieuw beginnen. Fix: `end()` vangt een fout in `arrive`/`fail` en logt hem, de lus gaat door.
- **Ook:** `reachableOnFoot` (uitgang uit een grot, tot 4 routezoektochten per wandeling) nu met cache (10 min per 8x8-vak en uitgangstegel) en 20.000 i.p.v. 40.000 tegels.
- **Niet gemeten:** hier draait geen server. Na de update: aantal `tick_overrun`-regels per minuut vergelijken; blijft het, dan meten met de perf-tools (server/docs/agents/perf.md).

## Sessie 21-11-2026 (14:35): fout "idOfName is not defined" (branch `adventurers/fix-idofname`)

- **Eigenaar (serverlog na update naar 1c9f840):** bij elk GE-bezoek van een bot met lange tochten `ReferenceError: idOfName is not defined` in `tabletLandings` (gebruikte een lokale helper van `bidForSupplies`). Daardoor brak `atExchange` af: geen aankopen of verkopen op de GE. Fix: `Shopping.idOf`; de landingsplekken één keer berekend.
- **Controle:** eslint `no-undef` op alle gewijzigde bestanden (vond precies deze fout op main, nu schoon). Voortaan na elke wijziging draaien: `npx eslint --no-eslintrc --env node,es2022 --parser-options=ecmaVersion:2022 --rule '{"no-undef":"error"}' <bestanden>`.
- **Inloggen lukt niet (eigenaar):** in het log geen fout bij inloggen; wel tick-overruns van 2-8 s door `BotBehaviorTask` vlak na de start (61 bots plannen tegelijk). Oorzaak nog niet vastgesteld.

## Sessie 21-11-2026 (14:10): snares, Taverley-poort, tablets voor lange tochten (branch `adventurers/hunter-poort`)

- **Eigenaar (screenshots):** Patrickbot 10 bij de wagtails zet geen snares neer (2 in de tas); Kram539 staat bij de poort van Taverley: "Kwam niet bij de Feldip Hills: de weg was versperd. Poort handelt hij niet meer ineens?"
- **Snares:** Patrickbot 10 stond 22,5 min op 2502,2890 voor 8 XP. `canLay` weigert een tegel met een object type 10 of 22 (gras, varens) of een geblokkeerde tegel; de bot zette `laidAt` ook bij een weigering en bleef. Nu: `layable` met dezelfde check vooraf (`core.MapObjects.getType`, `RegionManager.blocked`), een tegel waar de snare in de tas bleef telt als geweigerd, en naar de dichtstbijzijnde toegestane tegel (bij de vogel of op de plek).
- **Taverley-poort:** niet nieuw: walk_blocked op 2930-2940,3445-3455 sinds 20-11 in elke versie (37×, 9× in da94bfc). Nu vaker omdat Feldip-hunters vanaf Varrock via Taverley/White Wolf lopen (leg `white_wolf_south`, plan ok, 29 waypoints). De poort staat niet in de transports; de deuropener (`DoorOpening.maybeOpenDoor`) zou hem moeten openen. Oorzaak nog onbekend: `walk_blocked.door` (nieuw) zegt wat de opener deed (clicked, open, no_way_to_it, none_near, none_helps).
- **Tablets:** `Loadout.walkTablets` (puur, getest): van de laatste 12 lange tochten zonder teleport de tablet die er de meeste ≥ 150 tegels had bespaard (minstens 2), een stapel van 5 als hij er minder dan 2 heeft, vanaf 5.000 gp en hoogstens 10% van zijn coins. `walkTo` onthoudt `entry.longWalks` (van, naar); `bidForSupplies` voegt de stapel toe. Landingsplekken uit de spellbooks (`tabletLandings`).
- **Validatie:** `bot-walk-tablets` (2). Suite 167 tests, 14 fails. De snare-fix kan hier niet getest worden (Navigation laadt de TS-core).
- **Controle da94bfc (11:40-12:30 UTC):**
  - Construction: 3 huizen gekocht, 0 keer gebouwd: na de koop geen `savedTask`, dus een andere klus (Patrickbot 4 ging tuinieren). Fix: `savedTask` voor huis of coins.
  - Farming: 14 starts; wieden werkt (Jorgbot 2 Farming 1 → 8), daarna 3× `stuck` zonder zaaien. Oorzaak onbekend; `describe` toont nu de patches en hun opties.
  - Runecrafting: 3× `stuck` bij de ruïnes (2983,3291) met een volle tas essence en de talisman: de talisman op de ruïnes brengt hem niet naar binnen. `describe` toont nu de stap en het object-id.
  - Hunter: crimson swift 2 en 3 en wagtail 2: 0 XP (zie snare-fix). Red salamander 1×: Markbot 13 kwam niet bij Ourania (weg versperd bij 2894,3178).
  - Quest-teleport 5×.
  - Nieuwe acties (Construct, FarmPatches, CraftRunes, HuntBirds) hebben `describe` voor de stuck-metric.

## Sessie 21-11-2026 (12:35): eerste controle Fase 6-update (branch `adventurers/fase-6-fixes`)

- **Logs:** da32947 van 11:15 tot 11:34 UTC (20 min).
- **Farming:** 4× gestart, Patrickbot 7 kocht rake en dibber (Farming Supplies), spade en 6 potato seeds (GE), wiedde bij Falador (Farming 1 → 3), daarna `stuck`: het onkruid bleef in de tas (`useItem(..., "Drop")` doet niets, de Drop-optie is geen plugin-actie) en elke stap begon met "drop". Fix: `deleteNumber` zoals `DropItems`. 6× `tool_unbuyable`: bots met weinig coins.
- **Runecrafting:** 4 bots kochten de air talisman (~177 gp), daarna geen Runecrafting: na `shopFor` in `startBuyTraining` geen `savedTask`, dus een nieuwe keuze. Fix: `savedTask` voor de koop. Markbot 3: `exchange_blocked` (GE tijdelijk geblokkeerd voor hem).
- **Hunter:** verdeling werkt (crimson swift 8, wagtail 3 starts; `site_full` 5×). Red salamanders nog niet gezien: de bots met Hunter ≥ 59 die het kozen (Jorgbot 14, 18, 19, Markbot 18) hadden geen coins voor een rope (`tool_unbuyable`; Jorgbot 19 spaart "44 gp voor leather boots").
- **Construction:** nog niet gestart (1× `errands_resting` op weg naar de makelaar).
- **Teleports (`carried`, 71 lange boodschappen zonder teleport):** 29 (41%) hadden niets bij zich; de rest alleen sieraden die niet dichtbij landen (games necklace 13, ring of dueling 7, glory 4). Volgende stap: tablets voor de plekken waar ze vaak heen lopen.
- **Routes:** leg canifis vanaf Varrock-oost 0×. Gnome Stronghold: Nieve 1× aangekomen, 2× blocked; "Open Gate" 1× gebruikt.
- **Quest-teleport:** 1× "Neemt lumbridge teleport mee voor de quest".
- **Validatie:** test weeds in `bot-construct-farm`. Suite 165 tests, 14 fails.

## Sessie 21-11-2026 (12:45): Farming en Construction als klus; Sailing ontwerp (branch `adventurers/salamanders-rc`)

- **Eigenaar:** "bouw deze wel, zet de juiste stappen" (Construction, Farming, Sailing), na de salamanders en Runecrafting, in één update. Niet in de game getest (geen server hier): de stappen hieronder zijn wat in de logs te controleren is.
- **Farming** (`brain/actions/FarmPatches.PlayerBots.js`, mode `farming`):
  - Drie plekken in `bot-activities.json` (Falador, Catherby, Ardougne): de herb patch en twee allotments per plek, met id en tegel uit `skills/data/farming-data.json` (een patch is een varbit-object, de basisnaam zegt niets). Test vergelijkt ze.
  - Per patch: Rake (wied dropt hij), Harvest/Pick, Clear/Dig (dood), ziek (Cure) met de spade erop; dan planten met item-op-object: het beste zaad dat hij draagt (herb 1, allotment 3). Elke patch hoogstens twee keer proberen; klaar of volle tas: `success`.
  - `adventurers.json` `farming`: tools (rake, seed dibber, spade), zaden per level (herbs vanaf 9, allotments vanaf 1), `growMinutes` 80. `farmSpotDue` (de dichtstbijzijnde plek die nooit of ≥ 80 min geleden geplant is, in geheugen); `packFor` haalt tools en zaden uit de bank of koopt ze (winkel of GE).
  - Planner: optie `farming` als `farmDue`.
- **Construction** (`brain/actions/Construct.PlayerBots.js`, mode `construction`):
  - Plugin-events (regel 5, custom events): `construction:furniture-menu` (de open meubellijst: index, key, level, experience, ready) en `construction:choose-furniture` (de keuze met dezelfde checks als de klik) in `House.Construction.js`; `construction:buy-house` (1.000 gp, naast de makelaar, als "Yes please!") in `EstateAgent.Construction.js`.
  - Bot: geen huis → naar de dichtstbijzijnde makelaar (Varrock, Falador, Ardougne, Seers), kopen. Dan hammer, saw en planks (tot 18: 20 planks + 60 steel nails; vanaf 19: 24 oak planks) via `packFor`; naar het portaal in Rimmington (2953,3224), optie "Build mode". In huis: "Build" op een lege hotspot, de beste meubel die `ready` is (meeste XP), daarna "Remove" ("Really remove it?" Yes via `MultiChatboxPrompt`), alleen stukken die hij deze keer zelf bouwde; geen planks meer: door het exit-portaal ("Enter").
  - Planner: optie `construction` als hij een huis heeft of ≥ 11.000 gp (huis plus een lading).
- **Controleren in de logs:** "Koopt een huis in Rimmington", "Gaat bouwen in zijn huis", Construction-XP; "Gaat op de moestuin bij ... wieden", Farming-XP; `stuck` of `failed` bij `construction_house` / `farming_*`. Mogelijke valkuilen: huisobjecten niet in `MapObjects` met de private area; de portaaloptie heet anders dan "Build mode"; seed dibber nodig voor allotments én herbs.
- **Sailing (niet gebouwd, ontwerp in de roadmap):** de plugin is groot (boot, roer, zeilen, havenklussen, bergen). Trainen vraagt een eigen boot en varen met het roer; er is geen bot-besturing voor een boot. Stappen staan in ADVENTURER_ROADMAP Fase 6.
- **Validatie:** `bot-construct-farm` (4 tests met een nep-wereld). Suite 164 tests, 14 fails (omgeving).

## Sessie 21-11-2026 (12:15): red salamanders, Runecrafting-talisman (branch `adventurers/salamanders-rc`)

- **Eigenaar:** "eerst de red salamanders, daarna Rune Mysteries. Construction, Farming en Sailing pas als ze getest kunnen worden." Hier draait geen server (geen node_modules, geen cache), dus die drie wachten op een test in de game.
- **Red salamanders:** `HuntBirds` kent `trap: "net"`: small fishing net en rope in de tas, `Set-trap` op de dichtstbijzijnde "Young tree" binnen de site, `Check` op een "Net trap", net en rope van de grond terugpakken; volle tas: klaar. Box traps (chinchompa's) vragen Eagles' Peak (`boxTrapsUnlocked`), net traps niet. Twee plekken bij Ourania: [2451,3224] r6 en [2470,3242] r8 (spawns `npc-spawns.json`), Hunter 59, 272 XP. Te voet: `onFoot` true, BFS vanaf Ardougne 211-231 tegels. **Niet gecontroleerd:** of er "Young tree"-objecten binnen die radius staan (kaartobjecten niet in de repo); in de logs: "Gaat red salamanders vangen met een net trap bij Ourania" en daarna XP, anders `stuck`.
- **Hunter-start:** koopt de ontbrekende tools één voor één (snares 2, net en rope 1), noemt de plek.
- **Runecrafting:** Rune Mysteries staat in `grantedQuests` (stage op klaar, geen items), dus geen air talisman; `buyToTrain.RUNECRAFTING.ownTool` hield alle 24 nieuwe accounts op 1. Nu mag de talisman gekocht worden als hij op de GE staat (`tradeable` true); `Trade.KEEP_TOOLS` houdt hem. Geen quest-werk nodig.
- **Validatie:** `bot-hunter-sites` (3 tests). Suite 160 tests, 14 fails (omgeving).

## Sessie 21-11-2026 (12:00): Hunter-plekken, skills en teleportgebruik meten (branch `adventurers/hunter-plekken`)

- **Eigenaar:** quests zijn geen hoofdprioriteit; eerst skills (Fase 6) en teleportgebruik. "Bots staan op een kluitje in Feldip Hills voor hunter (snares)."
- **Hunter (logs 21-11, 07:50-10:44 UTC):** `hunter_crimson_swift` 426 min "time up" voor 1.388 XP, 25× stuck; tot 15 bots tegelijk (gemiddeld 7,6) op één plek (site 2604,2910, radius 7) met 3-6 vogels binnen bereik. Lokken (`Traps.Hunter.js eligible`) vraagt een vogel binnen 3 tegels die niet al gereserveerd is: weinig vogels, veel strikken.
  - **Bouw:** zes plekken in `bot-activities.json` (handwerk): crimson swift [2609,2926] r8, [2609,2896] r6, [2588,2884] r6 (level 1); tropical wagtail [2502,2890], [2513,2912], [2542,2885] r6 (level 19, 95,2 XP). Spawns uit `npc-spawns.json`; bereikbaar vanaf Yanille (BFS 229-267 tegels). Snares in `adventurer-gear.json`.
  - `Planner.activitiesFor` (alle activiteiten van een modus die het level toelaat, beste eerst) en `leastBusy` (beste tier met plaats, de leegste; null als alles vol is). `HUNT_SITE_CAP` 2. Vol: `cannot("site_full")`. Test `bot-hunter-sites`.
  - **Nog niet:** hogere Hunter (40-99, 27 bots) heeft alleen vogels; box traps (chinchompa's) vragen een nieuwe actie.
- **Skills (levels-metric, 60 bots):** Slayer traint wel (43× gekozen; levels 1-99 verspreid). Runecrafting: alle 24 nieuwe accounts op 1. `buyToTrain.RUNECRAFTING` vraagt Rune Mysteries (en de air talisman daaruit), en Rune Mysteries is in deze logs nooit geprobeerd (geen decision, geen quest_end). Ligt dus bij de quests; niet gebouwd.
- **Teleportgebruik:** boodschappen van 60 s of langer met teleport: 14-17% (ab19a51, 147ac3b, 784667c), 21-23% (c025568, 2f29401, 2cf602e). Lang zonder teleport, top: Feldip Hills (7), GE (6), Mazchna (4), Falador Rooftop (4). Nieuw veld `carried` in `errand` (bij ≥ 60 s zonder teleport): de reismiddelen in de tas. Daarmee is te zien of hij niets had of niets dat dichtbij landt.
- **Validatie:** suite 159 tests, 14 fails (omgeving).

## Sessie 21-11-2026 (11:40): PR #19 bijgewerkt; Morytania en Gnome Stronghold (branch `adventurers/morytania-leg`)

- **PR #19 (Fase 5):** main erin gemerged (conflicten: planner-opties `endgame` en `unlocks` samen, requires samen, handover beide). Ook de oudere remote merge van 20-11 meegenomen. Suite 158 tests, 14 fails (omgeving). Mergeable: clean. Nog niet mergen tot quests vaker afkomen.
- **Morytania:** `nextLeg` nam een hub binnen een `enterVia`-gebied als eerste leg vanaf buiten (Canifis op 243 tegels van Varrock-oost, over de Salve). Nu niet meer: zo'n hub alleen via links. Varrock-oost → Slayer Tower/Mazchna/Mort'ton: eerst Paterdomus.
- **Gnome Stronghold (1 van 14 aangekomen):** BFS zonder transports: geen weg door de grote poort (Shortest Path "Open Gate" 190, 2461,3382 ↔ 2461,3385, 3 tegels). De deuropener kent die poort niet.
  - `travel-hubs.json`: lockedArea "Gnome Stronghold" [2370,3386,2498,3518], `enterVia` gnome_agility (handwerk).
  - `nextLeg` ook naar buiten via de hubs (`leaving`): van binnen eerst een hub binnen, dan de poort.
  - `SHORTCUT_HOPS` neemt ook grote poorten (menu Open Gate/Door, verplaatsing ≥ 3 tegels, niet in de Wilderness).
  - `walkTo`-fail: staat hij bij zo'n poort of shortcut (`shortcutHop`), dan erdoor en verder (errand `ended: shortcut`).
- **Validatie:** tests in `bot-travel-hubs` (Morytania, Stronghold in en uit). Suite 157 tests, 14 fails.
- **In de logs:** errand `shortcut`, level_hop "Open Gate", Gnome Stronghold/Nieve `arrived`; walk_blocked met leg canifis vanaf x 3240-3290 hoort weg te zijn.

## Sessie 21-11-2026 (11:20): teleport mee naar quests (branch `adventurers/quest-teleport`)

- **Eigenaar:** de live Experience rate staat bewust hoger ("andere opbouw"); de XP per uur is dus geen bot-fout. Niet verder onderzoeken.
- **Bouw:** `startQuest` roept `packTeleport` aan: zonder reismiddel in de tas (sieraad of tablet, `travelItemIn`) en met een in de bank loopt hij eerst naar de dichtstbijzijnde bank en neemt één sieraad of `TABLET_STACK` tablets mee ("Neemt ... mee voor de quest, om terug te kunnen."). De quest wacht zolang de errand loopt (`errands.busy`).
- **Na een gestopte quest:** `endQuestRun` zet `entry.questEndedAt` (niet bij "done"); `unstrand` heeft dan 15 min (`QUEST_STRAND_MS`) genoeg aan één geblokkeerde wandeling in plaats van drie.
- **Validatie:** syntax en suite (154 tests, 14 fails omgeving). Geen unit-test: zit in de plugin-factory. In de logs: "mee voor de quest", stranded kort na quest_end.

## Sessie 21-11-2026 (11:15): Mole vechten, teleport houden, quest-spullen houden (branch `adventurers/teleports-houden`)

- **Controle 10:40 (2f29401, 08:48-09:28 UTC):** Mole-hol 2 bots, 4,5 en 2,5 min binnen, beide met een teleport uit de tas weg (touw nog niet gebruikt). Levels-metric: 60 regels. "20 x 20 x" weg. Strandingen na quests: Patrickbot 13 op het Misthalin-eiland (3 min), Jorgbot 14 in Corsair Cove (21 min, 20 pogingen, home teleport op cooldown sinds 08:39). Jorgbot 13 verkocht soft clay voor Prince Ali Rescue een minuut na het kopen.
- **Mole:** de bots vochten niet ("Kon bij boss giant mole niets doen"). Oorzaak: `TrainCombat` zoekt doelen binnen `SITE_RADIUS` 24 van het cluster (spawn 1759,5189); de Mole graaft naar vaste plekken tot 43 tegels daarvandaan (`GiantMole.plugin.js` BURROW_LOCATIONS). Nieuw: spec-veld `siteRadius` (minimum 24); `bot-activities.json` (handwerk) Giant Mole `siteRadius` 48. Test `bot-mole-site` leest de plekken uit de plugin.
- **Teleport houden:** `clearForProcessing` houdt één reismiddel (sieraad, anders tablet) in de tas; `loadShare` rekent een lading als (27 - 1) / materialen. Kruiden: 13 per soort (ongewijzigd), één materiaal: 26.
- **Quest-spullen:** `QuestPlay.fetching` zet `entry.questKeep` (id → tot, `QUEST_KEEP_MS` 6 u); `workingMaterials` neemt ze mee, dus niet storten of verkopen. Test in `bot-quest-play`. Faalnotitie gebruikt `countedName`.
- **XP-snelheid (niet opgelost, vraag aan eigenaar):** Jorgbot 13 kreeg 7.812 Herblore-XP voor 14 restore potions (62,5 XP per stuk in `herblore.json`, dus 875 verwacht): ongeveer 9×. Bots gebruiken de eigen skillcode (`Make` → `Mixing.Herblore`, 2 ticks per potion); `world.json` in de repo heeft `experienceMultiplier` 1 en geen league-relics. Vermoedelijk staat de live wereld op een hogere "Experience rate" (admin, `setExperienceRate`). Te controleren door de eigenaar.
- **Validatie:** suite 154 tests, 14 fails (omgeving).
- **Open:** wegkomen van quest-plekken zonder looproute (Corsair Cove, Misthalin-eiland) zonder home teleport; Morytania-legkeuze; touw-uitgang in de praktijk bevestigen.

## Sessie 21-11-2026 (09:35): controle logs, uitgang Mole-hol (branch `adventurers/molshol-uitgang`)

- **Logs:** push 08:32 UTC, versies 784667c (07:52-08:15) en c025568 (08:17-08:32). 61 bots.
- **walk_blocked (122 op de nieuwe versies):** `plan` none 75, ok 39, budget 4.
  - **Giant Mole-hol (y 5100-5250):** 4 bots (Markbot 14, Patrickbot 12, Jorgbot 15, Patrickbot 17) tot ~20 min vast na het gevecht. Oorzaak: alleen y >= 6400 telde als "onder de grond", dus `levelHop` en `climbOut` zochten het touw (Shortest Path: "Climb Rope" 1752,5137 → 2985,3316) nooit. Pas `unstrand` met de home teleport haalde ze eruit.
  - **Misthalin Mystery-eiland (1637,4802):** Markbot 13 en Jorgbot 14 strandden na een mislukte quest (stage 20, "object used, but the step did not advance"). Geen transport in de tabel (de roeiboot is quest-gebonden). De home teleport was al gebruikt voor de reis naar de boot (30 min cooldown); Markbot 13 kwam pas na 30 min vrij. Niet opgelost.
  - **Varrock East → Morytania:** leg `canifis`, plan none (Mazchna, Slayer Tower, Canifis, Mort'ton; 12×). De leg Canifis vanaf 3251-3268,3240-3430 terwijl Paterdomus ervoor moet; badHubs soms `mort_ton`. Nog uitzoeken in de legkeuze van `TravelHubs`.
  - **Gnome Stronghold:** plan none, straight, vanaf 2503,3524 en 2511,3548 (noordkant, Fishing Guild-weg) en Seers-zuid 2694,3426. Eén keer `budget`.
- **not_buyable "coins":** 0 op de nieuwe versies.
- **Dubbele uitrusting verkopen:** werkt (Patrickbot 16 masori, Patrickbot 15 ahrim's). Jorgbot 10 zette 6× binnen een minuut een blue wizard robe te koop, net na magic-gear uit de bank en daarna melee kopen.
- **Quests:** 1 klaar (Cook's Assistant). Misthalin Mystery 4× mislukt op stage 20, Restless Ghost 5×, Doric 3× `gather` (clay). "Gaat ... halen (nodig voor de quest)" komt voor. Veos weer niet gevonden.
- **boss_taken:** 0. Mole met 4 bots tegelijk (multi, toegestaan).
- **Eindspel:** Markbot 18 koos Barrows (3×) en Giant Mole ("eindspel: loot en upgrades"). Patrickbot 18 alleen buy_herblore (8.125 XP per ~19 s: ~1,5M XP/u, Fase 6). Jorgbot 19 zonder keuzes in dit venster.
- **Patrickbot 18** stortte games necklace, ring of dueling en skills necklace "voor herblore": teleport-sieraden gaan mee bij het storten.
- **Fix:** nieuwe pure module `behaviours/navigation/LevelHops.PlayerBots.js`: `offSurface(y)` (y >= 4160), `levelHopsFrom` (ook menu "Climb"), `chooseLevelHop` (naar buiten: elke uitgang binnen 200 tegels, eerst bereikbaarheid via `planRoute` met `exactOnly`, max 4 zoekopdrachten, tegels van één ladder samen overgeslagen). `Adventurers` gebruikt `offSurface` voor hops, `climbOut`, `afterHop` en `teleportsNear`. Offline (BFS op de collision map): touw 105 tegels van de landingsplek; de ladder van de Stronghold of Security is alleen bereikbaar via het touw. Ook `countedName` in `QuestPlay`.
- **Validatie:** nieuwe test `bot-level-hops` (5). Suite 152 tests, 14 fails (omgeving, zelfde basislijn).
- **Open:** Misthalin-eiland (roeiboot terug als uitgang), Morytania-legkeuze vanaf Varrock East, teleport-sieraden niet storten, verkooplus Jorgbot 10, PR #34 (levels-metric) is gemerged.

## Sessie 21-11-2026 (09:40): Fase 6 stap 1, skills meten (branch `adventurers/fase-6-meten`)

- **Eigenaar:** "waar komen alle skills en progressie terug?" Antwoord: niet als fase; voorgesteld en akkoord: Fase 6, skills compleet en efficiënt (roadmap). Eerste stap: meten.
- **Bouw:** metric `levels` (elk uur per bot: alle levels, totaal, combat; `SKILLS_METRIC_MS`). Bestaande aggregaat-metric heet `skills` (trained/untouched per 5 min), vandaar een eigen naam. Recept "Skills" in OBSERVABILITY.
- **Nulmeting (20-11, 17:05-22:25 UTC):** Slayer, Runecrafting, Farming, Construction, Sailing 57/57 vensters onaangeroerd; Hunter 56/57 met 8,2% van de tijd voor 1.700 XP (kapot); Ranged en Crafting 52/57. Verdacht hoge XP/uur (fletching ~1,0M, herblore ~1,4M, firemaking ~1,6M, agility tot >700k) bij `experienceMultiplier` 1: eerlijkheid nagaan.
- **Volgende (roadmap Fase 6):** Hunter repareren, Runecrafting/Slayer laten starten, XP-snelheden toetsen, Construction/Farming/Sailing, methodes per level.
- **Validatie:** suite 148 tests, 14 fails (omgeving). Geen gedragswijziging behalve de nieuwe metric.

## Sessie 21-11-2026 (10:15): Mole Hole multi-combat; volle tas bij de bank (branch `adventurers/occupancy`)

- **Eigenaar (screenshot 09:06):** 2 bots bij de Giant Mole, één staat erbij; "dit zie ik bij meer activiteiten". Wereld-hoppen/tweede wereld staat sinds 17-11 op de lijst; besproken: groot werk (één wereld, `GatewayTarget.WORLD_ID` = 1, gedeelde saves, wereldlijst, dubbele serverlast). Afgesproken: eerst de Mole-fix, dan een bezettingscontrole (bot kiest iets anders als een single-combat boss/plek bezet is). Tweede wereld later.
- **Mole Hole:** OSRS Wiki noemt "Mole Hole" bij de multicombat-gebieden; `world.json` had hem niet. Zone toegevoegd: [1728-1791, 5120-5247], z 0 (regio's 6992-6993; alle mol-spawns 1734-1783, 5152-5241; Lunar-droomwereld ernaast is z 2). `world.json` is handwerk (geen generator). Test in `bot-adventurers`.
- **Markbot 18 (screenshot 09:10):** op de GE met een tas vol mole skins: "Kon geen bank bereiken; laat het goedkoopste vallen: spade" (net gekocht voor de Mole). `clearBag` (na `trade()` die niets deed, vermoedelijk de lusbewaking op de GE) gebruikte `Trade.keepIds` (zonder boss-kit) en keek niet of hij al bij een bank stond. Nu: `keepAtExchange` (boss-kit, werkmaterialen) en binnen `AT_BANK_TILES` (12) van de GE of een bank eerst storten. Open: waarom de mole skins niet verkocht werden (logs).
- **Bezettingscontrole (bosses):** `precheck` sluit een boss uit met `boss_taken` (detail `by`) als een andere online avonturier er al mee bezig is (`phase` boss, of errand met `plan.kind` boss) en de boss niet in een multi-combat zone ligt (`bossInMulti`, uit `world.json`). Barrows uitgezonderd (eigen broers per speler). `startGroup` neemt alleen nog multi-combat bosses ("samen"). Nu: Barrows single (uitgezonderd), Giant Mole multi, Sarachnis single.
- **Nog niet:** bezetting van trainingsplekken (combat-clusters, volle mijn). `ActivityRegistry` heeft al capacity-slots per activiteit; meten in de logs voordat daar iets bij komt.
- **Validatie:** suite 147 tests, 16 fails (deze branch zonder PR #32: 14 omgeving + de 2 oude). Bezetting niet unit-getest (zit in de plugin-factory).
## Sessie 21-11-2026 (09:45): quest-spullen vooraf halen (branch `adventurers/next`)

- **Data (feedback-log tot 22:25 UTC):** top-oorzaak "talked, but the step did not advance" (9 van 44). Doric's Quest stage 10: dialoog "Certainly, I'll be right back!" steeds opnieuw (geen clay/ertsen). Romeo & Juliet stage 50 ("Bring the cadava berries to the Apothecary"): uitleg over de bessen, geen bessen. Geen "Gaat ... halen" of "Mist" in de log: de helper-stap gaf geen `needs`.
- **Fix:** `QuestHelperSteps` leest ook `overview.itemRequirements` (onvervuld, met ids) als `required(player)`. `QuestPlay.tick` haalt die eerst, één per 5 s, elk één keer (`run.reqTried`, max 8), vóór de aangeraden spullen; via `acquire` (bank, GE, zelf verzamelen). Niet te krijgen: geen stop.
- **Validatie:** nieuwe test in `bot-quest-play` (Doric: clay, dan copper ore). Suite 147 tests, 14 fails (omgeving).
- **In de logs:** "Gaat ... halen voor ... (nodig voor de quest)", quest_end voor Doric's Quest en Romeo & Juliet.

## Sessie 21-11-2026 (09:30): de vaste test-fails uitgezocht (branch `adventurers/next`)

- De "16 vaste fails" waren niet allemaal omgeving. Gerepareerd (verouderde tests, geen codewijziging):
  - `bot-accounts`: bij 61 Woodcutting krijgt een gegenereerd account een dragon axe (gear-lijst), de test verwachtte rune.
  - `bot-ironmen`: `adventurers.json` heeft geen `names` meer maar `clans`; de test telt nu via `Clans.namesOf`.
- Resterend 14, allemaal omgeving: 12 × `Cannot find module '../dist/Server'` (of `dist/...MobileList`, `src/.../PlayerRights`: server niet gebouwd), 1 × `bot-toll-gate` (ts-node: TS5011/TS5101 tsconfig), 1 × `bot-index-timer` telt 2. Draait wel na `yarn build` in de server.
- **Nieuwe basislijn:** 146 tests, 14 fails.

## Sessie 21-11-2026 (09:20): waarom lange wandelingen stilvallen (branch `adventurers/long-legs`)

- **Offline met de echte `LongRoutePlanner`** op de collision map van Shortest Path (`/tmp/route/plan.cjs`, niet in de repo; vlaggen: WALL_* uit de noord/oost-bits, LOC als een tegel nergens heen kan; geen deuren):
  - (3292,3438) → Paterdomus: plan 158 tegels; (3253,3422) → Paterdomus 213. In het spel staan bots juist op (3288-3292,3436-3438) stil met 216-223 tegels te gaan (26× walk_blocked, `doorAttempt` null).
  - Seers → fishing_guild_road 167; fishing_guild_road → Stronghold-poort 214; (2692,3426) → poort 292. Rechtstreeks naar Nieve/gnome-agility geen plan zonder het hek als deur.
- **Conclusie:** de planning lukt offline; in het spel komt de wandeling niet op gang. Kandidaten: planbudget (60 ms/tick, `undefined` → rechtdoor), `failedUntil` (5 min), of `nextLeg` null na `badHubs` → rechtdoor tegen een hek.
- **Bouw:** `LongRoutes.lastRouteOf(player)` (WeakMap): `from`, `goal`, `leg`, `plan` (ok/none/budget), `waypoints`, `badHubs`, `straight`. `walk_blocked` krijgt `route`.
- **Volgende:** na een run de `walk_blocked.route` bij Varrock East en Seers uitlezen en de echte oorzaak fixen.
- **Validatie:** suite 145 tests (deze branch), 16 vaste fails.
## Sessie 21-11-2026 (08:50): dubbele uitrusting uit de bank verkopen (branch `adventurers/sell-duplicate-gear`)

- **Eigenaar:** sommige bots (Patrickbot 16) hebben een veelvoud aan elite armour/wapens op de bank; daar kunnen ze upgrades van kopen.
- **Oorzaak:** `Trade.keepIds` zet elk gear-id dat beter is dan het gedragen stuk (per stijl-lijst) op de bewaarlijst; `withdrawToSell` slaat zo'n id helemaal over, met alle kopieën. Een melee-bot "draagt niets" in magic/ranged, dus al die stukken bleven. Patrickbot 16 spaart intussen voor een twisted bow (doel 1,54 miljard gp).
- **Fix:** `Trade.spareGear(player, core, id, inBank)` (puur, getest): voor gear-stukken (slots en stijl-lijsten, niet tools/supplies) blijft er één exemplaar over (gedragen, tas of bank), de rest gaat in `withdrawToSell` te koop.
- **Data:** de laatste push op `bot-logs` is van 20-11 22:25 UTC; de logs hebben geen bank-inhoud, dus het effect alleen zichtbaar aan "Zet te koop op de GE (ook uit de bank)" na de update.
- **Logs tot 20-11 22:25 UTC (ab19a51):** Markbot 18 pendelt nu bank-anvil (28× anvil, 35× Varrock West, 2× GE). Quests: 5 voltooid van 23 (Cook's Assistant 4×, Romeo & Juliet). Eerste boot werkt (Brimhaven→Ardougne `ok`). Morytania 24/24 vast. Veos 3× `no_veos`. Lange errands zonder teleport nog 83%; GE 91/109 zonder.
- **Raadsel `not_buyable` "coins":** Jorgbot 19 (2 miljard), Patrickbot 7 (56k, tinderbox 3×) en Markbot 8 (97k, hammer) geweigerd wegens coins; prijzen kloppen (spade 125, tinderbox 30). De refusal geeft nu `bag`, `bank`, `cost`, `amount`, `guide`, `registered`, `same` mee (verdenking: verouderd player-object na een relog).
- **Validatie:** suite 146 tests, 16 vaste fails. Niet ingame getest.
- **Open (van 20-11):** routes naar Morytania/Stronghold lopen vast in open terrein; onderzoek naar `LongRoutePlanner` (A* 4-richtingen, 120k expansies, box 640) en `DIRECT_TILES` 250 loopt nog.

## Sessie 20-11-2026 (22:55): eindspel voor maxed accounts; smithing-reeks via de bank (branch `adventurers/max-priorities`)

- **Eigenaar:** bij max accounts prio op gear-, tool- en andere upgrades en een grotere bank, via money making en bossing. En Markbot 18: loop GE ↔ anvils Varrock West; "beter meer rune bars kopen en bank-anvil-bank".
- **Data (logs tot 21:19 UTC):** 3 bots combat 126 met 2-4,4 miljard gp (Jorgbot 19, Markbot 18, Patrickbot 18). Tijd: thieving 31% (geld "eens proberen", 1-7k gp/u), wachten 19%, agility 16%, quests 15%, combat 7%; 5 boss-keuzes in ~4 uur.
- **Planner:** `isEndgame` (≥ `endgame.share` 0,8 van de levels op 99; `adventurers.json` "endgame"). Dan bossChance ≥ 0,6 (alleen als bossChance > 0, dus niet na een mislukte poging), moneyChance ≥ 0,6, money-boss 50%, geen "eens proberen", questChance ≤ 0,1. Reden "eindspel: loot en upgrades". Upgrades zelf: de bestaande `Goals` (volgende stuk in de gear-lijsten) en `bidForUpgrades`.
- **Smithing-loop:** `trade()` stuurde hem na elke lading naar de GE (platebodies ≥ `sellValue`, GE 47 tegels verder dan de bank ≤ `SELL_DETOUR_TILES`), waar hij ook de volgende bars pakte. Nu: midden in een reeks (`savedTask.afterTrip` en mode `buy_*`) de bank, GE alleen als die niet verder is. Verkoop later via `withdrawToSell`. `BUY_LOADS_MAX` 30 (was 10), nog steeds ≤ de helft van zijn coins.
- **Validatie:** suite 145 tests, 16 vaste fails; test voor eindspel in `bot-adventurers`. Niet ingame getest. In de logs: `decision` met reden "eindspel", errands van Markbot 18 naar Varrock West in plaats van de GE.

## Sessie 20-11-2026 (22:40): vaker teleports kopen (branch `adventurers/teleport-buying`)

- **Vraag eigenaar:** "vaker teleports kopen als het geld er voor is (zonder alles op te brassen), efficiëntie spreekt ook".
- **Data (logs tot 21:19 UTC):** 462 errands van ≥ 2 min, 385 zonder teleport (1.530 min). Top: de Grand Exchange (88).
- **Bouw:**
  - `Errands.bestTeleport`: ring of wealth (charged ids 1-5 en i1-i5) naar de GE (Rub 1) en Falador Park (Rub 3), bestemmingen uit `RING_OF_WEALTH_DESTINATIONS`, volgorde uit `RingOfWealth.plugin.js` ACTIONS; optie `wealthData` voor tests.
  - `Loadout.travelBuys` (puur, getest): één per soort uit `TRAVEL_JEWELLERY` (games, dueling, skills, glory, RoW), vanaf 50k coins (bag + bank), per stuk ≤ 2%, per bezoek ≤ 3%, nooit meer dan de bag-coins. In `bidForSupplies`, event `teleportBought`.
  - Bankbezoek: per soort één sieraad mee met elke lading (`jewelleryKind`); gathering houdt één reismiddel.
  - **Tablets (vraag eigenaar 22:23):** `bestTeleport` breekt elke tablet waarvan de itemnaam een spreuknaam is (`SpellTeleports.spellDestination`: standaard, Arceuus, Lunar), niet de Wilderness; `TRAVEL_TABLETS` (13 soorten, `castFrom` voor de standaard die het zelf cast) als stapels van 5 in `travelBuys` (prijs × aantal). Bank: extra tablets mee zolang > 10 vrije vakjes.
  - **Magic-gear (eigenaar 22:25, Markbot 10):** na een herstart draaide `trade()` vóór `resumeTask`; zonder plan gaf mijn `planStyle(entry) ?? "melee"` melee en trok hij rune platebody en berserker helm aan, terwijl de staf bleef autocasten. Nu `Trade.wornStyle` (stijl van het gedragen wapen) als terugval, ook in `wearUpgradesFromBank`. Open: waarom `TrainCombat.prepare` hem daarna niet terug in magic-gear zette (`castableSpell` false → honestStyle melee?); volgen in de logs.
- **Validatie:** suite 144 tests, 16 vaste fails. Niet ingame getest: de Rub-submenu-index van de ring of wealth. In de logs: `errand` met `teleport: "jewellery"` naar de GE, event `teleportBought`, aandeel lange errands zonder teleport (nu 83%).

## Sessie 20-11-2026 (22:30): audit van hubs en bestemmingen (branch `adventurers/hub-audit`)

- **Methode:** BFS/A* op de collision map van Shortest Path (zie roadmap), plain transports + Priest in Peril. Script stond in `/tmp/route` (niet in de repo); opnieuw maken: regio's `x_y` van 64×64, bit = ((z·64·64 + (y%64)·64 + x%64)·4 + flag), flag 0 = noord open, 1 = oost open.
- **Links:** 162/162 te lopen. Tree Gnome Village 2,2-2,7× (doolhof). `brimhaven_dock` los (eiland).
- **Opgelost:**
  - Karamja: geen looproute (Duradel en Musa Point golden als te voet; 21 walk_blocked naar Musa Point). Eerst als `onFoot: false` gebouwd; **eigenaar: "er loopt een perfecte boot voor 30 gp, kijk kritisch"**. Nu per boot: `boats` in travel-hubs.json (Tobias/Lorris/Thresnor Port Sarim→Musa Point, Customs officer terug, Barnaby Ardougne/Brimhaven/Rimmington; opties en fare uit transports.json en de plugins), Karamja `byBoat` met twee rechthoeken (`area` mag een lijst zijn). `onFoot`: eiland bereikbaar als een boot-kade te voet bereikbaar is. `walkTo`: `TravelHubs.boatFor` → naar de kade, `board` (NPC-optie via `core.operateNpc`), `afterHop` met `landing` en `radius: 10`, op een dek eerst `crossGangplank`; refusal `no_fare` zonder 30 gp in de tas; metric `boat` met `for`. Shilo Village als quest-slot vóór Karamja in de lijst.
  - **Les (tweede keer vanavond):** niet afsluiten wat een speler gewoon kan bereiken; eerst de route of het transport zoeken.
  - Morytania `enterVia: ["canifis","mort_ton"]`: `nextLeg` loopt vanaf buiten het gebied altijd via hubs en de laatste etappe begint bij een van die hubs; `onFoot` telt alleen die hubs. Hub `mort_ton` [3489,3290], link canifis-mort_ton 551 (BFS 399 × 1,38). Mort'ton-Barrows BFS 76, Canifis-Slayer Tower 88.
- **Open:** Feldip Hills/Corsair Cove vanaf Yanille geen route zonder quest-transport (logs: Feldip 16× aangekomen, misschien via teleport); Barbarian Assault 342 tegels vanaf gnome_agility.
- **Validatie:** 2 nieuwe tests in `bot-travel-hubs`. Suite 139 tests, 16 vaste fails. Niet ingame getest.

## Sessie 20-11-2026 (22:20): Morytania en Gnome Stronghold te voet; Slayer ring als voorkeur (branch `adventurers/slayer-travel`)

- **Observatie (eigenaar, 21:55):** Patrickbot 15 loopt van de GE naar Nieve (~730 tegels). Eigenaar: "er is map zat om door te lopen; teleport als voorkeur, geen zekerheid".
- **Correctie op PR #25:** Morytania `onFoot: false` verschoof Slayer-bots van Mazchna naar Nieve, en de Stronghold faalde ook (0/16, vast bij 2693,3426 met 219 tegels te gaan: een directe wandeling zonder hub-link). De echte oorzaak in beide gevallen: hubs zonder links (`canifis`, `gnome_stronghold_gate`, `gnome_agility`).
- **Fix:** links geteld met een BFS op de collision map van Shortest Path (methode in de roadmap, kalibratie 1,38 op 18 gemeten links): `paterdomus`-`canifis` 228 (via valluik 3405,3506 en de Holy barrier; zonder de 65-Agility-shortcut), `fishing_guild_road`-`gnome_stronghold_gate` 251, `gnome_stronghold_gate`-`gnome_agility` 81. Vlag `onFoot: false` weg bij Morytania; het mechanisme blijft in `TravelHubs.onFoot` (getest).
- **Slayer:** meester bereikbaar te voet of via `slayerRingTo`. Bij > 300 tegels (`SLAYER_RING_TILES`) of niet te voet: ring uit bank of GE (eens per 30 min proberen), anders lopen. Taakplekken via `lockedAway`.
- **Validatie:** suite 137 tests, 16 vaste fails; nieuwe test in `bot-travel-hubs` (Stronghold en Canifis verbonden). Niet ingame getest: of de walker de tempelgang (valluik, hekken 3444/3445, barrier) neemt, en of de ring gekozen wordt. In de logs: errands naar Mazchna/Nieve/Gnome Stronghold `arrived`; `teleport: "jewellery"` naar Nieve.

## Sessie 20-11-2026 (22:15): punten 1-8 van de eigenaar (branch `adventurers/roadmap-batch`, PR na deze sessie)

Eén branch, één commit per punt. Basis: logs tot 20:28 UTC (v 450f871) en de feedback-log sinds 17:00.

- **8 `::volg` "Bij:":** `describeLocation` kende geen agility-banen; vanaf Faladors richels (3013,3335) was giant_mole_hole het dichtst. Banen uit `agilityCourses` tellen nu mee (ook in `place.near` van metrics).
- **5+6 gear en stijl:** `Trade.bankUpgrades` (puur, getest) + `wearUpgradesFromBank` bij bank- en GE-bezoek (event `gearFromBank`). `trade()` draagt `planStyle(entry) ?? "melee"` in plaats van altijd melee.
- **3 Sourhog-grot:** niet gebouwd. Niet in Shortest Path (ook niet upstream 8bd3cc6); Blockage 40331 (y 9704, dialoog-Yes) en touw 40330 zijn quest-logica. Porcine blijft in `questHold` (PR #24).
- **4 Morytania:** `travel-hubs.json` lockedAreas Morytania `onFoot: false` (+ `onFootWhy`); `TravelHubs.onFoot` respecteert het. Data: 117 loopjes, 1 aangekomen, 201 min (vast bij tolpoort 3267,3228 en ten oosten van Varrock). Alleen per teleport tot de tempelroute met `plan_route` is gecheckt. `bot-slayer`-test aangepast.
- **7 transportplan:** gemeten en volgorde in de roadmap. Stap 3-5 niet gebouwd: vereisen een test op de server.
- **2 Fase 5:** `main` in `adventurers/fase-5` gemerged (PR #19 bijgewerkt, 135 tests, 16 vaste fails). Merge wacht op voltooide quests.
- **1 quests:** top-oorzaak met harde data: Cook's Assistant "object not found at 3166,3306 (ids 1782)" ×12. `QuestPlay.matchesIds` telt de vormen van een multi-loc mee (zoals `ObjectActionPacketListener`). Volgende in de feedback: Restless Ghost "object used, not advanced" ×10, Imp Catcher "step without a place" ×9, Knight's Sword ×8, X Marks the Spot "npc not found: Veos" ×6.
- **Validatie:** suite 133 tests (op deze branch), 16 vaste fails. Niets ingame getest.
## Sessie 20-11-2026 (21:45): quest-hold-lijst; correctie Eeshwar (branch `adventurers/quest-hold`)

- **Correctie op de sessie van 21:25:** Eeshwar zat **niet** vast. De push van 20:28 UTC toont hem om 20:14, 20:19 en 20:24 op de baan (3042,3363,3 / 3046,3360,3 / 3028,3354,3) met 21-28k agility-XP per 5 min, en level 58-60. Het screenshot was midden in een ronde. "Bij: giant mole hole" in `::volg` was misleidend (vanaf de baan hoort "falador park"); oorzaak niet gevonden, open punt. PR #22 blijft als preventieve fix: bij de controle letten op `on_roof`-weigeringen midden in agility.
- **Les:** eerst de volgende log-push afwachten, dan pas een oorzaak benoemen (workflow: Observe → Analyse).
- **Quest-hold (§28):** `adventurers.json` → `questHold.quests[]` met `name`, `since`, `reason`. `questAside` geeft `true` voor een gehouden quest (planner `available`), en `startQuest` weigert hem met `quest_on_hold` (opgeslagen taak na herstart, `afterRoof`) behalve bij `forced` (`::advquest`, sweep). Serverregel krijgt `questsHeld`.
- **Eerste: A Porcine of Interest.** 36 mislukte pogingen in de feedback-log; de automatische 3-uursblokkade ging steeds opnieuw in (laatste 20:21 UTC). Vrijgeven: Sourhog-grot (blokkades en touw) in transports.json, dan uit de lijst.
- **Validatie:** `tests/bot-quest-hold.test.cjs` (3 tests: vorm, Porcine erin, niet tegelijk granted). Suite 134 tests, 16 vaste fails.

## Sessie 20-11-2026 (21:35): `quest_end`-metric (branch `adventurers/quest-end`)

- **Waarom:** 152 quest-starts, 0 `quest_done` in 3 uur, en geen regel zei hoe ver elke poging kwam of hoe hij eindigde.
- **Wat:** nieuwe pure module `QuestEnd.PlayerBots.js` (`questEnd(run, outcome, extra)`), aangeroepen via `endQuestRun` in Adventurers op alle zes eindpunten: `done`, `failed` (met de reden en stage uit `describeFailure`), `gather` (item zelf verzamelen), `roof` (eerst de dakbaan af), `died`, `override` (`::advtrain`). `entry.questStarts` telt de poging per bot per quest (`attempt`). `quest_done` blijft bestaan.
- **Validatie:** `tests/bot-quest-end.test.cjs` (4 tests). Suite 131 tests, 16 vaste fails.
- **Volgende:** na een uur draaien het recept "Quests" in OBSERVABILITY: slagingskans per quest en de top van mislukte stappen. Daarna de data-gedreven quest-hold-lijst (A Porcine of Interest eerst) en de grootste reden aanpakken.
## Sessie 20-11-2026 (21:25): Eeshwar zweeft boven Falador (branch `adventurers/roof-drift`)

- **Observatie:** screenshot 21:19. `::volg` zegt "Bij: giant mole hole" (2984,3314), minimap zwart met daken: verdieping 3, ~40 tegels west van de baan, naast het White Knights-kasteel. Logs (tot 21:13) tonen nog XP tot level 57; de afdrijving viel erna.
- **Oorzaak 1:** `walkTo` weigerde een loopje vanaf het dak alleen met `entry.offRoof` (afdaal-modus). Midden in de agility-klus mocht een tussendoor-loopje (eten, bank) wel, en een pad op z=3 gaat door de lucht naast de daken.
- **Oorzaak 2:** de noodteleport in `getOffRoof` liep alleen zolang `roofCourse(at)` de bot herkende (15 tegels rond een obstakel). Eenmaal daarbuiten: geen vangnet behalve de 60-minuten-strandcheck.
- **Fix:** `walkTo` weigert `on_roof` ook als `roofCourse(fromHere)` (behalve reden `agility`). `getOffRoof` telt `roofSince` voor elke z>0: 3 min op een baan (`ROOF_STUCK_MS`), 5 min elders (`UPSTAIRS_STUCK_MS`), dan home teleport; metric `stranded` met `why: "upstairs"` voor het tweede geval.
- **Validatie:** suite 127 tests, 16 vaste fails (basislijn). Geen unittest voor deze plugin-paden. Na deploy controleren: `stranded` met `why` `roof`/`upstairs` en `walkTo`-weigeringen `on_roof` in de `decision`-metric.
- **Open:** welk loopje Eeshwar precies startte staat pas in de volgende `bot-logs`-push.

## Controle 20-11-2026 21:15: grote update (`450f871`)

Basis: `bot-logs` push 20:13 UTC. `450f871` 20:04 tot 20:13 (**9,4 min**). Weinig data: alleen
richting, geen conclusies over tijd of volume.

| Vraag | Uitkomst (9,4 min) |
| --- | --- |
| Reisspullen bij gathering | **1,7** vakjes (was 3,6), 15 regels; vrije vakjes 17,5. Logregels "één reismiddel mee" verschijnen (sieraad, Varrock-runes, geen). Tekst zegt soms "deze klus" (plan nog leeg): cosmetisch. |
| `buy_nothing` | 0 (eerder steeds `not-exchangeable`). Geen aansteek-regel gezien. |
| Markbot 3 | **Verkoopt nog clay** ("26 x clay … ook uit de bank") en mijnt verder voor Doric's Quest. Vermoedelijk overgang: zijn bewaarde klus komt van vóór de fix (zonder `gather`), dus na de herstart weet hij niet meer dat het quest-clay is. Opnieuw bekijken. |
| Teleport vóór shortcut | 2× "underwall" in het log; te weinig data om te zeggen of het minder is. |
| Veos / Wintertodt | 0 `boat`. Wintertodt 12× vooraf uitgesloten: 11× `place_unreachable` (X Marks the Spot niet gedaan), 1× `no_ship`. 0 starts. Scheepsdek dus nog niet te beoordelen. |
| Niet gestart | 9× `errands_resting`, 1× `place_unreachable`, 1× `tool_unbuyable`. |
| `loop` / `errandInstant` | 1 (Jorgbot 14, `bank`) / 84. |
| Daken | 0 `stuck` op Seers (2710, 3475, 3) en Falador (3050, 3366, 3) (was 24 en 23 in 2,6 uur). |

Zie ook de sessie van 21:15 (afgesloten gebieden, quests 0 van 152 voltooid).

---

## Sessie 20-11-2026 (21:15): afgesloten gebieden centraal in `walkTo`; quests voltooien niet

Branch: `adventurers/locked-areas` (vanaf `main` `450f871`).

### Gevonden

- 98 `walk_blocked` naar Morytania in 3 uur (Mazchna 38, Slayer Tower 29, Mort'ton 13, Canifis
  Rooftop 12, Canifis 6), 34 bots. Priest in Peril staat in `grantedQuests` (alle bots "voltooid",
  zonder spelen), maar `travel-hubs.json` heeft in Morytania alleen de hub `canifis` zonder één link:
  te voet onbereikbaar. Paden die dat niet checkten: de Slayer-meesterkeuze valt terug op álle
  meesters als geen bereikbaar is; de agility-baankeuze checkt quests, geen bereikbaarheid;
  combat-plekken.
- **Quests: 152 gestart, 0 `quest_done` in 3 uur** (17:05 tot 20:08 UTC). Feedback vandaag 267:
  "blocked for every adventurer for 3 h" 66, "too many tries" 50, "talked, but the step did not
  advance" 42, "object used, but the step did not advance" 25, "step without a place" 25, "object
  not found at 3166,3306,0 (ids 1782)" 20, "quest helper gave no step for a minute" 15, "npc not
  found: Veos" 7. Meest: Cook's Assistant 33, The Restless Ghost 24, The Knight's Sword 22, A Porcine
  of Interest 21, Imp Catcher 20.

### Aangepast

- `walkTo`: `lockedAway` weigert een plek in een `lockedArea` die niet `onFoot` is (quest/item en
  een hub die aan Lumbridge vastzit), tenzij een teleport die de bot draagt binnen 30 tegels landt
  (Barrows-tablet). Weigering `locked_area` → `decision.failure` `place_unreachable` (onthouden
  30 min). Eén check voor alle aanroepers.
- `CHANGELOG.md`.

Validatie: bot-tests 16 van 127 fout (zelfde 16). Alleen `node --check`. Niet in game getest.

### Open

- Morytania echt bereikbaar maken: hubs en links door Paterdomus (transportplan).
- `grantedQuests` verbergt echte eisen: een bot "heeft" Priest in Peril maar niet de toegang.
- **Quest-pijplijn**: geen enkele voltooiing. Voorstel aan de eigenaar: eerst een `quest_end`-metric
  (uitkomst per run: voltooid, opgegeven, reden, stap) en dan de top-redenen; Fase 5 (meer
  quest-keuzes) pas mergen als quests weer voltooien.

---

## Sessie 20-11-2026 (21:00): grote update (Fase 4b stap 2, `canExecute` v2, transport stap 1) en twee lussen

Branch: `adventurers/big-update` (vanaf `main` `5392a52`). Op verzoek van de eigenaar drie
roadmap-stappen in één update, als aparte commits met elk eigen logregels of metric, zodat de
effecten te scheiden blijven. Controle van 21:18 uitgezet op verzoek.

### Commits

1. `7711cca` **Loadout stap 2.** `Loadout.travelKit`: bij gathering één reismiddel (geladen
   sieraad, anders law/air/fire voor Varrock Teleport vanaf Magic 25, anders één soort tablet).
   Het bankbezoek dat reisspullen meeneemt en `bankOffLoadout` gebruiken dezelfde kit. Logregel
   "Neemt voor … één reismiddel mee". Bewijs: reisspullen 3,6 vakjes (controle 20:36).
2. `c327316` **`canExecute` v2.** `onExchange(itemId)` (de GE-regel: unnoted tradeable) vóór een
   GE-trip in `buyOnExchange`, `buyManyOnExchange` en `canExecute` (`not_buyable` /
   `not_exchangeable`). `LightSources` beantwoordt `light-sources:unlit-for`; `lightItem`
   (algemene `lightUp`) maakt een lichtbron uit de onverlichte versie + tinderbox, ook voor
   quests (`acquireForQuest`, `replan: false`). Bewijs: `buy_nothing` lit candle, ghostspeak
   amulet, combat bracelet.
3. `b0e44c1` **Quest-verzamellus (melding eigenaar "naar de GE, weg, terug").** Markbot 3 mijnde
   clay voor Doric's Quest, verkocht het (23×) bij de GE en mijnde opnieuw; na een herstart was
   het quest-doel weg. `workingMaterials` bevat `entry.gather`; de "genoeg verzameld"-check draait
   ook buiten `training` (niet tijdens een errand); `Tasks.taskRecord` bewaart `gather`.
   (Jorgbot 17 en Markbot 15 liepen ook vaak naar de GE: buy-to-train firemaking, 150-237k XP/u,
   geen lus.)
4. `f2c0d02` **Transport stap 1 + teleport vóór shortcut.** Errands: Kourend-bestemmingen van
   sieraden na een eerste bezoek (`visitedKourend`). `sailVeos` (Veos in Port Sarim, zijn optie,
   Ferries-plugin vaart; metric `boat`). `kourendWay` voor Wintertodt: boot, dan games necklace,
   dan de teleport. `canExecute` telt Kourend bereikbaar als Port Sarim te voet is **en X Marks the
   Spot gedaan is** (eigenaar; Wiki: X Marks is sinds 28-04-2021 vereist voor Client of Kourend en
   daarmee alle Kourend-quests; voor de boot zelf niet letterlijk bevestigd, de code noemt een
   Port Sarim-Veos "na X Marks"). Zonder: `kourendWay` → `quest_x_marks_the_spot`. En (melding
   eigenaar, screenshot): Patrickbot 17 liep met runes voor Falador Teleport via de underwall
   tunnel; `walkTo` koos de shortcut (`levelHop`) vóór een teleport. Nu `teleportsNear` eerst
   (niet voor plekken onder de grond).

### Check van de eigenaar (geen wijziging): wapens en vechtstijlen

- `Trade.wearBest` kiest alleen uit de tas; `fillEmptySlots(fromBank)` alleen lege slots. Een
  beter wapen of schild in de bank komt nooit in plaats van wat hij draagt (Torva + rune sq +
  dragon scimitar). Op de roadmap gezet.
- Ranged en magic bestaan als klus en voor de Barrows; geen keuze naar zwakte. Op de roadmap.

### Validatie

Bot-tests 16 van 127 fout (zelfde 16); nieuw: `travelKit`, `gather` in de task-record,
Kourend-teleport alleen na bezoek. Niet testbaar hier: `LightSources` en `RunCourse` (core).
**Niets in game getest.**

### Risico's

1. Veos zet de bot af op het scheepsdek (z 1, Ferries `to: [1824, 3695, 1]`). Als hij daar niet
   vanaf komt: `unstrand` na drie blokkades. In game kijken.
2. Binnen Kourend zijn geen hubs: lopen naar ver weg kan stranden. Wintertodt gaat via de
   necklace-teleport (Wintertodt Camp ligt ~33 tegels van het doel).
3. Een bot die eerst naar Kourend vaart voor Wintertodt maar geen necklace kan kopen, gebruikt
   een poging; `canExecute` onthoudt het daarna 30 min.
4. Varrock Teleport als enige rune-kit bij gathering: een bot die ver van Varrock werkt teleporteert
   minder handig dan met de volle set.

### Na de update meten

`boat`-metric, "Vaart met Veos", Wintertodt-starts en `blocked` wintertodt; "Neemt … één
reismiddel mee" en reisvakjes bij gathering (was 3,6); `buy_nothing` (verwacht 0 met
`not-exchangeable`); "Steekt een candle aan … (voor <quest>)"; Markbot 3 terug naar Doric's
Quest; teleports richting Falador Park.

---

## Sessie 20-11-2026 (20:50): klikken op een dak (oorzaak Seers en Falador)

Branch: `adventurers/roof-click` (vanaf `main` `3e0f7a6`).

De eigenaar loopt als speler wel van de landing naar het volgende obstakel. In
`brain/actions/RunCourse.PlayerBots.js` klikt de bot alleen meteen binnen 5 tegels; verder weg
eerst `walkToObject`, die op een dakrand nooit "aankomt" (het commentaar noemde dat al voor Al
Kharid en Varrock, en bij een herstart op het dak al voor Seers' 8 tegels). Seers landt ~8
tegels, Falador ~6 tegels van de volgende gap.

Aangepast: `CLICK_TILES` (5) en `ROOF_CLICK_TILES` (10). Op een verdieping boven 0 klikt hij het
obstakel op dezelfde verdieping binnen 10 tegels meteen aan; de baan loopt het laatste stuk zelf.

Validatie: bot-tests zoals eerder. Geen unit-test (RunCourse laadt Navigation en daarmee de core).
**Niet in game getest.** Bevestigen: `::volg` op een bot op Seers of Falador; in de logs geen
`stuck` meer op (2710, 3475, 3) en (3050, 3366, 3), en `job` met `ended` anders dan `stuck`.

Risico: een obstakel op hetzelfde dak dat binnen 10 tegels ligt maar niet het volgende is, wordt
niet aangeklikt (alleen het volgende obstakel uit de lap wordt gezocht).

---

## Sessie 20-11-2026 (20:45): Patrickbot 17 vast op Seers' rooftop

Branch: `adventurers/roof-course-trouble` (vanaf `main` `5e887a4`).

### Gevonden (melding eigenaar met screenshot, bevestigd in `bot-logs` 19:36 UTC)

Patrickbot 17 op (2710, 3475, 3), Seers' rooftop, `runCourse seers obstacle=5`. Die tegel is de
landing van obstakel 4 (GAP_28, wall scramble naar `pos.y - 5`, z 3); obstakel 5 (GAP_29) begint op
(2702, 3470, 3). De loop over het dak daartussen lukt niet. Waarschijnlijk collision op z 3 daar;
**niet onderzocht** (geen cache hier). Dezelfde plek stond al in de eerste handover (1.718
`stuck` in oudere versies). Na de herstart koos hij een groepsklus (Sarachnis) maar kwam niet van
het dak (249 `stuck` in 10 min); `getOffRoof` teleporteerde hem na 3 min terecht naar huis, maar
zijn `savedTask` (agility seers) stuurde hem direct terug.

### Aangepast

- `Adventurers.PlayerBots.js`: `troubledCourses` (gedeeld, 60 min) gezet bij de home teleport
  van een dak; de baan wordt overgeslagen bij de keuze van een course; een bewaarde agility-klus
  vervalt. `stranded`-metric krijgt `course`.
- `CHANGELOG.md`.

Validatie: bot-tests 16 van 124 fout (zelfde 16). Alleen `node --check`. **Niet in game getest.**

Ook in deze PR (fix 1 uit de controle van 20:36): `bossKit` neemt `via.lightFrom` (CANDLE) en
TINDERBOX mee, zodat een gekochte candle niet meer verkocht wordt.

### Andere daken (zelfde check, `bot-logs` 17:05 tot 19:41 UTC)

70 agility-`stuck`. Op een dak: Seers (2710, 3475, 3) obstakel 5 (24, 3 bots, 7 `stranded`),
Falador (3050, 3366, 3) obstakel 5 (23, 2 bots, 10 `stranded`; obstakel 4 GAP_15 route
(3048, 3358, 3) springt 3 noord, obstakel 5 GAP_16 route (3045, 3361, 3)), Varrock-dak
(3193, 3398, 3) (4 bots met een andere baan als klus). Niet op een dak: Gnome (11 jobs `stuck`
onderweg) en Canifis (10, onderweg naar Morytania): navigatie.

### Open

**De eigenaar loopt als speler wel** van de landing naar het volgende obstakel (Seers, Falador).
De fout zit dus in de bot: hoe `runCourse` (brain, agility-behaviour) na een obstakel naar de
`route`-tegel van het volgende loopt op een dak (z 3). Daar beginnen: de beweging tussen
obstakels op een verdieping, niet de collision of de baan-data.

---

## Controle 20-11-2026 20:36: loadout, candle, tunnel (`f4c67e7` + `eef0e4d`)

Basis: `bot-logs` push 19:36 UTC. `f4c67e7` 6,5 min + `eef0e4d` 19,1 min (**~26 min samen**, 60
avonturiers). Tijdsbesteding voorlopig (`new` 8,1%, twee herstarts).

| Vraag | Uitkomst (~26 min) | Was |
| --- | --- | --- |
| Vrije vakjes tijdens gathering (52 regels) | **18,2** | 15,6 |
| Eten in de tas bij gathering | **0,9** vakjes | 3,7 |
| Overig | **0,5** | 1,7 |
| Reisspullen | 3,6 | 2,8 (nu de grootste post) |
| `loadoutBanked` | 31 | |
| Eten-beslissingen | 21× "Neemt geen eten mee: veilige plek …"; geen gevaarlijke plek gezien | |
| Deaths / `fledLowHp` | 0 / 4 (niet bij gathering) | |
| Markbot 18 | Om ~19:26 UTC uit de tunnel, traint weer. Jorgbot 18 zat in dezelfde tunnel (3158, 9713): `stranded` om 19:20. Fix werkt. | 2 uur vast |
| Bevroren (nieuw recept) | 0 | |
| `loop` | 0 | |
| Keuzes niet gestart | 26 van 136 (19%); 17 `errands_resting` (10 min rust na een mislukte boodschap), 6 `tool_unbuyable` | 13% |

**Giant Mole, nieuwe bug:** Jorgbot 14 kocht een candle op de GE en zette hem bij het volgende
GE-bezoek weer te koop. `bossKit` bevat `via.tool` en `via.light` (LIT_CANDLE), maar niet
`via.lightFrom` (CANDLE) en de tinderbox, dus `trade()` ziet de candle als handelswaar.
Voorgestelde fix: `bossKit` neemt `via.lightFrom` en TINDERBOX mee als de light `lightFrom` heeft.
**Niet gedaan.** Daarnaast 24 keer `blocked` voor de Mole op `tool_unbuyable` (spade en/of candle),
waarschijnlijk geld of `noExchangeBuyUntil`; 3 Mole-starts wel.

**`errands_resting` is nu de grootste oorzaak van niet-gestarte keuzes** (17 van 26): na een
mislukte boodschap 10 min geen nieuwe, en de planner kiest intussen klussen die een boodschap
nodig hebben. **Gedaan 20:40:** `Requirements.remember` onthoudt een `errand_refused` met
`errands_resting` tot `noErrandUntil` (niet 30 min); `canExecute` sluit die klus zolang uit. Test
in `bot-requirements.test.cjs`.

---

## Sessie 20-11-2026 (20:15): Markbot 18 vast in een tunnel; transportplan

Branch: `adventurers/unstrand-window` (vanaf `main` `f4c67e7`).

### Gevonden (melding eigenaar, bevestigd in `bot-logs` 19:08 UTC)

Markbot 18 stond sinds minstens 17:08 UTC (twee uur) onder de grond rond (3156, 9715, 0), 0 XP,
fase `waiting`, 4 vrije vakjes. Elke ~16 min een `walk_blocked` met `reason: bank` naar
"Edgeville" (3096, 9867, 0): de ladder van de Edgeville dungeon (`levelHop` kiest de trap die in
een rechte lijn het dichtst bij ligt, ook in een andere tunnel). Daarna 15 min `blockedPlaces`, 60 s
wachten per keer, opnieuw.

Waarom niets ingreep:
- `unstrand` telde alleen blokkades binnen 15 min; ze kwamen om de 16 min.
- De lusbewaking telt gestarte boodschappen; deze werd steeds geweigerd (`place_blocked`).
- Het recept "bevroren" eiste dezelfde tegel; hij schoof een paar tegels.

### Aangepast

- `Adventurers.PlayerBots.js`: `unstrand` telt blokkades van ongeveer dezelfde plek binnen
  `STRANDED_WINDOW_MS` (60 min) en alleen sinds de laatste XP. Dan home teleport, zoals voorheen.
- `docs/OBSERVABILITY.md`: recept "bevroren" telt 0 XP binnen 15 tegels.
- `docs/ADVENTURER_ROADMAP.md`: transportplan (één logica voor alle plekken via `TravelHubs`;
  Veos, sieraden na "Zeah bezocht", memoirs, talisman, fairy rings, en trappen per tunnel).
- `CHANGELOG.md`.

Validatie: alleen `node --check` (Adventurers laadt hier niet). **Niet in game getest.**

### Risico's en open

1. De echte oorzaak (een trap in een andere tunnel) is niet opgelost; alleen het vastzitten.
   Staat als stap 5 in het transportplan.
2. Een bot die echt verder komt zonder XP (lang lopen) kan na drie blokkades in een uur naar huis.
3. Het nieuwe recept "bevroren" vond ook Jorgbot 5: tot ~18:40 UTC 30+ min `walking` naar
   clay_rocks rond (3391-3414, 3155-3175) bij Al Kharid, 10× `toll_gate`. Daarna weer actief
   (quests). Navigatie, niet urgent; mee in Fase 2.

---

## Controle 20-11-2026 20:01: `canExecute` v1 (`2ba23ea`)

Basis: `bot-logs` push 19:01 UTC. `2ba23ea` 18:46 tot 19:01 (**14,5 min**, 60 avonturiers).
Tijdsbesteding voorlopig (net na een herstart: `new` 7,8%).

| Vraag | Uitkomst (14,5 min) | Was (`696c6cd`, 24 min) |
| --- | --- | --- |
| Keuzes niet gestart | 7 van 55 (**13%**) | 39% |
| Reden `unknown` | **0** | 54% van de mislukte |
| Overgebleven redenen | `errand_refused` 4 (allemaal `errands_resting`: 10 min rust na een mislukte boodschap), `tool_unbuyable` 3 (hunter 2, slayer 1) | |
| Vooraf uitgesloten (`blocked`) | Wintertodt 29 (`place_unreachable`), fishing 6, Giant Mole 6, woodcutting 1, mining 1, hunter 1 (alle `tool_unbuyable`) | |
| Uitgesloten per beslissing | gem. 1,3, max 5 (35 van 48 beslissingen) | |
| Tick-duur `server` | gem. 22,8 ms, max 242 | gem. 28,9 ms, max 178 |
| `loop` / `errandInstant` | 0 / 196 | 1 / 401 (24 min) |
| Tijd | errand 35,7%, working 17,7%, idle 10,4% | errand 30,4%, working 14,8%, idle 12,1% |

Conclusies:
- `canExecute` v1 doet wat het moet: 3× minder mislukte keuzes, geen `unknown` meer. Wintertodt
  wordt bij bijna elke bot met Firemaking 50+ uitgesloten (Kourend, per boot): klopt.
- Giant Mole uitgesloten op `tool_unbuyable`: waarschijnlijk de lichtbron (`via.light`), niet de
  spade. Past bij de eerdere `buy_nothing` voor een lit candle (niet verhandelbaar).
- Niet te veel uitgesloten: gemiddeld 1,3 opties per beslissing.
- Geen merkbare extra rekentijd.
- `hunter` faalde nog 2× op gereedschap ondanks de check: de check vooraf en de echte aankoop
  verschillen nog. Het geheugen houdt hem daarna 30 min buiten.

PR #13 (loadout, Fase 4b) staat klaar om te mergen.

**Giant Mole, aanvulling eigenaar:** een lit candle is niet op de GE, maar een gewone candle wel
(en in winkels); aansteken met een tinderbox. Gebouwd in dezelfde PR: `via.lightFrom: "CANDLE"`
in `adventurers.json`; `lightUp` in `enterBoss` haalt candle en tinderbox (bank, winkel of GE) en
gebruikt de tinderbox op de candle via `world.emitItemOnItem` (de game's `LightSources.plugin.js`,
Firemaking 1). `canExecute` telt candle + tinderbox als verkrijgbare lichtbron. Niet in game
getest; bevestigen aan `boss`-regels "Steekt een candle aan" en geen `blocked` meer voor
`boss:boss_giant_mole` op `tool_unbuyable`.

---

## Sessie 20-11-2026 (19:55): Fase 4b stap 1, loadout bij gathering

Branch: `adventurers/loadout` (vanaf `main` `f167bd3`). **Niet gemerged vóór de controle van
20:01**, zodat `canExecute` v1 en deze wijziging in aparte versies te meten zijn.

### Bewijs

Op verzoek van de eigenaar ("bij gathering zit de halve inventory nog vol"). Metrics 20-11-2026,
278 `bot`-regels tijdens woodcutting, mining en fishing: ~10 van 28 vakjes buiten de klus
(eten 3,7, reis 2,8, overig 1,7, munten 0,9, gereedschap 0,8); 160 van 206 klussen eindigden
op "full bag".

### Wat aangepast is

- Nieuw: `server/plugins/bots/adventurers/Loadout.PlayerBots.js`. `offLoadout(items, { mode,
  kindOf })`: alleen voor gathering; `keep` blijft, `food` tot 2 stuks, de rest naar de bank.
- Eten per plek (aangepast na vraag van de eigenaar: "niet altijd logisch, bank om de hoek, safe
  zone voor je combat level"): `Loadout.foodFor({ danger, bankTiles, combat })` geeft 0 / 2 / 5
  met een reden. `placeDanger(player, place)` in Adventurers: Wilderness (`Errands.inWilderness`),
  een agressieve NPC binnen `getAggressionRange(1) + 2` tegels van de plek waarvoor
  `npc.isAggressiveTo(player)` geldt (de game's eigen regel: combat ≤ 2 × NPC-level), of een cel
  (8×8, met buren) uit `hurtAt` (vlucht of dood, gedeeld door alle avonturiers, 2 uur).
  `bankTilesFrom(place)`: rechte afstand tot de dichtstbijzijnde bank op dezelfde verdieping.
  Plek = `stateOf(player).home` als de klus de huidige is; onbekend → 2 (oude standaard), zonder
  logregel. Activiteitenregel bij elke verandering: "Neemt geen eten mee: veilige plek voor combat
  45, bank op 12 tegels." `getTravelFood` haalt geen eten voor gathering op een veilige plek
  (anders haalde hij het op en zette de volgende bank het terug).
- `brain/Errands.PlayerBots.js`: `inWilderness` geëxporteerd.
- `Adventurers.PlayerBots.js`: `bankOffLoadout(entry, banker, plan)` met `kindOf`: gereedschap van
  de klus (`toolsFor` met de activiteit), munten, `Trade.isSupply` (runes, tablets, sieraden,
  munitie), niet-verhandelbaar (quest-items), `workingMaterials`, `bossKit` = `keep`; `isFood` =
  `food`; de rest weg. Aangeroepen op de drie bankmomenten die er al zijn: het bankpad van
  `trade()`, `atExchange` en het leeghalen van de tas in `startTraining`. Event `loadoutBanked`.
- `server/tests/bot-loadout.test.cjs`: 2 tests.
- `docs/OBSERVABILITY.md` (event, recept), `docs/ADVENTURER_ROADMAP.md`, `CHANGELOG.md`.

Validatie: bot-tests 16 van 122 fout (zelfde 16); de 2 nieuwe slagen. Adventurers-deel alleen
`node --check`. **Niet in game getest.**

### Risico's

1. Quest-items die verhandelbaar zijn (bucket, pot) gaan de bank in; `acquireForQuest` haalt ze
   terug, wat een extra banktrip kost als een quest ze nodig heeft.
2. Gevaar wordt gezien aan de NPC's die er nú staan en aan recente vluchten of doden; een
   monster dat net respawnt kan gemist worden. `fledLowHp` geldt alleen voor gevaarlijke klussen,
   dus gewond raken bij gathering wordt pas onthouden bij een dood. Te zien aan `death` bij
   gathering.
3. Reisspullen niet aangepakt (2,8 vakjes).

### Volgende stap

Na de controle van 20:01 mergen en deployen. Dan meten met het recept "Tas bij gathering": vrije
vakjes (was ~15,6 midden in een klus) en ladingen per banktrip.

---

## Sessie 20-11-2026 (19:45): Fase 4 stap 2, `canExecute` v1

Branch: `adventurers/can-execute-v1` (vanaf `main` `696c6cd`, met `docs/controle-1933`).

### Wat aangepast is

- Nieuw: `server/plugins/bots/adventurers/Requirements.PlayerBots.js` (Knowledge-laag, zonder core).
  `canExecute(option, ctx)`: eerst een onthouden mislukking, dan gereedschap (`any`: één van,
  `all`: allemaal; bezit of verkrijgbaar), dan de plek als die vooraf bekend is. `remember` /
  `recall`: een mislukking met een eis-reden (`REQUIREMENT_REASONS`) houdt die optie 30 min buiten.
- `Adventurers.PlayerBots.js`:
  - `precheck(entry, view, exclude, bosses)` vóór `chooseNext`, met `ctx` uit dezelfde checks als
    de start: `Shopping.ownsAnywhere`, `nearestShop` binnen `shopRadius` en betaalbaar, GE-prijs en
    munten (zoals `buyOnExchange`), `TravelHubs.onFoot` met `questDone` en items, `blockedPlace`.
    Plek alleen gecheckt voor Wintertodt en een boss-ingang (`boss.via.at`); een boss zonder
    ingang zoekt zelf zijn weg (ondergronds), daar beslist de start.
  - `walkTo` zet `entry.refusal` bij elke weigering (`busy`, `errands_resting`, `place_blocked`,
    `loop_blocked`, `on_roof`, `no_brain`); `buyOnExchange` bij `not_buyable`. De `decision`-
    `failure` gebruikt die als er geen `cannot` was.
  - Na een mislukte poging: `Requirements.remember(entry.cannot, plan, failure)`.
  - `decision.blocked` (poging 0): wat vooraf is uitgesloten en waarom.
- `server/tests/bot-requirements.test.cjs`: 3 tests.
- `docs/OBSERVABILITY.md`, `docs/ARCHITECTURE.md` (Knowledge-laag), `docs/ADVENTURER_ROADMAP.md`,
  `CHANGELOG.md`.

Validatie: bot-tests 16 van 120 fout (zelfde 16); de 3 nieuwe slagen. Adventurers-deel alleen
`node --check`. **Niet in game getest.**

### Risico's

1. Vooraf "verkrijgbaar" en de echte aankoop kunnen verschillen (de start koopt het beste
   gereedschap dat past, de check accepteert elk). Dan faalt de start en onthoudt het geheugen het.
2. Een uitgesloten modus blijft 30 min uit, ook als het geld er intussen wel is.
3. `reachableActivity` en `nearestShop` draaien nu bij elke beslissing voor elke modus: iets meer
   rekenwerk per beslissing. Zichtbaar in de `server`-metric (tick-duur).
4. `cannot` (Map) wordt niet opgeslagen: na een herstart is het geheugen leeg.

### Volgende stap

Na deploy en ~30 min: aandeel niet gestart (was 39%), `blocked` per reden, resterende `unknown`,
en tick-duur in de `server`-metric.

---

## Controle 20-11-2026 19:33: waarom klussen niet starten (`696c6cd`)

Basis: `bot-logs` push 18:31 UTC. `696c6cd` 18:06 tot 18:30 (**24 min**, 60 avonturiers).

| Vraag | Uitkomst (24 min) |
| --- | --- |
| Keuzes die niet startten | 76 van 197 (39%). |
| Reden bekend | 35 (46%): `tool_unbuyable` 26, `place_unreachable` 8, `too_poor` 1. |
| Reden `unknown` | 41 (54%): `combat_magic` 13, `slayer` 7, `buy_*` 15, `mining` 3, overig 3. Paden die nog stil falen (vooral een `walkTo` of `shopFor` die `false` geeft). |
| Gekozen terwijl uitgesloten | 0 (exclude-fix werkt). |
| `loop` | 1 (Jorgbot 17, `exchange`). |
| Volume | metrics ~3.700/u, activiteit ~7.200/u. |
| Tijd | errand 30,4%, walking 26,6%, working 14,8%, idle 12,1%. |

`tool_unbuyable`: bird snare 13× (hunter; Markbot 8, Markbot 9, Eeshwar, Bekoek), harpoon 6×
(Jorgbot 19, `slayer` en `combat_training`), fly fishing rod, lobster pot, axe, pickaxe
(Eeshwar, weinig geld).

`place_unreachable` (alle `z: 0`): Giant Mole (1752, 5237) 6×. Die ligt onder Falador en gaat via
de molshoop met een spade (`boss.via`); `enterBoss` gaf `null`. Wintertodt (1630, 3974) 2×: Kourend,
per boot, niet te voet. Geen gevallen met een hogere verdieping gezien.

**Conclusie:** de planner kiest steeds opnieuw klussen waarvan hij al kon weten dat ze niet gaan
(dezelfde bot meerdere keren hunter zonder snare). Voorstel voor `canExecute` v1 staat in het
verslag aan de eigenaar; nog niets gebouwd.

---

## Sessie 20-11-2026 (19:05): Fase 4 stap 1, waarom een klus niet start

Branch: `adventurers/can-execute` (vanaf `main` `f7a284a`).

### Waarom eerst dit

Controle 18:56: 21% van de keuzes startte niet, zonder reden in de metrics. Een `canExecute` die
de juiste eisen checkt, moet weten welke eisen ontbreken. Eerst meten (§5, §34).

### Wat aangepast is

- `Adventurers.PlayerBots.js`: `cannot(entry, why, detail)` zet `entry.startFailure` en geeft
  `false`. Alle 20 stille `return false` in `startTraining`, `startBuyTraining`, `startBoss`,
  `startQuest` en `startSlayer` zeggen nu waarom; een `shopFor` dat faalt voor gereedschap ook.
  `decisionMetric` schrijft `failure` (of `{ why: "unknown" }` als nog geen reden gezet is).
- Jachtplek: verdieping uit de data (`site[2]`) in plaats van altijd 0. De huidige data heeft geen
  z, dus nu geen verschil.
- `docs/OBSERVABILITY.md` (redenen, recept), `docs/ADVENTURER_ROADMAP.md`, `CHANGELOG.md`.

### Locatie en verdieping (vraag van de eigenaar)

Wat al plane-aware is en straks in `canExecute` hergebruikt wordt:
- `TravelHubs.onFoot`: alleen bereikbaar via een knooppunt op dezelfde z; gebieden achter een
  quest of item (`lockedAreas`, op x en y).
- `blockedPlaces`: sleutel `x,y,z`.
- Errand-runner: aankomst alleen op dezelfde verdieping, een verdieping telt als 20 tegels
  voortgang; `levelHop` neemt trap of ladder naar ondergrondse plekken.
Gat: een plek op een hogere verdieping zonder eigen knooppunt telt voor `onFoot` als onbereikbaar,
ook als er een trap is. Dat wordt zichtbaar als `place_unreachable` met `z > 0`.

Validatie: bot-tests 16 van 117 fout (zelfde 16). Alleen `node --check` voor dit deel. **Niet in
game getest.**

### Volgende stap

Na deploy en ~30 min: `waarom niet` uit het recept. De grootste eis eerst in één `canExecute` vóór
de keuze (planner sluit die optie uit), met plek en verdieping via de functies hierboven.

---

## Controle 20-11-2026 18:56: `ce581ab` (`::volg`-status, `decision`, rommelige tas)

Basis: `bot-logs` push 17:51 UTC. `ce581ab` 17:37 tot 17:51 (**14 min**, 60 avonturiers). Kort:
tijdsbesteding en bevroren bots zijn voorlopig.

| Vraag | Uitkomst (14 min) |
| --- | --- |
| `decision`-volume | 57 regels, ~240 per uur (geschat was 800 à 1.000). Geen probleem. |
| Metrics / activiteit | ~3.250 / ~6.800 per uur. Metrics-log dekt ~6 uur. |
| `loop` | 0. Jorgbot 4 en Patrickbot 1 niet meer in een lus (rommelige-tas-fix werkt). |
| `errandInstant` | 201 (~840 per uur; was ~1.280). Hoogste Patrickbot 14: 52. |
| Tijd (voorlopig) | errand 31,5%, walking 25,1%, working 17,5%, idle 9,6%, new 6,8% (herstart). |
| `buy_nothing` | 0. |

**Nulmeting Fase 5 (waar keuzes voor dienen),** 45 gestarte keuzes:
- `quest` 13 (29%), `quest_gap` 6 (13%), `weighted` met "doel: …" 2 (4%): samen **~47% dient
  een unlock of doel**.
- `weighted` voor "achterstand" (15) of "afwisseling" (8): **~51% is balanceren**, geen doel.
- Bij `weighted` kreeg de gekozen optie mediaan 12% kans; maar 8 van 25 keer de zwaarste.

**Bewijs Fase 4 (`CanExecute`):** 12 van 57 keuzes (21%) konden niet starten. `combat_training`
het vaakst (4), daarna `hunter` (2), `buy_fletching`, `woodcutting`, `combat_ranged`,
`buy_smithing`, `buy_cooking`, `slayer` (elk 1). De planner kiest dus regelmatig iets waarvan de
eisen niet vooraf gecheckt zijn; waarom het niet startte staat nog niet in de metric.

**Kleine planner-bug gevonden:** de `quest_gap`-weg kijkt niet naar `exclude`. Eeshwar kreeg in
één beslissing twee keer `combat_training` voor Witch's House (combat 35), ook nadat die bij
poging 1 al was uitgesloten. Kost een poging, geen lus. **Gefixt 19:00:** `chooseNext` slaat de
combat-gap over als `exclude` `combat_training` bevat (test in `bot-adventurers.test.cjs`).

---

## Sessie 20-11-2026 (18:50): Fase 3 deel 2, `decision`-metric

Branch: `adventurers/decision-metric` (vanaf `main` `3d92588`).

### Wat aangepast is

- `server/plugins/bots/adventurers/Planner.PlayerBots.js`: `chooseNext` krijgt een optionele
  `explain`-callback. Op elke uitweg (`boss`, `quest`, `fallback`, `money_boss`, `money`,
  `quest_gap`, `weighted`) krijgt die `{ path, choice, ... }`: bij `weighted` de kans van de keuze en
  de beste 3 met gewicht en kans, bij `money` de beste 3 met gp/uur en of die gemeten is, bij
  `quest_gap` de quest en wat ontbreekt. Het plan zelf is ongewijzigd; een fout in `explain` wordt
  genegeerd.
- `server/plugins/bots/adventurers/Adventurers.PlayerBots.js`: `decisionMetric` schrijft per
  poging (max 4 per beslissing) een `decision`-regel, ook als de klus niet startte (`started`,
  `excluded`).
- `server/tests/bot-adventurers.test.cjs`: test dat de uitleg klopt en het plan niet verandert.
- `docs/OBSERVABILITY.md` (soort en recept), `docs/ADVENTURER_ROADMAP.md`, `CHANGELOG.md`.

Validatie: bot-tests 16 van 116 fout (zelfde 16); de nieuwe test slaagt. Adventurers-deel alleen
`node --check`. **Niet in game getest.**

### Risico's

1. Volume: ongeveer één regel per gestarte klus plus de mislukte pogingen. Schatting 800 à 1.000
   per uur extra in het metrics-log (was ~3.150 per uur): dekking van ~6 naar ~5 uur. Na deploy
   meten.
2. `path: "weighted"` met lage `chance` is normaal (gewogen loting), geen fout.

### Volgende stap

Na deploy: recept "Keuzes" draaien. Interessant voor Fase 4 en 5: hoe vaak `started: false` en
welke modi (eisen die ontbreken: `CanExecute`, §7), en hoe vaak `quest_gap` tegenover `weighted`
(hoeveel keuzes al een doel dienen, §10).

---

## Sessie 20-11-2026 (18:40): Fase 3 deel 1, `::volg` toont doel en reden

Branch: `adventurers/volg-status` (vanaf `main` `301f1ce`).

### Wat aangepast is

- `server/plugins/bots/adventurers/Adventurers.PlayerBots.js`: `status(event)` vult
  `event.status` met `goal`, `activity` (modus en activiteit, quest of boss), `reason`
  (`plan.reason`), `skill`, `phase`, `route` (`errand.to` met de reden in woorden, `ERRAND_WHY`),
  `place`, `wealth` (`wealthOf().total`) en `xpPerHour` (sinds de laatste metrics-ronde, na
  minstens 1 min). Geregistreerd als custom event `adventurers:status`. Niets nieuws berekend.
- `server/plugins/bots/runtime/Watch.PlayerBots.js`: vraagt elke 3 s (in de bestaande ronde van
  de quests) `adventurers:status`. `statusLines` (zuiver, getest) geeft regels: `Doel / Bezig /
  Reden` en `Onderweg naar …` alleen bij verandering, XP/uur, vermogen en plek hooguit elke 2 min.
  Bij de start alles. Watch importeert Adventurers niet (lagen gescheiden, §6).
- `server/tests/bot-watch.test.cjs`: test voor `statusLines`.
- `docs/OBSERVABILITY.md`, `docs/ADVENTURER_ROADMAP.md`, `CHANGELOG.md`.

Validatie: bot-tests 16 van 115 fout (zelfde 16); de nieuwe test slaagt. Adventurers-deel alleen
`node --check`. **Niet in game getest.** In game controleren: `::volg <avonturier>`, en kijken of
de regels kloppen en de chat niet volloopt.

### Risico's

1. Een bot die vaak van errand wisselt geeft veel `Onderweg`-regels. Als dat stoort: route alleen
   na een paar seconden tonen.
2. `xpPerHour` is van de lopende 5-minutenronde: vlak na een ronde nog onbekend.
3. `activity` voor sommige modi kan onhandig ogen (`combat training (cows)`). Puur weergave.

### Volgende stap

Fase 3 deel 2: `decision`-metric bij elke planner-keuze (gekozen optie, reden, top 3 met gewicht),
in `chooseNext` / de decide-stap. Eerst lezen hoe `Planner.PlayerBots.js` de opties weegt.

---

## Controle 20-11-2026 18:26: lusbewaking (`1fe6907`)

Basis: `bot-logs` push 17:26 UTC. `1fe6907` 17:07 tot 17:26 (**19 min**, 60 avonturiers).

| Vraag | Uitkomst (19 min) |
| --- | --- |
| `loop`-regels | 5, alle in de eerste 13 min, alle echt (8 keer in 8 tot 37 s). Geen vals alarm gezien. |
| Na de blokkade | Jorgbot 4 traint thieving (6.150 XP/u), Patrickbot 1 magic (29.657 XP/u). |
| `errandInstant` | 405 in 19 min (was 1.386 in 24,5 min). Hoogste Patrickbot 14: 88. |
| Tijd | errand 28,2% (was 32,6%), walking 26,6%, working 17,8%, idle 11,2%. |
| Bevroren (15 min stil) | 0. |
| Volume | metrics ~3.150/u, activiteit ~7.550/u. |

**Oorzaak GE-lus Jorgbot 4 en Patrickbot 1 (uit de `loop`-metric):** `trade = { cluttered: true,
worth: 0, goods: [], waiting: false, fund: false }`, bewaarde klus `buy_crafting`, GE leeg (8 vrije
slots). De tas telt als "rommelig": 6 of meer vakjes met spullen zonder handelswaarde
(`goodsToSell(..., { worthless: true })`). `trade()` kiest de GE omdat die dichtbij is, maar
`atExchange` zet alleen `bag.keep` op de bank en verkoopt alleen spullen met waarde. De waardeloze
voorraad blijft, de tas blijft rommelig, opnieuw. Het bankpad van `trade()` zet die voorraad wel weg.
Voorgestelde fix (één regel): `atExchange` zet ook de waardeloze voorraad op de bank, zoals het
bankpad (`Trade.goodsToSell(player, core, keepHere, { isFood, worthless: true })` met
`workingMaterials` en `bossKit` erbij). **Gedaan 18:35** (branch `docs/controle-1826`): alleen
spullen zonder prijs, zodat spullen met waarde nog verkocht worden. Risico: een niet-verhandelbaar
quest-item in de tas gaat bij de GE ook de bank in, zoals bij elke andere bank al gebeurde.

Andere lussen (geblokkeerd, oorzaak niet uitgezocht):
- Jorgbot 14: `bank` Al Kharid, `fund: true`, 2 vrije vakjes, bewaarde klus `combat_training`.
  Mogelijk de volle-tas-banktrip tegen de klus-uitrusting die nu in de tas blijft (PR #3).
- Jorgbot 10: `exchange` en `withdraw` om en om bij de GE, `full: true`, bewaarde klus `hunter`.

Fase 2b: werkt zoals bedoeld. Lussen zonder boodschap vallen er nog buiten.

---

## Sessie 20-11-2026 (18:00): algemene lusbewaking (Fase 2b)

Branch: `adventurers/loop-guard` (op `docs/controle-1730`, vanaf `main` `5c40d0c`).

### Waarom

Drie lussen na elkaar (bank, GE-koop, klus-uitrusting), elk pas zichtbaar na de vorige fix, elk
lokaal opgelost. In `e59bc71` nog twee (Jorgbot 4, Patrickbot 1) zonder enige logregel. Afgesproken
met de eigenaar: eerst een algemene bewaking, dan Fase 3.

### Wat aangepast is

- Nieuw: `server/plugins/bots/adventurers/Loops.PlayerBots.js`. Zuivere module zonder core:
  `record()` per gestarte boodschap, `blocked()` ervoor. Lus = dezelfde reden en plek 8 keer
  (`LOOP_REPEATS`) binnen 5 min (`LOOP_WINDOW_MS`) na de laatste XP. Dan 15 min
  (`LOOP_BLOCK_MS`) geweigerd. `quest` en `grave` vallen erbuiten (eigen limieten).
- `Adventurers.PlayerBots.js`:
  - `walkTo` weigert een geblokkeerde boodschap (`false`, wat alle aanroepers al afhandelen) en
    roept na de start `noteLoop` aan.
  - `noteLoop`: activiteitenregel, event `loop`, metric `loop` met de laatste 10 boodschappen,
    fase, plan, bewaarde klus, doel, GE-stand en `trade` (waarom `trade()` ging).
  - `trade()` bewaart `entry.lastTrade` (`waiting`, `fund`, `worth`, `full`, `cluttered`, `goods`).
- `server/tests/bot-loops.test.cjs`: 3 tests (lus gemeld en geblokkeerd, XP ertussen is geen lus,
  verspreid of quest is geen lus).
- `docs/OBSERVABILITY.md`, `docs/RUNTIME_POLICY.md`, `docs/ADVENTURER_ROADMAP.md`, `CHANGELOG.md`.

Validatie: bot-tests 16 van 114 fout (zelfde 16), de 3 nieuwe slagen. `Adventurers.PlayerBots.js`
alleen `node --check`. **Niet in game getest.**

### Risico's

1. Een echte klus zonder XP die 8 keer in 5 min dezelfde boodschap nodig heeft, wordt 15 min
   tegengehouden. Geen voorbeeld bekend; zichtbaar als `loop`-metric.
2. Een geblokkeerde volle-tas-banktrip valt terug op 60 s wachten (bestaand pad).
3. Lussen zonder boodschap (een klus die direct opnieuw start) ziet deze bewaking niet.

### Volgende stap

Na deploy: `loop`-regels per bot en reden; `trade` in de regels van Jorgbot 4 en Patrickbot 1 moet
de oorzaak van hun GE-lus tonen. Fix die als het één regel is, anders door naar Fase 3.

---

## Controle 20-11-2026 17:30: eerste data van `e59bc71`

Basis: `bot-logs` push 16:26 UTC. `e59bc71` 16:01 tot 16:26 (**24,5 min**, 60 avonturiers).

| Vraag | Uitkomst (24,5 min) |
| --- | --- |
| Banklus klus-uitrusting weg? | **Ja.** `errandInstant`: Markbot 10 6 (was 669), Jorgbot 9 2 (643), Markbot 6 2 (572), Patrickbot 18 0. |
| Activiteitenlog | 2.718 regels, ~6.650 per uur (was ~11.500). Dekt ~3 uur. |
| Metrics | 1.329 regels, ~3.250 per uur. Dekt ~6 uur. |
| `buy_nothing` | 4, alle `not-exchangeable`: lit candle (2), ghostspeak amulet (2). |
| Bevroren (20 min stil) | 0. |
| Tijd | errand 32,6% (was 35,1%), walking 24,1%, working 18,1% (was 16,9%), idle 11,1%, quest 8,6%. |
| 0 XP de hele periode | 11 van 60. Niet allemaal lussen (quests, nieuwe accounts); niet verder uitgezocht. |

**Nog in een lus:**
- **Jorgbot 4**: 554 × `errandInstant` + 64 errands `exchange` naar de GE, **geen enkele
  activiteitenregel**, 0 XP. Doel "1.155 gp voor amulet of defence" terwijl hij 16.887 gp heeft.
  `trade()` kiest de GE, `atExchange` doet niets zichtbaars, opnieuw. Mogelijke redenen: een
  afgerond bod dat niet op te halen is (`waiting`), of goederen die niet te koop gezet worden.
  Niet uit de logs te halen.
- **Patrickbot 1** (nieuw): 434 × `errandInstant`, ook `exchange` bij de GE; kocht wel een adamant
  scimitar.

Dit zijn precies de gevallen voor Fase 2b (algemene lusbewaking, zie roadmap): de bewaking moet de
reeks en de reden van de keuze in een metric zetten, zodat zo'n lus zichzelf uitlegt.

---

## Sessie 20-11-2026 (17:00): uitrusting heen en weer naar de bank

Branch: `adventurers/kit-bank-loop` (op `docs/controle-1650`, vanaf `main` `ad1c718`).

### Oorzaak (in code bevestigd)

1. `startTraining` voor `combat_ranged` / `combat_magic`: geen boog en pijlen of runes bij zich, dus
   naar de dichtstbijzijnde bank (bij de GE is dat de GE) en ze ophalen; de klus wordt `savedTask`.
2. De volgende beslissing begint met `trade()`. Die telt boog, pijlen en runes als goederen
   (meer dan `keepValue` 200 gp), want `workingMaterials` beschermde alleen buy-to-train-materialen.
   Dus naar de GE (`exchange`).
3. `atExchange` zet `bag.keep` op de bank (alleen de boss-kit was uitgezonderd).
4. `resumeTask` → `startTraining` → stap 1.

Bij Patrickbot 18 hetzelfde met de Barrows-magic-set: `bossKit` bevatte alleen potions, spade
en tablets.

### Wat aangepast is

`server/plugins/bots/adventurers/Adventurers.PlayerBots.js`:
- `workingMaterials`: ook de spullen (`styleSupplyIds`) van de vechtstijl van `resume`, `plan` of
  `savedTask` als die ranged of magic is. Werkt daardoor in `trade()`, het bankpad en
  `keepAtExchange`.
- `bossKit`: bij de Barrows ook de magic-set en runes.
- `atExchange` en `bankUnusedSupplies` laten `workingMaterials` en `bossKit` in de tas.
- `CHANGELOG.md`: regel onder "Opgelost".

Validatie: bot-tests 16 van 111 fout (zelfde 16). Alleen `node --check` voor deze code (laadt hier
niet). **Niet in game getest.** Barrows-set gecontroleerd: kodai wand en ancestral staan in
`styles.magic` van `plugins/bots/data/adventurer-gear.json`.

### Risico's

1. Een oude `savedTask` met ranged of magic houdt pijlen of runes in de tas tijdens een andere klus
   (een paar vakjes). Bewust: liever dat dan de lus.
2. Jorgbot 4 (710 × `errandInstant`) had geen activiteitenregels. Zijn lus kan een andere oorzaak
   hebben (`exchange` zonder iets te doen, doel "1.155 gp voor amulet of defence", 19 vrije vakjes).
   Na deploy controleren.
3. `errandInstant` zegt niet welke boodschap. Overweeg de reden mee te tellen als de lus terugkomt.

### Volgende stap

Na deploy: `errandInstant` per bot (verwacht: Markbot 10, Jorgbot 9, Markbot 6, Patrickbot 18 laag)
en activiteitenlog-regels per uur (was ~11.500). Daarna Jorgbot 4.

---

## Controle 20-11-2026 16:50: eerste data van `ad1c718`

Basis: `bot-logs` push 15:50 UTC. `ad1c718` 15:21 tot 15:50 (**29 min**, 60 avonturiers).
Het metrics-log begint nu bij 14:29 UTC: de overstroming van `84ecd13` (18.192 regels in 50 min)
heeft alles van `7a8e40b` en `e210ce9` uit `bot-logs` geduwd.

| Vraag | Uitkomst (29 min) |
| --- | --- |
| Waarom mislukte het kopen? | 6 × `buy_nothing`, alle 6 `not-exchangeable`, met 8 vrije GE-slots. **Vermoeden "slots vol" klopt niet.** Items: lit candle (4 bots), ghostspeak amulet, combat bracelet. De bots probeerden dingen op de GE te kopen die daar niet verhandelbaar zijn. `buyOnExchange` kijkt alleen of er een guide-prijs is. De afkoeltijd werkt: 6 keer in 29 min, niet honderden. |
| Metric-volume | 1.808 regels in 29 min, ~3.700 per uur (was ~22.000 per uur in `84ecd13`). Metrics-log dekt ~5 uur. |
| Activiteitenlog | 5.661 regels in 29 min, ~11.500 per uur: dekt **minder dan 2 uur**. Ruim de helft komt van de banklus hieronder. |
| Fase 1 (bevroren bots) | 0 bots 25 min of langer stil. 1 × `bank_nothing`. |
| Tijdsbesteding | errand 35,1% (was 57,6%), working 16,9%, walking 23,3%, idle 12,7%. |
| "Binnen 15 tegels" bij banken | 8 van 268 bank-errands (3%), gemiddeld 67 s tegenover 16 s bij echt aankomen. Samen ~9 min. **Geen grote kostenpost**; de hypothese uit de vorige sessie vervalt. |

**Nieuwe grootste lus: uitrusting heen en weer naar de bank.** `errandInstant` per bot in 29 min:
Jorgbot 4 (710), Markbot 10 (669), Jorgbot 9 (643), Markbot 6 (572). Allemaal 0 XP, fase
`errand` bij de GE. Hun log, honderden keren om en om:
- Markbot 10 (439 ×): "Bewaart op de bank: yew shortbow, shortbow, rune arrow…" en "Haalt zijn boog
  en pijlen van de bank om te boogschieten."
- Jorgbot 9 (429 ×) en Markbot 6 (398 ×): "Bewaart op de bank: amulet of power, air rune, mind
  rune, staff of fire…" en "Haalt zijn runes van de bank om te toveren."
- Patrickbot 18 (106 ×): Barrows-magic-set naar de bank en weer terug, bij Ardougne Zuid.

Vermoedelijke oorzaak (nog niet in code bevestigd): `trade()` ziet de spullen van de klus waar de
bot mee bezig is (boog en pijlen, runes en staff, Barrows-set) als goederen en zet ze op de bank;
de klus haalt ze er meteen weer uit. `workingMaterials(entry)` beschermt materialen maar
waarschijnlijk niet de wapens en munitie van een combat-klus. Mogelijk speelt de één-van-elk-regel
van Fase 1 mee (meerdere bogen). De oude pingpong-bots (Patrickbot 17, Jorgbot 10, Patrickbot 8)
doen nu weer gewoon iets.

Kleinere bevinding: quest- en uitrustingsaankopen proberen niet-verhandelbare items (lit candle)
op de GE. Afgevangen door de afkoeltijd, maar het quest-item wordt zo niet gehaald.

Aanbevolen volgende stap: de banklus voor klus-uitrusting. Begin in `trade()` en `keepIds` /
`workingMaterials` met Markbot 10 (ranged) als voorbeeld.

---

## Sessie 20-11-2026 (16:00): stille kooplus bij de GE

Branch: `adventurers/ge-buy-loop` (vanaf `main` `84ecd13`).

### Wat onderzocht is

`bot-logs` push 14:51 UTC. Versies: `e210ce9` 14:18 tot 14:25 (7 min), `84ecd13` 14:26 tot
14:51 (25 min, 60 avonturiers).

### Wat gevonden is

- **Fase 1 (banklus):** 2 bots 20 min of langer stil op dezelfde tegel (Jorgbot 17, Jorgbot 8),
  was 15 bots 30 min of langer. 3 regels `bank_nothing`. Voorlopig goed, maar op 25 min data.
- **De errand-metric overstroomde het log:** 5.148 errand-regels in 25 min (~12.000 per uur).
  97% waren errands van 1 à 2 s die "aankwamen" waar de bot al stond. Het metrics-log
  (20.000 regels) dekte daardoor nog maar ongeveer 1,5 uur.
- Oorzaak: twee **stille lussen bij de GE**, beide onzichtbaar vóór deze metric:
  - **Kooplus** (3 bots: Patrickbot 14, Jorgbot 16, Jorgbot 18; 1.379 errands): `upgrade()` in
    de beslisstap stuurt de bot naar de GE (`buy_materials`), het bod wordt niet geplaatst,
    er komt geen logregel, het verlanglijstje blijft gelijk, en `upgrade()` kiest meteen weer de
    GE. Het geld van Patrickbot 14 zakte ~11.000 gp in 15 min. Vermoedelijk staan de 8 GE-slots
    vol met biedingen die niet vollopen (dat verklaart ook het zakkende geld), maar
    `ge:place-offer` gaf geen reden terug. Niet bewezen.
  - **Pingpong** (4 bots: Patrickbot 17, Patrickbot 18, Jorgbot 10, Patrickbot 8): `exchange` en
    `withdraw` om en om, honderden keren. **Niet aangepakt.** Begin in `trade()`
    (`Adventurers.PlayerBots.js`, `toExchange`) en de `withdraw` die erop volgt.
- 6 van deze 12 lusbots stonden in `7a8e40b` bevroren bij een bank. Fase 1 heeft ze losgemaakt,
  waarna ze in een GE-lus vielen.

### Wat aangepast is

Eén probleem: de kooplus, plus het beperken van de log-overstroming die hij veroorzaakte.

- `server/plugins/interface/GrandExchange.plugin.js`: `ge:place-offer` zet `why` als het bod niet
  geplaatst wordt: `not-exchangeable`, `no-slot` of `refused`. Gedrag van de GE ongewijzigd.
- `server/plugins/bots/adventurers/Trade.PlayerBots.js`: `buyAtExchange` geeft die reden door
  via een optioneel `outcome`.
- `server/plugins/bots/adventurers/Adventurers.PlayerBots.js`:
  - `boughtNothing()`: een koopbezoek aan de GE dat niets kocht schrijft een activiteitenregel
    met de reden, event `buyNothing`, metric `buy_nothing` (met stand GE-slots) en zet
    `noExchangeBuyUntil` op 30 min (`BUY_RETRY_MS`). `buyOnExchange` en `buyManyOnExchange` gaan
    in die tijd niet naar de GE; winkels mogen nog.
  - Errands korter dan 3 s (`INSTANT_ERRAND_MS`) worden event `errandInstant` in plaats van een
    eigen `errand`-regel.
- `server/tests/bot-adventurers.test.cjs`: test dat `buyAtExchange` de reden doorgeeft.
- `docs/OBSERVABILITY.md`, `docs/RUNTIME_POLICY.md`, `CHANGELOG.md`.

Validatie: bot-tests 16 van 111 fout (zelfde 16). GE-tests en `Adventurers.PlayerBots.js` laden
hier niet (ongebouwde core), voor en na gelijk; alleen `node --check`. **Niet in game getest.**

### Openstaande risico's

1. De echte oorzaak van de kooplus (waarom slots vol blijven of biedingen niet vollopen) is nog
   niet opgelost, alleen begrensd. `buy_nothing.why` en `geWaitingBuys` moeten dat laten zien.
2. Een bot die een quest-item of gereedschap alleen op de GE kan kopen, wacht nu 30 min na een
   mislukt bezoek.
3. De pingpong-lus loopt nog. Met `errandInstant` vult hij het log niet meer, maar hij kost
   die 4 bots al hun tijd.

### Aanbevolen volgende stap

1. Mergen, `yarn update`, na een uur `bot-logs` ophalen.
2. `buy_nothing` per `why`; `errandInstant` per bot (hoog = lus); aantal regels per uur.
3. Dan de pingpong-lus (zie boven).

---

## Sessie 20-11-2026 (middag): Phase 2, errands meetbaar maken

Branch: `adventurers/errand-metric` (vanaf `main` `e210ce9`).

### Wat onderzocht is

- Alle zes kerndocumenten en de constitution (§19 tot §35 opnieuw gelezen).
- `bot-logs` (push 20-11-2026 14:18 UTC). De server stond uit van 17-11 22:08 tot 20-11 14:16.
  Er is dus **geen nieuwe runtime-data** van `7a8e40b` na de vorige sessie.
- Van `e210ce9` (Fase 1-fix) zijn er pas 11 metric-regels (40 seconden). **Fase 1 is nog niet
  gevalideerd.**
- `brain/Errands.PlayerBots.js` en `walkTo` in `Adventurers.PlayerBots.js`.

### Wat gevonden is

- De 5-minuten-regels (`bot.errand`) tonen alleen dát een bot op boodschap is, niet hoe lang een
  boodschap duurt of hoe hij eindigt. De runner logt `bot_errand` en `bot_errand_failed` alleen
  in de serverlog, die niet naar `bot-logs` gaat. Fase 2 kon daardoor niet gemeten worden.
- Hoe het einde werkt: de runner meldt aankomst binnen 3 tegels (`ARRIVE_TILES`), of opgeven na
  45 s stilstaan (`stuck`), 4 min niet dichterbij (`no-closer`) of te lang (`too-long`). Bij
  opgeven telt `walkTo` het binnen 15 tegels toch als aangekomen (`NEAR_ENOUGH_TILES`). Elke
  "bank door de muur" kost dus minstens 45 seconden stilstaan voordat de bot bankiert.
  Hypothese, nog niet gemeten: dit is een groot deel van de bank-errandtijd.

### Wat aangepast is

Eén ding: errands meetbaar maken. Geen gedragswijziging.

- `server/plugins/bots/brain/Errands.PlayerBots.js`: `arrive` en `fail` krijgen als tweede
  argument `{ ms, why, tilesLeft, teleport }`. Bestaande aanroepers negeren het.
- `server/plugins/bots/adventurers/Adventurers.PlayerBots.js` (`walkTo`): metric `errand` per
  boodschap, met `ended` = `arrived` / `near` / `toll_gate` / `blocked`, plus `why`, `seconds`,
  `tilesLeft`, `teleport`, `hop`, `where`.
- `server/tests/bot-errands.test.cjs`: test voor de uitkomst (stuck na 46 s, 10 tegels over;
  aankomst na 30 s).
- `docs/OBSERVABILITY.md`: metric-soort `errand` en analyse-recept per bestemming.
- `docs/ADVENTURER_ROADMAP.md`: Fase 2, instrumentatie klaar.
- `CHANGELOG.md`: regel onder "Toegevoegd".

Validatie:

- Bot-tests: 16 fouten van 109 voor, 16 van 110 na. De nieuwe test slaagt.
- `Adventurers.PlayerBots.js` laadt in deze omgeving niet (ongebouwde core), dus `walkTo` is
  alleen met `node --check` gecontroleerd. **Niet in game getest.**

### Openstaande risico's

1. Fase 1 (banklus) en deze metric zijn allebei nog niet in echte logs bevestigd.
2. Volume: één regel per errand. Bij 60 bots en errands van 1 à 2 minuten zijn dat ruwweg
   1.000 à 2.000 regels per uur extra. Met de cap van 20.000 regels per log daalt de dekking van
   `adventurers-metrics.jsonl` mogelijk van ongeveer 5 naar 3 à 4 uur. Na de eerste push meten;
   bij te veel de cap voor dit log verhogen in `scripts/share-bot-logs.sh`.
3. Errands die stoppen door dood of uitloggen schrijven geen regel.

Alle risico's van de vorige sessie (hieronder) gelden nog.

### Aanbevolen volgende stap

1. Branch mergen en deployen. Na 1 à 2 uur `bot-logs` ophalen.
2. Fase 1 controleren: bevroren bots (recept), `bank_nothing`.
3. Recept "Errands" draaien. Kijk naar het aandeel `near` bij bank-errands en hun `seconds`
   tegenover `arrived`. Als `near` groot is: de oorzaak is het bankpunt of de route tot in het
   gebouw (deur, muur), en die fix is de eerste gedragswijziging van Fase 2.

---

## Sessie 20-11-2026: Phase 1, Project Foundation

Branch: `adventurers/bank-stall-full-bag` (vanaf `main` `9563445`).

### Wat onderzocht is

- `AI_Constitution.md` volledig, `AGENTS.md`, `server/AGENTS.md`,
  `server/docs/agents/adventurers.md`, bestaande `docs/ARCHITECTURE.md`.
- De structuur van `server/plugins/bots/` (adventurers, brain, behaviours, runtime, ai, data) en de
  koppelingen: Quest Helper bridge, RuneLite gateway, agent-MCP, persistence, log-sharing.
- Runtime-data van branch `bot-logs` (laatste push 17-11-2026 22:08 UTC):
  - `adventurers-metrics.jsonl`: 20.000 regels, 14 serverversies, 09:58 tot 22:08.
  - `adventurers-activity.jsonl`: 20.000 regels, 17:40 tot 22:08.
  - `adventurer-quest-feedback.jsonl`: 616 regels.
- Analyse vooral op de nieuwste versie `7a8e40b` (17:13 tot 22:08, 4,9 uur, 60 avonturiers).

### Wat gevonden is

Tijdsbesteding van alle avonturiers (versie `7a8e40b`):

| Soort | Aandeel |
| --- | --- |
| errand (boodschap) | 57,6% |
| working | 15,1% |
| walking (naar een klus) | 12,9% |
| idle | 6,4% |
| quest | 5,1% |

Grootste bottleneck: **Navigation**, gemeten aan de tijd op boodschap. De grootste enkele
oorzaak daarbinnen:

- **15 van 60 avonturiers stonden 4,5 uur stil bij een bank.** 0 XP, dezelfde tegel 4 tot 8
  tegels van het bankpunt, fase `errand`/`bank`, geen enkele regel in het activiteitenlog, geen
  events. Na een herstart (rond 20:45) bevroren ze binnen 5 minuten opnieuw. Samen 25% van alle
  bot-minuten en 42% van alle errand-minuten.
- Oorzaak: tassen vol dubbele uitrusting (8 × Staff of fire, 7 × Mystic fire staff, 24 × Adamant
  axe, 7 × Black d'hide vambraces). `Trade.goodsToSell` sloeg elk exemplaar van een behouden id
  over, dus de bank kreeg niets. De banktrip "slaagde" via "binnen 15 tegels", de volgende
  beslissing zag weer een volle tas, en zo verder. `deposit()` zette bovendien altijd het hele
  aantal weg, ongeacht het gevraagde aantal.
- De bestaande errand-watchdog (commit `52a1620`) vangt dit niet: de errand-runner was steeds
  netjes bezig met een nieuwe errand.

Overige bevindingen (niet aangepakt):

- Zonder de bevroren bots is errand nog 44,3% van de tijd. Bank-errands zijn het grootst
  (Draynor, Edgeville, Varrock West, GE). `walk_blocked` 262 keer, vooral `quest` (Veos, Gnome
  Stronghold, Mazchna).
- Agility-rooftops: in oudere versies 5.766 stuck-regels op Varrock (3194,3416,1) en 1.718 op Seers
  (2710,3475,3). In `7a8e40b` nog 14 op Seers en 20 op Gnome. Jorgbot 19 staat er vaak.
- 24 van 24 doden: "geen eten bij zich".
- Quest-feedback top: "too many tries" (99), "blocked for every adventurer" (95), "talked, but the
  step did not advance" (86), "quest helper error: fetch failed" (80), "no stairs/ladder found to
  floor 0" (74). Cook's Assistant (111) en Sheep Shearer (64) het vaakst.
- Avonturiers hebben dubbele gear gekocht. Waarom (meermaals hetzelfde kopen of uit testprofielen)
  is niet onderzocht.

Gap-analyse tegen de constitution: [ADVENTURER_ROADMAP.md](ADVENTURER_ROADMAP.md#gap-analyse).

### Wat aangepast is

Code (één probleem: de stille banklus bij een volle tas, [ADR-0005](adr/0005-een-van-elk-en-geen-stille-banklus.md)):

- `server/plugins/bots/adventurers/Trade.PlayerBots.js`: `goodsToSell` houdt één exemplaar per
  stuk uitrusting of gereedschap uit de gear-lijsten. Extra exemplaren zijn goederen.
- `server/plugins/bots/adventurers/Adventurers.PlayerBots.js`:
  - `deposit()` zet weg wat gevraagd is, niet meer.
  - `clearBag()` laat vallen wat gevraagd is, niet meer.
  - Bankbezoek bij een volle tas dat de tas niet leger krijgt: activiteitenregel, event
    `bankNothing`, metric `bank_nothing` (met tas), en 30 minuten geen nieuwe banktrip voor een
    volle tas (`FULL_BAG_RETRY_MS`). Daarna kiest hij een klus.
- `server/tests/bot-adventurers.test.cjs`: nieuwe test voor één-van-elk.
- `CHANGELOG.md`: regel onder "Opgelost".

Documenten:

- Nieuw: `docs/ADVENTURER_ROADMAP.md`, `docs/OBSERVABILITY.md`, `docs/RUNTIME_POLICY.md`,
  `docs/AI_HANDOVER.md`, `docs/adr/` (README en ADR-0001 tot 0005).
- Aangevuld: `docs/ARCHITECTURE.md` (sectie "Adventurer Platform": lagen, services),
  `server/docs/agents/adventurers.md` (stand 20-11-2026).
- Niet aangepast: `AI_Constitution.md`.

Validatie:

- Bot-tests voor en na: 16 fouten van 108 voor, 16 van 109 na (alle 16 door ontbrekende cache en
  ongebouwde TypeScript-core in deze omgeving). De nieuwe test slaagt.
- Nagerekend op de 15 echte tassen uit de logs (benadering op itemnamen): bij ongeveer 11 komt
  er genoeg ruimte vrij (5 of meer vrije vakjes). Bij de andere 4 grijpt de nieuwe bewaking in.
- **Niet in game getest.** Er is geen cache en geen draaiende server in deze omgeving.

### Openstaande risico's

1. **Niet in game geverifieerd.** Bevestigen in de logs van de nieuwe versie: geen bevroren bots
   (recept in [OBSERVABILITY.md](OBSERVABILITY.md#analyse-recept)), weinig `bank_nothing`.
2. **Jorgbot 18 past niet in de verklaring.** Zijn tas: 16 rune daggers en 9 runite bars bij
   Varrock West (smithing). Rune daggers stonden al niet op de "houden"-lijst. Hij zit
   waarschijnlijk in een andere lus (smithing-verwerking of "next load"). Als hij in de nieuwe logs
   nog bevriest: daar beginnen.
3. **Gedragsverandering `deposit()`.** Eten boven 10 en potions boven 8 gingen eerder allemaal de
   bank in; nu blijft de bedoelde hoeveelheid in de tas. Dat volgt het commentaar in `goodsToSell`,
   maar het is ander gedrag.
4. **Koop-verkoop-churn.** Extra exemplaren worden nu verkocht. Als de oorzaak van het dubbel
   kopen nog bestaat, kan een bot kopen, verkopen en weer kopen. Zichtbaar in de GE-regels van het
   activiteitenlog.
5. **Tas vol unieke behouden gear** (Patrickbot 18: Ancestral én Masori én Twisted bow) blijft
   vol. Nu niet meer blokkerend, wel zichtbaar.
6. **Banken door de muur.** "Binnen 15 tegels" telt als aangekomen, ook buiten het gebouw. Dat was
   al zo en is niet aangepast. Botst met de eerlijkheidsregel "echte interfaces".
7. **Logcap.** 20.000 regels dekt maar enkele uren. Een probleem dat 's nachts begint kan buiten
   beeld vallen.
8. **Locatie constitution.** De opdracht noemt `/docs/AI_CONSTITUTION.md`; het bestand staat in de
   root als `AI_Constitution.md`. Niet verplaatst (ADR-0001). Beslissing bij de eigenaar.

### Aanbevolen volgende stap

1. Branch mergen, server herstarten, na 1 à 2 uur `bot-logs` ophalen.
2. Controleren: bevroren bots (verwacht 0 of hooguit Jorgbot 18), `bank_nothing`-regels,
   errand-aandeel.
3. Dan Fase 2 uit de roadmap: **errand-duur per bank meten** en de grootste oorzaak van lange
   bank-errands oplossen (doel: errand onder 30% van de tijd). Begin met hoe vaak een bank-errand
   eindigt via "binnen 15 tegels" in plaats van echt aankomen; dat raakt ook risico 6.
