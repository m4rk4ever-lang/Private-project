# Validatie van `4baf1a2` (#61, #63, #64), 23-11-2026

De server draaide `4baf1a2` van 08:46 tot 09:27 UTC (41 minuten, 60 avonturiers, 2.383
bot-minuten). Daarin zitten #61 (holds, clay, buitlus, molshoop, eten bij zakkenrollen,
`brainSnapshot`), #63 (Farming direct bij de patch, `Wander` met `describe`) en #64
(Barrows-tunnels, A2). Voorlopig: korter dan 60 minuten. Gemeten met
`scripts/version_report.py --group "64=4baf1a2cc"`.

**Kort:** combat-training werkt weer (0 van 13 klussen vast, was 80%), er waren geen trage beurten
en geen doden. Het nieuwe grootste lek is mining: 17 bots verdringen elkaar bij een handvol
mithril-rotsen en lopen 80% van hun tijd heen en weer tussen twee mijnen.

## Wat werkt

| Onderdeel | Gemeten | Vorige meting |
| --- | --- | --- |
| Combat-training (buitlus, pakket 13) | **13 klussen, 0 `stuck`**; ~1,7M combat-XP | 21-11: 108 van 135 `stuck`; #57: 18 van 22 |
| Trage beurten | **0** in 41 min | 7 in 43 min (#57) |
| Doden | 0 | Eeshwar 2× zonder eten (#57) |
| Holds | 0 regels Giant Mole of Runecrafting | 9 regels (#57) |
| Clay-lus | 0 questklussen tot een volle tas | 16-23 per versie |
| Farming (#63) | 8 klussen (5 `time up`, 2 `stuck`, 1 `full bag`), 4.725 Farming-XP; `describe` toont `tries=[2,2,2]`, dus er is nu geplant | Alle 6 vastlopers van #61 waren Farming, `tries=[]` |
| Clankennis | 28-34 gemeten activiteiten per clan; 13 van 14 geldkeuzes op metingen | |

## Tijd

| Meting | #57 (eerste 43 min) | **`4baf1a2`** |
| --- | --- | --- |
| Werken | 20,0% | 17,1% |
| Lopen | 19,8% | **39,3%** |
| Errand | 32,5% | 25,1% |
| Idle | 14,8% | 11,8% |

Het lopen verdubbelde. Waar het vandaan komt (looptijd per activiteit, in bot-minuten):

| Activiteit | Lopen | Totaal | Aandeel |
| --- | --- | --- | --- |
| mithril_rocks | 319 | 392 | 81% |
| combat_training | 173 | 342 | 51% |
| adamantite_rocks | 113 | 144 | 78% |
| agility_varrock | 94 | 105 | 90% |
| yew_trees | 76 | 98 | 78% |

Combat loopt nu juist omdat het weer werkt: de bots vinden doelen en lopen ernaartoe. Mining en
agility_varrock zijn het probleem.

## Nieuw: verdringing bij mining

- **17 bots** deden mithril of adamantite tegelijk. Ze pendelen tussen de mijn in Lumbridge Swamp
  (rond 3145,3145) en die van Al Kharid (rond 3300,3285). Markbot 5 stond 25 minuten op
  "walking" rond 3147,3145 en kreeg maar af en toe XP.
- `bot-activities.json`: `mithril_rocks` heeft `capacity: 160`, `adamantite_rocks` 80. In
  werkelijkheid zijn er per mijn maar een paar van die rotsen. De capaciteit remt dus niets af.
- Waarom zoveel tegelijk: redenen in de `bot`-regels "afwisseling" (23), "geld verdienen (~32.061
  gp/uur, clan)" (14), en spaardoelen (25). De clankennis zegt dat mining veel oplevert, en
  meerdere bots van dezelfde clan kiezen het dan. Dat is het kudde-risico dat bij A3 al was
  genoemd.
- Onderweg 14× "Vond de jump-to broken raft naar Al Kharid niet": de route gebruikt een shortcut uit
  `transports.json` waarvan de bot het object niet vindt (`Adventurers.PlayerBots.js`, r. 1680).

**Voorstel:**
1. Capaciteit per activiteit = het aantal echte rotsen op de plekken die de bot kent (te tellen uit
   de map-objecten per site), niet 160.
2. In de geldkeuze en de gewogen keuze: de verwachte opbrengst delen door de drukte (bots van alle
   clans op die activiteit). Een clanmeting van 32k gp/uur geldt voor één bot op vrije rotsen, niet
   voor de zeventiende.
3. Een shortcut die de bot niet vindt (`hop` zonder object) 30 min uitsluiten in de routeplanner,
   met reden in het faalgeheugen; nu probeert elke bot hem opnieuw.

## Verder open

| Onderwerp | Bewijs | Voorstel |
| --- | --- | --- |
| Agility | 11× `stuck` bij Seers, allemaal `runCourse seers obstacle=5`; ook Falador 4, Gnome 3. agility_varrock 90% lopen | Obstakel 5 van Seers in game nakijken (vermoedelijk dezelfde dakproblemen als op 21-11). Varrock: waarom zoveel lopen per ronde? |
| Vastlopers zonder activiteit | 16×, rond Draynor (3092,3268; 3116,3246) en Lumbridge, reden "nieuwe taak" | Bots die een nieuwe Slayer-taak gaan halen; de taakmeester-route nakijken |
| Paden | `walk_blocked` naar Wizards' Tower 8×, naar 3190,3273 8× (Jorgbot 3 vanaf 2497,3389, `door.outcome = none_helps`), naar Ned 8× (Patrickbot 12), desert wolf 6×, Veos 6× | Wizards' Tower staat in elke versie in de top: de route (brug, eiland) nakijken |
| Barrows (#64) | Geen runs in dit venster | Volgende meting |
| Quests | 1 van 12 gehaald (Romeo & Juliet) | Pakket 5 |

## Volgende stap

1. Mining-verdringing: echte capaciteit per plek en drukte in de geldkeuze.
2. Seers obstakel 5.
3. Pakket 5 (quest-verificatiecontract): quests leveren vrijwel niets op.
4. Na 60 minuten: Barrows en Farming opnieuw meten.
