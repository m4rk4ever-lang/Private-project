# Voorwerk: oorzaken van vier vastlopers, 22-11-2026

Voorwerk voor de developer bot: per open probleem wat de logs laten zien, waar het in de code
gebeurt, wat de oorzaak is (bevestigd of hypothese), een ontwerp voor de fix, en hoe je controleert
dat hij werkt. Er is geen code gewijzigd; regelnummers gelden voor `main` op `b943103`.

| # | Probleem | Oorzaak | Zekerheid |
| --- | --- | --- | --- |
| 13 | Combat-training vindt geen doel | Buitlus: de bot blijft een item najagen dat hij niet kan oprapen, zet daarbij `lastProgressAt` op nu en komt niet aan de doelwitkeuze toe | Hoog (code en `idle=0s` in de logs) |
| 17 | Runecrafting bij de air-ruïnes | De beurt eindigt op `getMovementQueue().size() > 0`: de bot loopt naar de oorsprongstegel van de ruïnes, een geblokkeerde tegel | Middel (code en `step=-` in de logs) |
| 18 | Giant Mole-graaflus | Graven werkt alleen precies op een molshoop; een errand geldt als aangekomen binnen 3 tegels en daarna wordt niet gecontroleerd of de bot in het hol is | Hoog (code van plugin en bot) |
| A2 | Barrows-tunnels | De plugin weigert een deurklik stil als de bot niet precies op een zijtegel staat, en na een oversteek in een gang (`roomAt` = -1) wacht de bot zonder te lopen | Middel (code, niet in game getest) |

---

## 13. Combat-training: de buitlus

**Logs (`4101cc8`, 37 min).** 12 van 18 combat-klussen `stuck`. In elke momentopname
`target=none approach=none`, vrije NPC's in de band (`free:6-12`), `failed=0`, en **`idle=0s` of
`idle=1s`**. Bij 53 van 144 vastlopers in de hele log stond de bot binnen 5 tegels van het midden
van de site.

**Code.** `brain/actions/TrainCombat.PlayerBots.js`, `update`:
- r. 688-699: een eerlijke bot raapt tussen gevechten eerst zijn buit op.
  `bot.loot ?? Loot.lootNear(...)`; is de stap niet `"gone"`, dan
  `bot.lastProgressAt = nowMs; return "running"`. De doelwitkeuze (r. 735 e.v.) wordt dan
  overgeslagen.
- `brain/Loot.PlayerBots.js`, `takeStep` (r. 65-82): staat de bot naast het item en levert
  `manager.pickup` niets op (tas vol, oprapen geweigerd, item achter een hek), dan valt de functie
  door naar "loop ernaartoe" en geeft `"walking"` terug. Dat herhaalt zich elke beurt.
- `bot.loot` onthoudt het item. Daardoor wordt `lootNear` overgeslagen, terwijl alleen die op een
  volle tas controleert (`inventoryCapacity <= 0`, r. 37).
- Omdat `lastProgressAt` steeds wordt bijgewerkt, gaat ook de vangnet-timer van de site
  (`SITE_STALL_MS`, 2 min, r. 735) nooit af. Pas als het item verdwijnt (eigenaar 1 min, daarna
  publiek, ~3 min in totaal) komt de bot weer bij de doelwitkeuze.

Dat past bij `idle=0s` (bijgewerkt), `approach=none` (de keuze is niet uitgevoerd) en `free:N`
(de diagnose kijkt wel naar NPC's).

**Ontwerp van de fix.**
1. `takeStep` krijgt een eigen uitkomst als oprapen naast het item mislukt: `"refused"`. De bot zet
   dat item in een korte negeerlijst (per bot, bijvoorbeeld 2 min).
2. Elke buitjacht krijgt een tijdslimiet (bijvoorbeeld 20 s per item) en een bereikbaarheidstoets
   (dezelfde `reachable` als bij NPC's). Daarboven negeren.
3. `bot.loot` wordt elke beurt opnieuw getoetst op tasruimte, net als in `lootNear`.
4. De buitstap zet `lastProgressAt` alleen bij `"taken"`, niet bij `"walking"`.
5. `describe` toont de buit die de bot najaagt (item, afstand, hoe lang al).

**Controle.** Unit-test met een nepwereld: een item dat niet op te rapen is naast de bot. Oud
gedrag: de doelwitkeuze wordt nooit bereikt; nieuw: binnen 20 s wel. In de logs: combat-`stuck` <
20% van de klussen, en in de momentopnames geen `idle=0s` meer met `target=none`.

---

## 17. Runecrafting: de beurt komt niet voorbij de eerste regel

**Logs.** Elke momentopname bij de air-ruïnes: `craftRunes - talisman=1 essence=25`. De bot heeft
talisman en essence, maar het stapje is leeg (`-`). Dat stapje wordt pas gezet op r. 79
("talisman on ruins"). 65× de algemene melding "Kon bij process runecrafting air niets doen"
(`Adventurers.PlayerBots.js`, r. 3739-3745: twee minuten zonder voortgang) en 18× home teleport.
Bots staan op 2983,3291.

**Code.** `brain/actions/CraftRunes.PlayerBots.js`, `update`:
- r. 61: `if (nowMs < bot.nextAt || player.busy?.() || player.getMovementQueue().size() > 0) return "running";`
- r. 73-75: niet binnen 2 tegels van `ruins` → `requestMovement(player, ruinsX, ruinsY, ...)`.
- `bot-activities.json`: `ruins: [2984, 3291]`, de oorsprongstegel van de ruïnes. Die tegel ligt
  onder het object en is geblokkeerd.

**Hypothese.** De loopopdracht naar 2984,3291 eindigt nooit (het doel is geblokkeerd). De bot staat
ernaast op 2983,3291, maar de bewegingsqueue blijft gevuld of `busy()` blijft waar, waardoor r. 61
elke beurt `"running"` teruggeeft. Het stapje wordt dus nooit gezet en de talisman nooit gebruikt.
De fix van 21-11 (talisman direct gebruiken binnen 3 tegels) zit ná r. 61 en komt nooit aan bod.

**Ontwerp van de fix.**
1. Binnen 3 tegels van de ruïnes eerst `clearMovementRequest` en de bewegingsqueue leegmaken, en
   pas dan verder; r. 61 mag een bot naast de ruïnes niet tegenhouden.
2. Het doel van de loopopdracht wordt een vrije tegel naast de ruïnes (de dichtstbijzijnde
   bereikbare rand van het object), niet de oorsprongstegel.
3. `describe` krijgt `queue=<size> busy=<bool> near=<afstand tot de ruïnes>`, zodat dit voortaan
   in één momentopname te zien is.

**Controle.** In game met de agent-MCP: een bot met talisman en essence bij de air-ruïnes zetten,
en kijken of "You hold the Air Talisman towards the mysterious ruins" komt en of hij binnen is
(rond 2841,4829). Daarna de hold uit `activityHold` halen. In de logs: Runecraft-XP > 0, en geen
`stranded` meer op 2983,3291.

---

## 18. Giant Mole: graven naast de molshoop

**Logs.** 66× "Gaat graven in een molshoop in Falador Park" tegen 2 kills; `loop` op de molshoop;
7× een candle aangestoken (licht is er dus meestal wel).

**Code.**
- Bot, `adventurers/Adventurers.PlayerBots.js` r. 2467-2490 (`via.kind === "dig"`): een errand
  naar `via.at` (2984,3387). Bij aankomst wordt de spade-optie "Dig" gestuurd en meteen `resume()`
  aangeroepen, zonder te controleren of de bot in het hol is beland.
- Een errand geldt als aangekomen binnen 3 tegels (`ARRIVE_TILES`, OBSERVABILITY: `errand.ended`).
- Plugin, `bosses/GiantMole.plugin.js` r. 21 en 147-159: graven werkt alleen als de speler
  **precies op** een molshoop staat (`onMoleHill`: object 12202 op de eigen tegel). Zonder licht
  volgt "It's going to be dark down there…".

**Oorzaak.** De bot graaft vanaf een tegel tot 3 van de molshoop af. Dat doet niets, `resume()`
volgt toch, de planner kiest opnieuw de boss en de lus begint opnieuw. Of 2984,3387 zelf een
molshoop is, valt hier niet te controleren: de molshopen staan in de kaart van de cache, niet in
`object-spawns.json`.

**Ontwerp van de fix.**
1. Na aankomst de dichtstbijzijnde molshoop zoeken (`MapObjects`, id 12202, binnen 5 tegels) en er
   precies op gaan staan; pas dan graven.
2. Na het graven 3 ticks wachten (`DIG_IN_TICKS` 2 in de plugin) en controleren of de bot rond
   1752,5237 staat. Zo niet: reden loggen (`not_on_hill`, `no_light`, `no_spade`) en de boss 30
   min overslaan via het faalgeheugen, in plaats van opnieuw te kiezen.
3. `via.at` in `adventurers.json` controleren in game: de tegel moet een molshoop zijn.

**Controle.** In game: bot met spade en lit candle naar de molshoop, en kijken of hij binnen 3
ticks in het hol staat. Daarna de hold weg. In de logs: ≥ 1 kill per 10 min boss-tijd, geen `loop`
op de molshoop.

---

## A2. Barrows-tunnels

**Logs.** Patrickbot 1 bleef twee runs achter elkaar hangen op "van kamer 2 naar kamer 0", en stond
bij het falen op 3568,9718. Markbot 16 bleef hangen op "van kamer 8 naar kamer 2", op 3568,9677 en
3575,9678.

**Geometrie** (`minigames/Barrows.plugin.js`): kamermiddens `roomLocation` = (3534 + 17·(n mod 3),
9712 − 17·⌊n/3⌋), dus kamer 2 = 3568,9712 en kamer 0 = 3534,9712. `roomAt` geeft een kamer binnen 7
tegels van een midden, anders -1. De koppeling 0↔2 (`DOOR_LINKS` [469, 0, 2]) verbindt twee kamers
die 34 tegels uit elkaar liggen: achter die deur ligt een lange gang.

**Twee plekken waar de bot vast kan komen te zitten:**
1. **De klik doet niets.** `useDoor` (r. 475 e.v.) stopt zonder melding als de speler niet precies
   op een zijtegel van de deur staat (`doorSides(door).some(side.equals(...))`). De bot loopt eerst
   naar `door.side` en klikt dan via `walkToObject` (`BarrowsRun.PlayerBots.js`, r. 59-72). Brengt
   die loop hem naar een andere tegel, of staat er een monster op de zijtegel (bij elk binnenkomen
   van een kamer komen er monsters bij, `spawnEncounter`), dan komt de klik niet aan. Patrickbot 1
   stond bij het falen nog in kamer 2: dit past daarbij.
2. **Na de oversteek in de gang.** `crossDoor` zet de speler één tegel verder (`to`). Ligt die in
   een gang (kamer -1), dan doet de bot niets meer: `if (room < 0) return "running";` (r. 341, met
   het commentaar "the step through ends in the next room"). Bij 0↔2 is dat vrijwel zeker zo.

**Ontwerp van de fix.**
1. Meten eerst. De plugin geeft per deurklik een reden terug (`not_on_side`, `locked`, `puzzle`,
   `crossing`, `crossed`), bijvoorbeeld via een custom event of een veld in `barrows:bot-view`. De
   bot zet die bij "komt niet verder" in `barrows_run`: kamer, deur-varbit, zijtegel, eigen tegel,
   in gevecht, NPC's in de buurt.
2. In een gang (kamer -1): naar het midden van de kamer lopen die de route als volgende noemt,
   niet wachten. De route weet die kamer al (`routeRooms`).
3. Staat de bot naast de zijtegel in plaats van erop, of staat er een NPC: eerst het gevecht
   afmaken (de monsters vallen toch aan), dan opnieuw naar de zijtegel.

**Over de observatie van de eigenaar** ("sommige deuren zijn altijd gesloten vanwege de puzzel"):
de plugin opent per run precies één deur naar de kistkamer, de puzzeldeur (`randomiseLayout`), en
de bot routeert alleen over open deuren uit `openDoors`. Dat deel klopt in de code. De vastlopers
in de logs zitten op deuren tussen buitenkamers.

**Controle.** Met de agent-MCP een bot in de tunnels zetten en per stap de reden van de plugin
lezen. In de logs: ≥ 80% van de Barrows-runs met loot (PvM-poort).

---

## Volgorde voor de developer bot

1. **13 (buitlus):** grootste winst. Combat is ~10% van de bot-tijd en 80% daarvan loopt nu vast.
   Kleine wijziging in `Loot.takeStep` en `TrainCombat`.
2. **18 (molshoop):** klein, en het brengt een boss terug.
3. **17 (ruïnes):** klein; daarna weer Runecraft-XP.
4. **A2 (tunnels):** eerst de reden-telemetrie, dan de fix.

Telemetrie die bij alle vier helpt: `slow_bot.brainSnapshot` vullen (pakket 8; nu altijd `null`),
en elke `describe` laten melden waarom de actie deze beurt niets deed.
