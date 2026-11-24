# Money making: tips uit de OSRS Wiki, doorgerekend met serverprijzen, 24-11-2026

Avonturiers verdienen nu 3.000 tot 33.000 gp per uur (clankennis 23-11: thieving 3-9k, fishing
23-27k, mining ~32k; gem stalls 2,8k). Volgens de OSRS Wiki, doorgerekend met de prijzen en
koopgrenzen van deze server, zijn er op elk level rustige methodes die 0,3 tot 1,4 miljoen gp per
uur opleveren. Vooral verwerking: kopen op de GE, iets maken, verkopen.

- **Bron:** alle 1.134 pagina's "Money making guide/…" van de OSRS Wiki, opgehaald op 24-11-2026
  via de API (50 pagina's per verzoek). 651 hebben een volledige `{{Mmgtable}}` (invoer, opbrengst,
  acties per uur, eisen, plek, intensiteit). Wiki-inhoud valt onder CC BY-NC-SA 3.0.
- **Prijzen:** `server/data/definitions/item-prices.json`, de referentie van de GE op de server
  (momentopname 23-10-2026). Conservatief gerekend: inkopen tegen de hoge prijs, verkopen tegen de
  lage. Koopgrenzen uit `server/plugins/interface/data/grand-exchange.json` (per 4 uur, zoals
  `GrandExchange.plugin.js` ze toepast).
- **Dataset:** [`2026-11-24/money-making-methods.json`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/2026-11-24/money-making-methods.json)
  en `.csv`, gemaakt met [`scripts/mmg_scrape.py`](https://github.com/m4rk4ever-lang/private-project/blob/main/docs/analysis/scripts/mmg_scrape.py)
  (`fetch`, dan `parse`).

## Hoe betrouwbaar

- Van de 651 methodes zijn er 317 zonder vlag `check`. De vlag staat bij combat (droptabellen
  rekenen niet goed om), bij items zonder serverprijs, en waar de serverwinst meer dan 3× afwijkt
  van wat de wiki zelf noemt.
- Waar beide bekend zijn, is de mediaan van serverwinst gedeeld door wiki-winst precies 1,0.
- De tabel hieronder bevat alleen methodes zonder vlag, met een wiki-vergelijking, niet-combat, en
  intensiteit "Low" of "Moderate". Dat zijn er 116.

## De beste methodes per levelband (winst binnen de koopgrenzen)

| Hoogste skill-eis | Methode | gp/uur op de server | Wiki | Inkoop per uur | Eisen | Plek |
| --- | --- | --- | --- | --- | --- | --- |
| geen | Black dragonhide looien | 1.446.077 | 1.147.000 | 8.176.396 | geen | Al Kharid (tanner) |
| geen | Red dragonhide looien | 1.058.327 | 989.000 | 5.513.428 | geen | Al Kharid |
| geen | Green / blue dragonhide looien | 909.500-951.750 | 954.000-1.049.000 | 4.341.253-4.981.799 | geen | Al Kharid |
| 20-39 | Ranarr unf potions (herb + vial of water) | 1.105.500 | 804.000 | 14.459.008 | Herblore 30, Druidic Ritual | GE |
| 20-39 | Toadflax unf potions | 861.250 | 864.000 | 7.002.688 | Herblore 34, Druidic Ritual | GE |
| 20-39 | Steel dart tips | 268.850 | 331.000 | 500.650 | Smithing 34, The Tourist Trap | Varrock West |
| 20-39 | Emerald bracelets | 262.800 | 224.000 | 483.600 | Crafting 30 | Edgeville |
| 40-59 | Bracelets of ethereum laden en alchen | 920.295 | 935.000 | 19.734.705 | Magic 55 | GE |
| 40-59 | Kwuarm unf potions | 884.000 | 1.044.000 | 6.223.168 | Herblore 55, Druidic Ritual | GE |
| 40-59 | Irit unf potions | 562.250 | 928.000 | 3.709.216 | Herblore 45, Druidic Ritual | GE |
| 40-59 | Ruby / diamond bracelets | 319.200-381.600 | 162.000-269.000 | 933.600-1.791.600 | Crafting 42/58 | Edgeville |
| 60-74 | Snapdragon unf potions | 1.188.000 | 920.000 | 18.730.112 | Herblore 63, Druidic Ritual | GE |
| 60-74 | Diamond bolt tips | 965.250 | 1.196.000 | 3.918.180 | Fletching 65 | GE |
| 60-74 | Cadantine unf potions | 891.000 | 776.000 | 4.997.632 | Herblore 66, Druidic Ritual | GE |
| 75-89 | Death runes via de Abyss | 1.726.187 | 2.292.000 | 106.340 | Runecraft 65, Firemaking 75, quests | Death Altar |
| 75-89 | Runite ore | 392.000 | 642.000 | 0 | Mining 85 | o.a. Heroes' Guild |
| 90+ | Rune items smeden | 1.283.333 | 1.316.000 | 30.177.414 | Smithing 99 | anvil |
| 90+ | Master farmers pickpocketen | 964.961 | 832.000 | 0 | Thieving 94, Farming 85 | Ardougne, Draynor |

**Inkoop per uur** is wat een uur van de methode aan materialen kost binnen de koopgrens. Dat geld
komt terug bij de verkoop, maar de bot moet het eerst hebben: het werkkapitaal. De marge per ronde
loopt sterk uiteen: ranarr unf ~7,6% van de inkoop, emerald bracelets ~54%, death runes vrijwel
alles winst. Met weinig kapitaal is een methode met een hoge marge of zonder inkoop dus beter dan de
hoogste uurwinst.

Hoger in de lijst, maar met een kanttekening: Sanfew serum (2,6M, Herblore 65, Zogre Flesh Eaters,
"Moderate" en veel stappen) en black chinchompas (2,1M, Wilderness: niet voor eerlijke bots met
`riskTolerance` laag).

## Tips voor de developer bot

### 0. Kies op kapitaal

- **Weinig kapitaal (onder ~1M gp):** methodes zonder of met weinig inkoop. Runite ore (Mining 85),
  master farmers (Thieving 94), death runes (106k inkoop per uur), steel dart tips en emerald of
  ruby bracelets (0,5-0,9M inkoop, marge 34-54%).
- **Veel kapitaal:** verwerking met een lage marge maar een hoge uurwinst (unf potions, dragonhide
  looien, rune items, bracelets of ethereum). Dat past precies bij de maxed testprofielen met
  honderden miljoenen tot miljarden coins (Markbot 18, Patrickbot 18, Jorgbot 19, …). Die hebben nu
  geen werkende bezigheid (voortgangsanalyse 23-11): dit geeft ze een eerlijk en nuttig doel.

### 1. De keten bestaat al: kies het product op winst, niet alleen op XP

`buyToTrain` koopt materialen, verwerkt en verkoopt weer, "often at a loss, as players do to
train" (`adventurers.json`). Herblore heeft daar al tiers (harralander, ranarr, irit, kwuarm) en
`Trade.sellAtExchange` verkoopt. Wat ontbreekt is de keuze "deze tier levert geld op":

- Per tier de verwachte winst per uur uit deze dataset meegeven (veld `serverProfitPerHourWithinLimits`),
  en de inkoop per uur, zodat de planner kan schalen naar wat de bot kan betalen: winst ≈ marge ×
  besteedbaar kapitaal per ronde.
- In geldklussen (`decision.path = money`) ook de verwerkingsmethodes meetellen die de bot kan
  doen, naast mining en fishing. Dan kiest een bot met Herblore 30 en genoeg kapitaal ranarr unf
  potions (~1,1M/uur) in plaats van gem stalls (2,8k).

### 2. Dragonhide looien: geld zonder skill-eis

De tanner in Al Kharid (Ellis) looit hides voor een vast bedrag; `docs/tanning.md` bestaat, dus de
content staat op de server. Dit past bij nieuwe en zwakke accounts (geen level nodig) die
startkapitaal hebben. Als klus: hides kopen op de GE, naar Al Kharid (tolpoort of een ring of
dueling), looien, terug verkopen. Een nieuwe klus van dezelfde vorm als `buyToTrain`, met de
tanner als station.

### 3. De clankennis een beter startpunt geven

Zonder metingen gebruikt de planner nu een vaste gok (`MONEY_GUESS`, sinds #61 "onder de laagste
meting"). Beter: als beginwaarde de serverwinst uit deze dataset voor methodes die de bot kan doen,
en die vervangen zodra de clan zelf meet. Dan probeert een clan eerst wat volgens de wiki veel
oplevert, in plaats van willekeurig.

### 4. Grenzen die meetellen

- **Koopgrenzen:** de GE van de server hanteert ze per 4 uur. De tabel rekent daar al mee (veld
  `buyLimitShare`: het deel van het uurtempo dat binnen de grens past; ranarr potions 69%).
- **Vultijd:** een order wordt gevuld met een wachttijd die afhangt van het handelsvolume
  (`fillDelayMs`). Bij items met weinig volume (unstrung comp bow: hoog 39.000, laag 938) duurt
  verkopen lang of kost het veel. Zulke methodes hebben in de dataset een vlag of een lage winst.
- **Kapitaal:** voor verwerking moet de bot de inkoop kunnen betalen. Een uur ranarr unf potions
  binnen de koopgrens vraagt ~14,5M gp aan herbs en vials. Kies zo'n methode pas als het vermogen
  dat toelaat (§14), of schaal de hoeveelheid naar het vermogen.
- **Meerdere bots, één markt:** elke bot heeft een eigen koopgrens, maar alle bots verkopen
  hetzelfde product. De GE vult tegen de referentieprijs, dus dat drukt de prijs niet. Wel goed om
  te volgen in de gemeten opbrengst.

### 5. Wat bots nu doen en beter niet meer

- **Gem stalls:** 2,8k gp/uur gemeten, en voor geld de slechtste keuze.
- **Silver en spice stalls:** 3-9k.
- **Mining voor kleine spaardoelen:** verre mijnen en verdringing (validatie `441b072`).

## Werkpakketten

| # | Pakket | Klaar als |
| --- | --- | --- |
| M1 | Winst per tier in `buyToTrain` (uit deze dataset), en verwerking meetellen in de geldkeuze | Geldklussen van bots met Herblore ≥ 30 kiezen potions; mediaan gp/uur van geldklussen ≥ 100k |
| M2 | Dragonhide looien als klus (tanner in Al Kharid) | Bots zonder skill-eis met kapitaal verdienen > 500k gp/uur |
| M3 | Clankennis start met de serverwinst uit de dataset in plaats van een vaste gok | Geen "schatting"-keuzes meer waar de dataset een waarde heeft |
| M4 | Kapitaaltoets en schaling: inkoop per ronde naar het vermogen; bots onder ~1M gp krijgen methodes met hoge marge of zonder inkoop | Geen klus die stopt op "te weinig geld" halverwege |
| M6 | Maxed accounts verwerken met hun kapitaal (unf potions, rune items, dragonhide) als `endgame`-geldklus | Maxed accounts hebben een klus met > 500k gp/uur in plaats van roam of een boss-lus |
| M5 | Dataset verversen als `item-prices.json` verandert (`mmg_scrape.py parse`) | Datum van de dataset ≥ datum van de prijzen |
