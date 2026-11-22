# Past de gekozen actie bij het level? Plus geld en Barrows, 22-11-2026

Voor verzamel- en verwerkingsskills kiezen avonturiers in 73% van de tijd de beste activiteit die
bij hun level hoort. De afwijkingen hebben drie oorzaken: een questlus (clay voor Doric's Quest),
plafonds in de data (de hoogste activiteit ligt onder het level van de bot) en vechtstijlen die
per botnaam vastliggen. Geld verdienen kiest bijna altijd "eens proberen" in plaats van de
gemeten opbrengst. Barrows faalt in alle 13 runs: op de reis sinds #53 en op gewone deuren in de
tunnels.

- **Vraag van de eigenaar (22-11):** "een max level bot die lv 20 vijanden dood klopt niet. Of een
  lv 30 actie doen als je lv 80 bent"; "nu gaan ze gems stelen"; "barrows lukt niet altijd, ze
  weten niet dat sommige deuren in de crypte altijd gesloten zijn".
- **Meetbasis:** `bot-logs` 21-11 08:48 t/m 22-11 14:14 UTC (versies `2f294017e` t/m `8b75ca8`),
  9.904 bot-minuten aan activiteiten met een bekend level-eis.
- **Reproduceren:** [`scripts/action_fit_analysis.py`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/scripts/action_fit_analysis.py);
  per 5-minutenregel in [`2026-11-22/action-fit.csv`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-22/action-fit.csv):
  activiteit, level van de bot in die skill (uit de `levels`-regel van dat uur), level-eis van de
  activiteit, en de beste activiteit die de bot op dat level had.

## 1. Verzamelen en verwerken: meestal goed, drie soorten afwijkingen

| Keuze | Bot-minuten |
| --- | --- |
| De beste activiteit voor het level | 7.206 (73%) |
| Een activiteit 1-9 levels onder de beste | 431 |
| 10-19 levels onder de beste | 718 |
| 20+ levels onder de beste | 1.169 |

**De grootste afwijkingen:**

| Gekozen | Had gekund | Bot-min | Reden in de log | Oorzaak |
| --- | --- | --- | --- | --- |
| Clay (Mining 1) | mithril, coal | 1.037 | "clay voor Doric's Quest" | Een questlus: de quest vraagt 6 clay, maar er waren 94 clay-klussen en 14 quest-pogingen eindigden op `gather`. De bot haalt clay, de queststap gaat niet verder, en hij haalt opnieuw clay |
| Varrock- of Falador-rooftop | Canifis, Seers | ~380 | "achterstand", "afwisseling", "van het dak af" | Canifis is nu terecht dicht (Morytania). Seers valt af na een val van het dak |
| Crimson swifts (Hunter 1) | wagtails, salamanders | ~180 | "At First Light (hunter 46)" | Het Hunter-pad heeft geen goede tussenplekken (pakket 2 en S2) |
| Magic trees (75) | redwood (90) | 94 | "afwisseling" | Redwood zit in de Woodcutting Guild; controleren of de bot erbij kan |
| Adamantite (70) | runite (85) | 73 | "geld verdienen (eens proberen)" | Runite-rotsen zijn schaars of bezet |

**Plafonds: de bot is ≥ 15 levels boven de hoogste activiteit die de data kent.**

| Skill | Hoogste in de data | Bot-min boven het plafond | Volgende stap volgens de wiki |
| --- | --- | --- | --- |
| Prayer | Big bones begraven (`buyToTrain.PRAYER`: één tier, level 1) | 294 | Hogere botten; gilded altar zodra er een huis is |
| Agility | Seers' rooftop (60) | 247 | Pollnivneach 70, Rellekka 80, Ardougne 90 |
| Herblore | Kwuarm (55) | 242 | Snapdragon, toadflax, dwarf weed, torstol (zie de money making-tabel) |
| Smithing (smelten) | Iron + coal, level 30 | 233 | Mithril 50, adamant 70, rune 85; gold op de Blast Furnace vanaf 40 |
| Hunter | Wagtails en salamanders | 233 | Kebbits en chinchompas (S2) |
| Thieving | Heroes (80) | 159 | Vyres 82 en elves 85 (quests) |

Een bot van level 80 die een actie van level 30 doet, komt dus vooral voor waar de data geen
hogere tier heeft. Het is geen fout in de keuze maar een gat in de data.

## 2. Vechten: de stage volgt de stijl, en de stijl volgt de naam

`TrainCombat` kiest de vijand-band op basis van het level van de stijl die de bot traint, niet op
basis van zijn combat level (`stageFor` en `levelFor`, r. 227-249):

- melee: het laagste van Attack, Strength en Defence;
- ranged: het Ranged-level; magic: het Magic-level.

De stijl zelf ligt per bot vast via een hash van zijn naam (`styleFor`, r. 215-220), niet via zijn
doel of zijn achterstand. Gevolg in de laatste `levels`-regel per bot: 37 van de 180 combinaties
(bot × stijl) zitten twee of meer stages onder het combat level van de bot.

| Bot | Combat | Stijl en level | Band | Band bij zijn combat level |
| --- | --- | --- | --- | --- |
| Patrickbot 13 | 75 | ranged 29 | intermediate (9-27) | expert (45-100) |
| Jorgbot 9, Patrickbot 1 | 60 | ranged 1 | beginner (1-5) | expert |
| Markbot 1 | 58 | ranged en magic 1; in de log gezien in `band=2-13` | novice | advanced (20-45) |

Ranged trainen op lage vijanden met Ranged 1 is wat een speler ook doet. Het probleem zit erin
dat de stijl niet gekozen wordt, en dat één lage melee-stat de hele melee-band omlaag trekt. Voor
een hoge stijl werkt de bestaande ondergrens goed: een bot vecht niet onder 45% van zijn eigen
stijl-level. Een maxed bot die level-20-vijanden slaat, zie ik in de data niet; een combat-60-bot
die op kippen en koeien ranged traint wel.

## 3. Geld verdienen: proberen in plaats van kiezen

| Meting | Waarde |
| --- | --- |
| Geldkeuzes van de planner (`decision.path` = `money`) | 177 |
| Waarvan "geld verdienen (eens proberen)" | 160 (90%) |
| Waarvan thieving | 107 |
| Keuzes op gemeten opbrengst ("~21.858 gp/uur") | 1 |

Gemeten gp/uur per activiteit (mediaan, `job.coinsPerHour`):

| Activiteit | gp/uur | Klussen |
| --- | --- | --- |
| Magic trees | 60.052 | 10 |
| Harpoon fishing | 28.767 | 34 |
| Smelten | 23.868 | 16 |
| Clay (questlus) | 20.256 | 94 |
| Lobster fishing | 19.360 | 30 |
| Knights pickpocketen | 9.497 | 25 |
| Spice stalls | 5.865 | 24 |
| **Gem stalls** | **2.792** | 22 |

Bij een thieving-level van 75 kiest de bot gem stalls, de hoogste stall in de data, maar die
leveren het minst op van alle gemeten methodes. De opbrengst wordt wel gemeten, maar per bot
(`entry.earn`), en "eens proberen" blijft winnen. Andere bots leren er niets van (§25).

## 4. Barrows: 13 runs, 0 met loot

| Afloop | Aantal |
| --- | --- |
| "kan de Barrows niet bereiken" | 5 |
| "komt niet verder (travel)" | 3 |
| "komt niet verder (tunnel 2→0)" | 2 |
| "komt niet verder (tunnel 2→8 / 8→2)" | 3 |

**Reis (regressie van #53).** Sinds Morytania te voet dicht is (`onFoot: false`), komt een bot
zonder Barrows-teleporttablet er niet meer. Markbot 18 startte bij de GE elke 10 seconden een
nieuwe run die meteen stopte ("Begint aan een Barrows-run" → "kan de Barrows niet bereiken" → "0
runs in 0 minuten"). Bots met een tablet (Patrickbot 1, Markbot 16) kwamen wel aan.

**Tunnels.** De Barrows-plugin maakt per run een indeling: 7 open deuren die de 8 buitenkamers
verbinden en één puzzeldeur naar de kistkamer (`randomiseLayout`). De bot krijgt die lijst
(`openDoors` in `barrows:bot-view`) en zoekt alleen een route over open deuren (`routeRooms`). Dat
sommige deuren altijd dicht zijn, weet de bot in de code dus wel: de drie andere deuren naar de
kistkamer gebruikt hij niet. Toch bleef hij hangen op **gewone** open deuren tussen buitenkamers:

- Patrickbot 1: twee runs achter elkaar "van kamer 2 naar kamer 0", vast rond 3568,9711-9718;
- Markbot 16: "van kamer 8 naar kamer 2", vast rond 3568,9677 en 3575,9678.

Mogelijke oorzaken, niet getest:
1. De bot komt niet op de tegel vóór de deur, omdat de monsters die bij het binnenkomen van elke
   kamer verschijnen (`spawnEncounter`) hem aanvallen en zijn looppad onderbreken.
2. `useDoor` werkt alleen als de speler precies op een zijtegel van de deur staat. Klikt de bot
   een tegel ernaast, dan gebeurt er niets en volgt er geen melding.
3. Na het oversteken staat de bot in de gang (`roomAt` = -1) en wacht hij (`room < 0`: "running").

Klopt de observatie van de eigenaar over de puzzeldeur ook voor gevallen die hier niet te zien
zijn, dan zou een mislukte puzzel moeten opduiken als een vastloper bij de stap naar kamer 4.
Die staat niet in deze logs.

---

## Werkpakketten

| Prio | Pakket | Klaar als |
| --- | --- | --- |
| P0 | **A1. Barrows niet kiezen zonder reisweg** (regressie #53): in `canExecute` alleen Barrows als de bot een Barrows-tablet heeft of kan kopen; anders reden `no_travel` en een afkoeling | Geen Barrows-start meer die binnen 1 min op "kan de Barrows niet bereiken" eindigt |
| P1 | **A2. Barrows-tunnels meetbaar maken, daarna repareren**: bij "komt niet verder (tunnel …)" loggen: kamer, deur-varbit, zijtegel, tegel van de bot, in gevecht ja/nee, NPC's in de buurt, laatste klik en het antwoord van de plugin ("This door is locked", puzzel, oversteek). Daarna in game met de agent-MCP | ≥ 80% van de Barrows-runs met loot (pakketpoort PvM) |
| P1 | **A3. Geld kiezen op gemeten clan-opbrengst**: "eens proberen" alleen voor methodes zonder genoeg metingen in de clan (minder dan 5 klussen), en in hooguit 20% van de geldkeuzes; anders de hoogste mediaan gp/uur van de clan die de bot kan doen. Methodes onder een ondergrens (bijv. 5.000 gp/uur) vallen af | Gem stalls niet meer gekozen voor geld; mediaan gp/uur van geldklussen stijgt |
| P1 | **A4. Questlus Doric's Quest**: clay alleen halen als er minder dan 6 in tas en bank zijn; na een `gather` zonder voortgang reden loggen en de quest-stap blokkeren (pakket 5 van de runtime-analyse) | Geen clay-klussen meer boven de 6 per bot |
| P2 | **A5. Plafonds in de data wegwerken**: Prayer (hogere botten), Agility (Pollnivneach, Rellekka, Ardougne), Herblore (hogere potions), smelten (mithril, adamant, rune, Blast Furnace), Thieving (vyres, elves na quests) | Geen bot-minuten meer ≥ 15 levels boven de hoogste activiteit van de skill |
| P2 | **A6. Vechtstijl kiezen in plaats van hashen**: de stijl volgt het doel (een unlock die Ranged of Magic vraagt) of de achterstand; melee-band op het level van de stat die getraind wordt, niet het laagste van de drie | Geen bot meer met een stijl die zijn doel niet dient; aandeel combinaties ≥ 2 stages onder het combat level < 10% |
| P2 | **A7. Metric `action_fit`** bij elke klus: level van de bot, level-eis, beste activiteit voor dat level en de reden van een lagere keuze (quest, geld, afwisseling, plek vol) | Het script is niet meer nodig; de planner ziet het zelf |

A3 sluit aan op Activity Health (pakket 4 van de runtime-analyse): dezelfde gemeten cijfers, nu
voor geld. A5 overlapt met S2 uit de skill-progressie-analyse.

## Findings, Risks, Recommendations, Priority, Expected Value

1. **Findings:** 73% van de skill-tijd past bij het level; de rest komt door een questlus (1.037
   min clay), plafonds in de data en vechtstijlen die per naam vastliggen. Geld kiest in 90% van
   de gevallen "eens proberen", met gem stalls als laagste opbrengst (2.792 gp/uur). Barrows faalt
   13 van 13 keer: reizen kan sinds #53 niet zonder tablet, en in de tunnels blijft de bot hangen
   op open deuren.
2. **Risks:** de Barrows-reisregressie draait elke 10 s een nieuwe run (lusbewaking vangt het niet);
   de tunneloorzaak is niet getest; als A3 te hard kiest, gaan alle bots naar dezelfde plek
   (drukte-regel blijft nodig).
3. **Recommendations:** A1 direct (kleine wijziging, stopt een lus); A2 en A4 met in-game controle;
   A3 als eerste toepassing van gedeelde, gemeten kennis.
4. **Priority:** zie de tabel.
5. **Expected Value:** A4 geeft ~1.000 bot-minuten terug (~10% van de skill-tijd in dit
   venster); A3 vervangt ~2,8k door ≥ 9-28k gp/uur per geldklus; A1 en A2 maken Barrows, de enige
   werkende boss-route, weer bruikbaar.
