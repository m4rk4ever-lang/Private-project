# AI Handover

Overdracht tussen sessies aan het Adventurer Platform. Bovenaan staat de nieuwste sessie. Lees
eerst [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) en [RUNTIME_POLICY.md](RUNTIME_POLICY.md).

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
