# AI Handover

Overdracht tussen sessies aan het Adventurer Platform. Bovenaan staat de nieuwste sessie. Lees
eerst [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) en [RUNTIME_POLICY.md](RUNTIME_POLICY.md).

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
   dan de teleport. `canExecute` telt Kourend bereikbaar als Port Sarim te voet is. En (melding
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
