# Voortgang sinds 21-11 en wat nog aandacht vraagt, 23-11-2026

Kritische terugblik over alle logs van 21-11 tot 23-11 11:05 UTC (36.651 metric-regels,
samengevoegd uit alle kopieën van `bot-logs`). Per periode dezelfde cijfers, genormaliseerd per
bot-uur. XP is omgerekend naar OSRS-XP (gedeeld door de tier-factor van `TieredExperience` op het
level van dat moment), zodat het echte voortgang meet.

## Kerncijfers per periode

| Meting | 21-11 nulmeting | 22-11 #57 | 23-11 #61 | 23-11 #64 | 23-11 #66 |
| --- | --- | --- | --- | --- | --- |
| Bot-uren gemeten | 160 | 34 | 18 | 71 | 45 |
| **OSRS-XP per bot-uur** | 15.017 | 18.998 | 12.901 | 18.288 | **20.895** |
| **Tijd in blokken met XP** | 53,8% | 67,2% | 54,8% | 60,4% | **62,4%** |
| "Werken" (eigen tijdsindeling) | 17,0% | 20,0% | 11,9% | 17,1% | 17,8% |
| Lopen + errand | 55,0% | 52,3% | 57,5% | 64,3% | 58,7% |
| Idle | 15,4% | 14,8% | 10,1% | 10,9% | 10,1% |
| Vastlopers per bot-uur | 1,61 | 2,41 | 1,44 | 1,07 | **0,80** |
| `walk_blocked` per bot-uur | 2,49 | 2,47 | 2,26 | 1,75 | **1,41** |
| Home teleports (`stranded`) per bot-uur | 0,36 | 0,38 | 0,33 | 0,23 | **0,16** |
| Combat-klussen `stuck` | 62/82 | 18/22 | 0/3 | 0/28 | **1/30** |
| Doden | 3 | 2 | 0 | 0 | 1 |
| Quests gehaald | 6/95 | 2/15 | 0/8 | 1/32 | 2/18 |

\#61 is net na een herstart gemeten (veel `new` en reistijd) en daardoor lager.

## Wat er echt beter is

- **Voortgang:** +39% OSRS-XP per bot-uur (15,0k → 20,9k), en het deel van de tijd waarin een bot
  XP haalt steeg van 54% naar 62%.
- **Combat-training:** van 76% vastgelopen klussen naar 3%. Dit is de grootste enkele winst
  (buitlus, #61).
- **Robuustheid:** vastlopers per bot-uur −50%, geblokkeerde routes −43%, home teleports −56%.
- **Losse lussen opgelost:** agility-lag, Barrows zonder reisweg, clay-lus, Morytania, banken.
- **Kennis:** elke clan heeft 28-37 gemeten activiteiten, bewaard over herstarts, en de geldkeuze
  gebruikt ze.

## Kritische kanttekeningen

### 1. De maatstaf "werken" deugt niet

27% van de XP van vandaag werd verdiend in 5-minutenblokken waarin "working" vrijwel 0 was. Bij
yew trees is dat 95%, bij combat-training 73%, bij lobster fishing 31%. De tijdsindeling (`time`)
noemt hakken tussen bomen en achter een vijand aan lopen "walking". Daardoor:
- staat het werkaandeel al drie dagen stil rond 17%, terwijl de XP met 39% steeg;
- leek het lopen bij #64 te verdubbelen. Een deel daarvan is combat dat weer werkt, en geen
  verspilling.

**Voorstel:** de tijdsindeling baseren op "deze tick XP of een actieve skilling-animatie", niet op
bewegingstoestand. Tot die tijd "tijd in blokken met XP" en OSRS-XP per bot-uur als kerncijfers
gebruiken. Die staan nu in deze tabel; zet ze in `version_report.py` en STATUS.

### 2. Lopen plus errand is niet gedaald

Van 55% naar 59%. Errand daalde (36% → 27%), lopen steeg (19% → 32%). Ook met de meetfout van punt
1 blijft verplaatsing de grootste post. De hefbomen staan al in de runtime-analyse: transport als
route-optie (§16; 83% van de lange errands zonder teleport) en klussen dichter bij de bank. Daar is
nog niets aan gebouwd.

### 3. Quests staan stil

6-11% gehaald, in elke periode. De vroege-levelquests (The Restless Ghost, Imp Catcher, Witch's
Potion, Doric's Quest, Sheep Shearer) falen nog steeds op "step did not advance" en "too many
tries". Zonder quests komt er geen unlock-graaf, geen Fase 5 en geen pad naar de capes. **Dit is nu
het grootste ongebouwde pakket (pakket 5).**

### 4. Breedte van de progressie

Vandaag in alle 28 vensters onaangeroerd: Runecraft (hold), Construction, Hunter, Sailing; Herblore
in 27, Fletching in 22, Ranged in 19.
- **Hunter** draait wel (81 min idle bij crimson swifts) maar levert 0 XP: verspilde tijd ondanks
  de hold op de slechtste plekken.
- **Herblore en Fletching** zijn niet kapot, maar worden nauwelijks nog gekozen (1 Herblore-klus
  vandaag; op 21-11 waren het er honderden). Mogelijk door de hogere tiers (A5): duurdere
  materialen, of de clankennis die ze laag waardeert. Nagaan in de `decision`-gewichten.

### 5. Maxed accounts doen niets nuttigs

Jorgbot 19, Markbot 18 en Patrickbot 18 hebben alles op 99 (total 2.376) en winnen dus geen levels.
Voor hen is bossing en geld het doel (`endgame`). In de praktijk: Markbot 18 zit in de Barrows-lus
(errand en vastlopen in de tunnels), en Patrickbot 18 roamt met trage beurten. Zolang Barrows en
Giant Mole niet werken, heeft de eindfase geen werkende activiteit. **De andere boss-plugins
(Scurrius, Sarachnis, KBD, …) zijn voor deze bots de snelste winst.**

## Wat er tussenuit springt en extra aandacht nodig heeft

| # | Onderwerp | Bewijs | Waarom het tussen wal en schip valt | Voorstel |
| --- | --- | --- | --- | --- |
| 1 | **Markbot 12: 2,2 uur vast bij Seers' Village** | 28 blokken "waiting", 0 XP, rond 2696,3491. De lusbewaking ging 11× af ("8 keer in 1 min naar Seers' Village (bank)"), elke keer 15 min rust, daarna opnieuw | De lusbewaking stopt de boodschap 15 min, maar lost de oorzaak niet op en escaleert niet | Na 2 `loop`-events op hetzelfde doel: die bank 2 uur uitsluiten (faalgeheugen) en een andere bank kiezen. Seers' bank-tegel (2725,3491) in game nalopen; hij staat ook in de top van `walk_blocked` (2717,3482) |
| 2 | **Jorgbot 14 en Patrickbot 11: mithril zonder één erts** | Elk 2,2 uur `mithril_rocks`, 0 XP. Jorgbot 14 staat om de 5 min afwisselend bij Lumbridge Swamp (3146,3143) en Al Kharid (3304,3311) | De drukte-regel (#66) verdeelt over plekken, maar een bot die bij een bezette rots komt, wisselt meteen van mijn in plaats van te wachten op respawn | Een gekozen mijnplek minstens 5 min vasthouden en wachten op respawn, zoals een speler; pas wisselen na langer niets |
| 3 | Idle-tijd per activiteit | Vandaag: harpoon fishing 148 min, gem stalls 138, mithril 102, crimson swifts 81, farming Falador 78 | Idle wordt per bot niet als probleem gezien | Harpoon: vist de bot op een plek die verplaatst is (`active=false` bij de haaienplek)? Gem stalls: wachten op respawn en lage opbrengst; schrappen als geldmethode |
| 4 | Doel van een klus past niet bij de klus | Jorgbot 14 mijnt mithril voor "1.439 gp voor amulet of strength" | Spaardoelen kiezen de "beste" geldmethode, ook voor kleine bedragen | Voor een klein bedrag de snelste geldbron in de buurt kiezen, niet een verre mijn |
| 5 | Herblore, Fletching, Ranged bijna niet getraind | Zie kanttekening 4 | Geen pakket dekt het | Gewichten in `decision` nalopen; Activity Health (pakket 4) zou dit zichtbaar maken |
| 6 | Maxed accounts | Zie kanttekening 5 | Endgame hangt aan twee kapotte bosses | Eén werkende boss toevoegen (Scurrius of Sarachnis) voor de endgame-bots |
| 7 | Quests | Zie kanttekening 3 | Elk validatierapport noemt het, nog niet gebouwd | Pakket 5 als eerstvolgende grote klus |

## Aanbevolen volgorde

1. **Kerncijfers repareren** (kanttekening 1): zonder betrouwbare maatstaf is elke volgende
   vergelijking twijfelachtig. Klein en direct nuttig.
2. **De twee chronische nul-XP-patronen** (#1 en #2): samen 3 bots, ~6,6 bot-uur vandaag zonder XP.
3. **Pakket 5 (quests):** het grootste ongebouwde onderdeel voor progressie.
4. **Een werkende boss voor de maxed accounts.**
5. **Verplaatsing:** transport als route-optie (runtime-analyse, §15-16).
