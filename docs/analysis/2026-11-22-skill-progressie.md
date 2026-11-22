# Skill-progressie, money making en gevechtskeuzes, 22-11-2026

Avonturiers trainen nu per skill één vaste methode per levelband, kiezen vijanden alleen op
combat level en verdienen geld vooral met mining. De OSRS Wiki en de gamedata in deze repo
laten per skill een beter pad zien. Een groot deel daarvan kan al met content die op de server
bestaat: de Gemstone Crab, Scurrius, bird houses, de Ourania-altaar, tree runs en 50 boss-plugins.
Dit document vertaalt dat naar data en werkpakketten die de developer kan bouwen.

- **Vervolg op:** [2026-11-21-runtime-analyse.md](2026-11-21-runtime-analyse.md). De
  pakketnummers hieronder beginnen bij S1, zodat ze niet botsen met die analyse.
- **Bronnen:** de OSRS Wiki-trainingsgidsen voor alle skills, de
  [Money making guide](https://oldschool.runescape.wiki/w/Money_making_guide) en de
  [Bossing Ladder](https://oldschool.runescape.wiki/w/Guide:Bossing_Ladder), opgehaald op
  22-11-2026 (CC BY-NC-SA 3.0). Verder `server/data/definitions/monsters-complete.json`
  (verdediging per stijl en elementzwakte per monster) en `npc-spawns.json`. Runtime: `bot-logs`
  van 21-11 (zie de vorige analyse).
- **Datasets:** [`2026-11-22/`](https://github.com/m4rk4ever-lang/private-project/tree/main/docs/analysis/2026-11-22),
  gemaakt met [`scripts/skill_progression_datasets.py`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/scripts/skill_progression_datasets.py).
- **Grens:** de wiki beschrijft het echte OSRS. Prijzen en gp/uur gelden voor de echte Grand
  Exchange, niet voor de GE op deze server. Methodes met tick-manipulatie, teamwork of hoge
  aandacht zijn bewust weggelaten of als "later" gemarkeerd: een bot moet ze eerlijk kunnen spelen.

## Stand nu (runtime 21-11, 60 avonturiers)

| Meting | Waarde |
| --- | --- |
| Laagste gemiddelde levels | Sailing 24,7, Construction 26,3, Farming 28,3, Herblore 28,8, Slayer 29,3, Runecraft 30,9, Hunter 32,4, Ranged 34,6 |
| In alle 45 vensters van 5 min onaangeroerd | Slayer, Runecraft, Construction, Sailing; Hunter 40 van 45 |
| Mediaan gp/uur per klus | smelting 23,9k, fishing 23,3k, mining 18,7k, woodcutting 9,6k, combat 3,9k, thieving 3,7k, hunter 1,5k |
| Gevechtsdoel | Alleen op combat level (`stages.npcLevels` in `bot-activities.json`); 108 van 135 combat-klussen `stuck` |
| Bosses | 3 in `adventurers.json` (Barrows, Giant Mole, Sarachnis), terwijl er 50 plugins zijn |

## Kernvondsten

1. **De methodes per skill wijken op veel plekken af van de wiki.** Bots hakken willows en yews
   waar de wiki tot 35 oaks en daarna teaks noemt. Ze mijnen coal en mithril met banken waar de
   wiki iron tot 70 aanraadt. Hunter gebruikt crimson swifts en wagtails, die in de logs 0 XP
   gaven, terwijl de wiki bird houses, Feldip weasels, red crabs en razor-backed kebbits noemt.
2. **Quests slaan de vroege levels over, en precies die quests zijn geblokkeerd.** De wiki begint
   bijna elke skill met quest-XP. The Restless Ghost (Prayer), Imp Catcher en Witch's Potion
   (Magic), The Knight's Sword (Smithing) en Doric's Quest (Mining) staan in de logs geblokkeerd of
   falen. Het quest-verificatiecontract (pakket 5 van de vorige analyse) heeft daardoor dubbele waarde.
3. **Content die de server al heeft, wordt niet gebruikt.** De Gemstone Crab (plugin aanwezig) is
   volgens de wiki dé idle-trainingsplek voor melee en ranged vanaf level 30. Scurrius (plugin)
   is de snelste methode tussen 50 en 75. Bird houses (Bone Voyage staat al in `grantedQuests`),
   tree runs en de Ourania-altaar (bots jagen er al op red salamanders) zijn rustige, betrouwbare
   methodes die bij een bot passen.
4. **Vijandkeuze negeert verdediging en zwakte.** `monsters-complete.json` heeft per monster de
   verdediging per stijl en de elementzwakte, maar `TrainCombat` kijkt alleen naar het combat level.
   Van de 1.790 gespawnde aanvalbare monsters hebben er 880 een elementzwakte (fire 351, earth 227,
   water 165, air 137).
5. **Geld verdienen staat los van progressie.** De wiki-tabel heeft 494 uurmethodes en 34
   terugkerende. Veel goede, rustige methodes zijn verwerking (potions, looien, bolt tips) die de
   bot ook XP geven. De bot kiest nu vooral mining met 18,7k gp/uur.

---

## Progressiepad per skill

Per skill het pad dat de wiki aanraadt, gefilterd op wat een bot eerlijk en rustig kan. In de
kolom "Nu" staat wat de bot vandaag doet. XP-cijfers alleen waar de wiki ze in de tekst geeft.

| Skill | Pad volgens de wiki (bot-geschikt) | Nu | Gat |
| --- | --- | --- | --- |
| Attack, Strength, Defence | Quests tot ~45/34/31 (de wiki noemt ze "de snelste manier om vroege levels over te slaan") → **Gemstone Crab** 30-99 (idle, onbeperkte HP, staat stil) → Scurrius 50-75 → Sulphur naguas 55-75 | `combat_training` op combat level, 80% `stuck` | Gemstone Crab en Scurrius bestaan als plugin; doel kiezen op verdediging (S3) |
| Ranged | Quests (Shadow of the Storm, Death to the Dorgeshuun, Horror from the Deep) → dwarf multicannon tot 45 (quest Dwarf Cannon) → **Gemstone Crab** 1-99 met darts → Scurrius 50-75 met bone shortbow | `combat_ranged` als stijl ≥ 10 achter ligt | Gemstone Crab; Scurrius' spine geeft de bone shortbow |
| Magic | Witch's Potion + Imp Catcher → 10; Lvl-1 Enchant 7-21 (~32.000 XP/uur); Low Alchemy 21-55; Superheat 43-55; Camelot Teleport 45-55 (~80.000 XP/uur); **High Alchemy 55+** (passief, levert geld) | `combat_magic` | Alchemy en enchant combineren met lopen en geld (S5) |
| Prayer | The Restless Ghost, Priest in Peril, Recruitment Drive, Holy Grail → 30; bones begraven; later gilded altar (eigen huis) of Ectofuntus (Morytania) | `buy_prayer`: big bones begraven | Gilded altar na Construction (S6); Restless Ghost faalt nu |
| Mining | Doric's Quest, The Dig Site e.a. → tot 37; copper/tin 1-15; **iron 15-70** (droppen); Motherlode Mine 30+ als rustig alternatief met winst | Coal 30, mithril 50, adamant 70 met banken | Iron voor XP, aparte geldmethode (S2) |
| Smithing | The Knight's Sword, Sleeping Giants, Elemental Workshop I+II → tot 39; **anvil Varrock West 1-40**; Blast Furnace gold bars 40+; dart tips en cannonballs als rustige winst | Anvil Varrock West ✓, smelten Falador | Blast Furnace (docs bestaan) en cannonballs |
| Woodcutting | Monk's Friend e.a. → 26; normal 1-15; **oak 15-35**; teak 35+ (sneller dan willow) | Willow 30, yew 60, magic 75 | Oak langer, teak toevoegen (Castle Wars, Uzer, Ape Atoll) |
| Fishing | Sea Slug, Fishing Contest, Pirate Pete → 24; **fly fishing 20-58**; monkfish 62+ (Swan Song), karambwan 65+ (Tai Bwo Wannai Trio) als rustige winst | Net, fly 20, lobster 40, harpoon 60, shark 76 | Fly fishing langer houden; monkfish/karambwan na quests |
| Cooking | Vis koken 1-99 (goedkoop, rustig; Hosidius-keuken sneller dan Lumbridge); jug of wine 35/68+ | `buy_cooking` in de keuken van Lumbridge | Plek: dichter bij een bank |
| Firemaking | Logs branden bij de GE 1-99; Wintertodt 50+ (winst) | `buy_firemaking` ✓ | Wintertodt na het transportpakket |
| Fletching | Animal Magnetism, Big Chompy Bird Hunting, Zogre Flesh Eaters → 18; arrow shafts 1-5; **bows 5-99** (goedkoop of winst); darts "zero time" tijdens lopen | `buy_fletching` bows ✓ | Darts tijdens lange wandelingen (S5) |
| Crafting | Leer 1-20; **gems 20-62**; battlestaves 54+; d'hide bodies 63+; molten glass als rustig alternatief | `buy_crafting` gems ✓, leer | Battlestaves en d'hide als volgende tiers |
| Herblore | Jungle Potion, Recruitment Drive, The Dig Site → 3-19; potions maken (`Calculator:Herblore/Potions`); herbs schoonmaken als winst | `buy_herblore` ✓ (XP-snelheid verdacht: pakket 9 vorige analyse) | Snelheid toetsen |
| Agility | Quests (The Tourist Trap, Recruitment Drive, The Grand Tree) → 26-33; **rooftops 1-99** (rustig, marks of grace); Agility Pyramid 30+ (winst, 10.000 per top) | Rooftops tot Seers 60; Canifis geblokkeerd | Rellekka en Ardougne rooftop; Pyramid als geldmethode |
| Thieving | Quests → tot 42; men 1-5; **bakery stall 5-25** (~19.200 XP/uur); fruit stalls 25-50 (Hosidius); **knights of Ardougne 55+** | Bakery ✓, silk 20, silver 50 (35 `stuck`), knights 55 ✓ | Fruit stalls na Kourend-transport |
| Slayer | Hoogste meester die combat en Slayer toelaten: Turael (Burthorpe) → Vannaka (Edgeville Dungeon) → Chaeldar (Zanaris) → Nieve (Gnome Stronghold) → Duradel (Shilo) | Alleen Mazchna (Morytania, 44 van 46 `blocked`) | Meester per bereikbaarheid kiezen (S4) |
| Runecraft | Quests → 32; talisman tiaras 1-50 (geen eisen); **Ourania-altaar 1-99** (winst, rustig); Guardians of the Rift 27+; lava runes 23+ | Air runes met gekochte talisman | Ourania: bots zijn er al voor salamanders |
| Hunter | **Natural History Quiz → 9** (Varrock Museum); **bird houses 9+** (Fossil Island, Bone Voyage); Feldip weasels 9-15; ruby harvests 15-21; red crabs 21-39 (Pandemonium); embertailed jerboas 39-43 (~50.000 XP/uur, Eagles' Peak); falconry 43-49; razor-backed kebbits 49-73; red salamanders 60-67 | Crimson swifts, wagtails (0 XP), red salamanders 59 | Bird houses en het quiz (S2) |
| Farming | Quests → tot 38; allotments 1-15; **tree runs 15-99** ("de meest effectieve manier"); herb runs voor winst; Tithe Farm 34+ | Herb- en allotment-patches Falador, Catherby, Ardougne | Tree runs met saplings en betaling aan de boer (S2) |
| Construction | **Daddy's Home → 8**; planks 1-33; oak larders 33-52 (tot ~480-500k XP/uur bij perfect klikken); mahogany 52+; mahogany homes 1-99 als goedkope, rustige methode | Parlour in het eigen huis | Daddy's Home, oak larders, Phials voor noted planks |
| Sailing | Pandemonium → 4; koerierstaken en sea charting 4-30; Barracuda Trials 30+ | Geen | Ontwerp staat in de roadmap (Fase 6) |

---

## Generiek keuzemodel voor de planner

De constitution (§10) vraagt niet "welke activiteit geeft de meeste XP", maar "welke unlock heeft
de hoogste toekomstige waarde". Met de wiki-data wordt dat concreet, in vier lagen.

### 1. Doel kiezen (Decision-laag)

Het doel is de knoop met de hoogste waarde in de unlock-graaf (fundament A van de vorige
analyse), met de ontbrekende eisen als keten. Voorbeelden uit de wiki:

| Unlock | Eisen | Waarom waardevol |
| --- | --- | --- |
| 43 Prayer | levels | Protection prayers: voorwaarde voor bijna elke boss in de ladder |
| 55 Magic | levels | High Alchemy: passieve XP én geld |
| Gemstone Crab-toegang | plek | Idle melee/ranged 30-99 |
| Bird houses | Bone Voyage (granted) + hammer, chisel, logs, clockwork | Terugkerende Hunter-XP met weinig tijd |
| Fairy rings | Fairytale II gestart | Transport naar Zanaris (Slayer-meester), jerboas, kebbits |
| Dwarf multicannon | quest Dwarf Cannon | Ranged tot 45 en Slayer sneller |

### 2. Methode kiezen per skill

Voor een skill die het doel nodig heeft kiest de planner de methode met de hoogste score:

```
score = xpPerHour(gemeten, anders wikiband) × w_xp
      + gpPerHour × w_gp(geldbehoefte)
      − risico(doden per uur) × w_risk
      − reistijd(gemeten) × w_travel
```

- `w_gp` stijgt als de bot zijn volgende doel niet kan betalen (§14). Zo kiest hij vanzelf een
  winstgevende methode in dezelfde skill (karambwan in plaats van fly fishing, knights in plaats
  van stalls) in plaats van een losse geldklus.
- `xpPerHour` komt uit de Activity Health-meting zodra die er is; tot die tijd uit de wiki-band.
- Methodes die twee skills tegelijk geven tellen dubbel: drift nets (Fishing + Hunter), Barbarian
  Fishing (+ Agility, Strength), Guardians of the Rift (+ Mining, Crafting), Superheat (+ Smithing).

### 3. Combineren en terugkerend werk

Dit is waar een bot het meest wint, want het kost bijna geen extra tijd.

| Soort | Voorbeelden (wiki) | Hoe in de planner |
| --- | --- | --- |
| Tijdens lopen | High Alchemy, Enchant bolts, darts fletchen ("zero time") | Een bijtaak tijdens een errand ≥ 60 s; nu 1.142 lange errands zonder teleport |
| Terugkerend | Bird houses (50 min), herb runs, tree runs, en de 34 terugkerende methodes uit de money making-tabel | Een timer per account; de planner onderbreekt een klus als een run klaar staat |
| Quest-XP | Zie de quest-tabel hieronder | Quests met skill-XP krijgen een hogere unlock-waarde zolang die skill laag is |

### 4. Wanneer geld, wanneer trainen

- Geld als het volgende doel niet betaalbaar is (§14), of als de gp per XP van de gekozen methode
  het vermogen sneller laat dalen dan het binnenkomt.
- Kies eerst een winstgevende methode in een skill die toch nodig is (zie stap 2), en pas daarna
  een losse geldklus uit de tabel hieronder.

## Quests die vroege levels overslaan

Uit de wiki-gidsen. **Vet** = in de logs van 21-11 geblokkeerd of mislukt.

| Skill | Quests (wiki) | Resultaat |
| --- | --- | --- |
| Prayer | **The Restless Ghost**, Priest in Peril (granted), Recruitment Drive, Holy Grail | 1 → 30 |
| Magic | **Witch's Potion**, **Imp Catcher** | 1 → 10 |
| Mining | **Doric's Quest**, The Dig Site, Plague City (granted), The Giant Dwarf, The Lost Tribe, Another Slice of H.A.M. | 27.525 XP, tot 37 |
| Smithing | **The Knight's Sword**, Sleeping Giants, Elemental Workshop I en II, The Giant Dwarf, Heroes' Quest, Pirate Pete (RFD) | tot 39 |
| Fishing | Sea Slug, **Fishing Contest**, Freeing Pirate Pete (RFD) | 10.612 XP, tot 24 |
| Woodcutting | Monk's Friend, Enlightened Journey, Icthlarin's Little Helper, Skrach Uglogwee (RFD) | 9.000 XP, tot 26 |
| Thieving | Biohazard, Hazeel Cult, **Fight Arena**, Tower of Life, Tribal Totem | 7.200 XP |
| Fletching | Animal Magnetism, Big Chompy Bird Hunting, Zogre Flesh Eaters | 3.262 XP, tot 18 |
| Herblore | Jungle Potion, Recruitment Drive, The Dig Site | 3 → 19 |
| Ranged | Shadow of the Storm, Death to the Dorgeshuun, Horror from the Deep | 16.662,5 XP |
| Hunter | Natural History Quiz (geen quest, Varrock Museum) | 1 → 9 |
| Construction | Daddy's Home | 1 → 8 |
| Agility | The Tourist Trap, Recruitment Drive, The Depths of Despair, The Grand Tree (granted) | tot 26-33 |

---

## Money making

[`money-making.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-22/money-making.csv)
bevat de hele wiki-tabel: 494 uurmethodes en 34 terugkerende, met eisen, categorie en
intensiteit. Hieronder een selectie per accountfase: niet-combat, intensiteit laag of matig, en
zonder quest-eis in de tabel. Bedragen zijn de prijzen van de echte GE op 22-11-2026.

| Hoogste skill-eis | Methodes (gp/uur volgens de wiki) | Past bij de bot omdat |
| --- | --- | --- |
| < 20 | Looien van dragonhide (black 1,15M, blue 1,05M); ammunitie vergiftigen (1,07M) | Kopen, verwerken en verkopen gaat via GE en bank, wat de bot al kan; let op koopgrenzen en kapitaal |
| 20-40 | Ranarr- en toadflax-potions (804k-864k, Herblore 30/34); jade jewellery (631k, Crafting 34); Guardians of the Rift (1,14M, Runecraft 27) | Zelfde `buy_*`-patroon als nu |
| 40-60 | Irit- en kwuarm-potions (928k-1,04M, Herblore 45/55); bracelets of ethereum alchen (935k, Magic 55) | Geeft tegelijk Herblore- of Magic-XP |
| 60-75 | Sanfew serum (1,38M, Herblore 65); diamond bolt tips snijden (1,20M, Fletching 65); dwarf weed potions (1,13M, Herblore 72) | Verwerking met XP |
| 75-90 | Gem-tipped dragon bolts (2,54M, Fletching 84); Tan Leather casten (2,09M, Magic 78) | Hoge winst, laag risico |
| 90-99 | Raw marlin snijden (5,78M, Cooking 90+); master farmers pickpocketen (832k, Thieving 94, Farming 85) | |

**Belangrijk voor de server.** Bijna al deze winsten komen uit prijsverschillen op de echte GE.
Op deze server bepalen de eigen prijsdata en de handel van bots de prijs. Reken elke methode
opnieuw door met `server/data/definitions/item-prices.json` voordat hij in de planner komt
(pakket S5), en meet daarna de echte gp/uur zoals nu al per klus gebeurt (`job.coinsPerHour`).
Daarnaast negeert de wiki koopgrenzen: een bot mag niet aannemen dat hij de GE onbeperkt kan leegkopen.

**Eenmalig en zonder eisen:** de Stronghold of Security geeft 10.000 coins voor de eerste drie
niveaus, ook op combat level 3. De pagina `docs/stronghold-of-security.md` bestaat, dus de content
staat op de server. Het is een goede eerste geldbron voor een nieuw account.

---

## Gevechtskeuzes: sterktes en zwaktes van vijanden

### Wat er in de data zit

`monsters-complete.json` heeft per monster: verdedigingslevel, verdedigingsbonus tegen stab,
slash, crush, magic en drie soorten ranged, het magic level, de elementzwakte (type en
percentage), het aanvalstype, max hit, agressie, gif en slayer-gegevens.
[`monster-weakness.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-22/monster-weakness.csv)
zet dat voor alle 1.790 aanvalbare monsters met een spawn op een rij.

Per stijl staat erin hoe hoog de verdedigingsworp van het monster is, met de vorm uit OSRS:
`(level + 9) × (bonus + 64)`. Bij magic telt het magic level en de magic-verdediging, gedeeld door
de elementzwakte. Dit is **alleen de kant van het doelwit**: de aanvalsbonus en max hit van de bot
zelf zitten er niet in. Lage NPC's hebben bijna altijd een laag magic level, waardoor "magic" daar
het vaakst de laagste worp heeft. Dat zegt niets over de schade van een spreuk.

### Wat de bot ermee moet doen

| Beslissing | Regel | Data |
| --- | --- | --- |
| Welk doelwit in een stage | Hoogste score: makkelijk te raken (lage worp in de stijl van de bot) × genoeg hitpoints, met lage max hit en niet agressief als voorkeur | [`training-targets.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-22/training-targets.csv): top 12 per stage, alleen ≥ 3 spawns, binnen 120 tegels van een hub, buiten de Wilderness |
| Welke melee-stijl | Laagste bonus van stab/slash/crush; bij gelijke bonussen ("any") de stijl die de bot wil trainen | `best_melee_style` |
| Welke spreuk | Element van de zwakte, met het hoogste level dat de bot heeft | `elemental_weakness`, `elemental_pct`; de server rekent de zwakte al mee (`docs/elemental-weakness.md`) |
| Welke beschermingsprayer en hoeveel eten | Uit `attack_types` en `max_hit`; eten = verwachte schade × duur, nooit 0 bij een agressief monster | Vorige analyse: 3 van 3 doden zonder eten |
| Welke stijl tegen een boss | Laagste worp van de drie stijlen, als de bot die stijl op het aanbevolen level heeft | Boss-rijen in `monster-weakness.csv` |

Voorbeelden uit de dataset, bereikbaar te voet:

| Stage (bot combat) | Beste kandidaten (combat, HP) |
| --- | --- |
| intermediate (20+) | Barbarian (10, 18) bij Barbarian Village, Giant frog (13, 23) bij Lumbridge, Al Kharid warrior (9, 19, zwak tegen crush) |
| advanced (40+) | Skeleton (22, 29, zwak tegen crush, agressief) bij Edgeville, Terrorbird (28, 34) bij de Gnome Stronghold |
| expert (60+) | Cyclops (56, 75) bij East Ardougne, Mountain troll (71, 90) bij Burthorpe |

Boven de 70 dunt de lijst sterk uit: de meeste goede doelen liggen buiten bereik van de hubs. Daar
is de **Gemstone Crab** het antwoord, en de wiki beveelt hem aan van 30 tot 99.

---

## Bossprogressie

[`boss-ladder.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-22/boss-ladder.csv)
koppelt de wiki-ladder (58 encounters in zes tiers) aan de plugins op de server en aan wat de bots
nu doen. 50 van de 58 bestaan als plugin; de bots gebruiken er 3.

| Tier (wiki) | Aanbevolen | Plugin op de server | Voor bots als volgende stap |
| --- | --- | --- | --- |
| Easy | Scurrius (40/40/40), Obor en Bryophyta (40/40/40, Prayer 43+), Deranged archaeologist (Magic 50), Brutus (HP 20, The Ides of Milk), Barrows (bots ✓) | Alle aanwezig | **Scurrius** (riolen van Varrock, te voet), daarna Obor of Bryophyta |
| Medium | Giant Mole (60+; bots ✓ maar 181× uitgesloten op candle), Sarachnis (bots ✓, Kourend onbereikbaar), King Black Dragon (Wilderness), Kraken (Slayer 87), Hueycoatl, Amoxliatl, Royal Titans, Moons of Peril | Aanwezig | Giant Mole repareren (candle in de item source graph); Sarachnis na het Kourend-transport |
| Hard en hoger | Dagannoth Kings, Kalphite Queen, Grotesque Guardians, Zulrah, Vorkath, DT2-bosses | Grotendeels aanwezig | Pas na survivability en instance-awareness (pakket 14 van de vorige analyse) |

De wiki-volgorde per tier is ook de leervolgorde van mechanieken: eerst overhead prayers (Barrows)
en minions (Scurrius), dan prayer-wissels (Sarachnis), dan safespots (Giant Mole), dan multi-combat
(Wilderness). Een boss-registry per tier (schema in de vorige analyse) kan die mechaniek als eis
meenemen. Een bot gaat pas naar een tier als hij de tier eronder met ≥ 80% kills zonder dood haalt.

---

## Werkpakketten

| Prio | Pakket | Klaar als |
| --- | --- | --- |
| P1 | **S1. Gemstone Crab als trainingsplek** (melee en ranged, combat 30+) | `combat_training` voor bots ≥ 30 heeft > 50% werkaandeel en < 10% `stuck` |
| P1 | **S2. Methodes per skill gelijktrekken met de wiki** (data in `bot-activities.json` en `buyToTrain`): oak langer, teak, iron tot 70, fly fishing langer, Hunter-pad (quiz, bird houses, weasels, kebbits), tree runs | Geen skill meer met 0 XP in alle vensters; XP/uur per methode binnen de wiki-band |
| P1 | **S3. Vijandkeuze op verdediging en zwakte** in `TrainCombat`: score uit `monster-weakness`, stijl en spreuk per doelwit, eten naar max hit | `stuck` bij combat < 20%; Magic-bots gebruiken het zwakke element |
| P2 | **S4. Slayer-meester op bereikbaarheid**: Turael en Vannaka eerst, Nieve na de Gnome Stronghold-route | Slayer-XP > 0 in elk venster; geen Slayer-errand naar Morytania |
| P2 | **S5. Geld via verwerking**, herberekend met de serverprijzen, plus bijtaken tijdens lopen (alchemy, darts) | gp/uur gemeten per methode; ≥ 50% van de lange errands met een bijtaak |
| P2 | **S6. Terugkerende runs** (bird houses, herb runs, tree runs) als timer per account | Runs worden binnen 15 min na rijp gedaan; Farming en Hunter stijgen |
| P2 | **S7. Quest-XP als unlock-waarde**: quests uit de tabel hierboven krijgen extra waarde zolang hun skill laag is | Na het quest-verificatiecontract: elke nieuwe bot heeft binnen 4 uur Prayer ≥ 30 en Magic ≥ 10 via quests |
| P3 | **S8. Boss-ladder**: Scurrius, Obor en Bryophyta toevoegen; Giant Mole repareren; gate per tier op ≥ 80% kills zonder dood | Bossing-tijd > 0 bij bots ≥ combat 60, 0 doden zonder eten |
| P3 | **S9. Construction-pad**: Daddy's Home, oak larders, Phials | Construction-XP > 0 in elk venster |
| P3 | **S10. Sailing**: zie het ontwerp in de roadmap (Fase 6) | Sailing-XP > 0 |

Volgorde-afhankelijkheden: S7 wacht op het quest-verificatiecontract (pakket 5 van de vorige
analyse); S4 en de Kourend-methodes wachten op het transportpakket; S2 en S3 gebruiken de
fundamenten A-D maar hoeven er niet op te wachten (ze passen in de bestaande `bot-activities.json`).

## Findings, Risks, Recommendations, Priority, Expected Value

1. **Findings:** de methodes per skill wijken af van de wiki; de quests die vroege levels
   overslaan zijn precies de geblokkeerde; de Gemstone Crab, Scurrius, bird houses, tree runs en 50
   boss-plugins worden niet gebruikt; vijanden worden alleen op level gekozen terwijl verdediging
   en zwakte in de data staan; geld verdienen staat los van progressie.
2. **Risks:** wiki-prijzen kloppen niet voor deze server (herberekenen); methodes met hoge
   aandacht of tick-manipulatie zijn niet eerlijk na te doen (weggelaten); te snelle XP blijft een
   eerlijkheidsprobleem (pakket 9 van de vorige analyse eerst); content die op de server bestaat is
   nog niet in game met een bot getest.
3. **Recommendations:** eerst S1 en S3, omdat combat-training nu 80% faalt en de oplossing al op de
   server staat; daarna S2 per skill als data; S5-S7 bouwen op de planner-fundamenten.
4. **Priority:** zie de pakkettabel.
5. **Expected Value:** S1 en S3 samen pakken de 108 vastgelopen combat-klussen aan (combat is 10%
   van de bot-tijd). S2 haalt de skills uit de 45-van-45-nul-lijst. S6 geeft Farming- en Hunter-XP
   voor enkele minuten per uur. S5 koppelt geld aan XP, zodat een geldklus geen verloren
   progressietijd meer is.
