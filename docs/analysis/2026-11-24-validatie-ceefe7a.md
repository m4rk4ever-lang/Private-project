# Validatie van `ceefe7a` (#72) en de oorzaak van de Barrows-tunnels, 24-11-2026

`ceefe7a` (#72: bank-pingpong) draaide op 23-11 van 14:11 tot 15:21 UTC: 70 minuten, 59 bot-uren.
Dat is boven de 60 minuten, dus de cijfers tellen. Daarna kwamen er geen logs meer op `bot-logs`
(tot het moment van schrijven, 24-11 10:30): de server staat sindsdien stil.

## Kerncijfers

| Meting | 21-11 | #68 + #70 | **#72** |
| --- | --- | --- | --- |
| OSRS-XP per bot-uur | 15.017 | 25.306 | **25.465** |
| Lussen per bot-uur | 0,36 | 0,88 | **0,44** |
| Vastlopers per bot-uur | 1,61 | 0,90 | 1,19 |
| `walk_blocked` per bot-uur | 2,49 | 1,24 | 1,29 |
| Combat `stuck` | 62/82 | 0/46 | 1/33 |
| Quests gehaald | 6/95 | 0/31 | 2/22 |

## Bank-pingpong: opgelost

Geen enkele bot haalde in dit venster hetzelfde item ≥ 5 keer op en zette het ≥ 5 keer terug
(bij #68 + #70: Slayed Soul 155×, Jorgbot 7 105×). De nieuwe detector ging 3× af
(`bank_pingpong`). De lussen per bot-uur halveerden.

## Barrows-tunnels: de oorzaak, nu met bewijs

De telemetrie uit #68 (`lastDoor`, `room`, `doorTries`) laat het zien. Vier runs, alle vast:

| Bot | Stap | `lastDoor` | Positie bij falen |
| --- | --- | --- | --- |
| Markbot 14 | 2→0 | `crossed`, deur 469 op 3568,9718, vanaf 3568,9717, kamer 2 | 3568,9718, kamer 2 |
| Markbot 18 | 0→1 | `crossed`, deur 472 op 3541,9712, vanaf 3540,9712, kamer 0 | 3541,9712, kamer 0 |
| Patrickbot 15 | 6→7 | `crossed`, deur 482 op 3541,9678, vanaf 3540,9678, kamer 6 | 3541,9678, kamer 6 |

**Wat er gebeurt:**
1. De bot staat op de ene zijtegel (bijvoorbeeld 3540,9712) en klikt de deur. De plugin steekt hem
   over (`crossed`) naar de andere zijtegel, en dat is de deurtegel zelf (3541,9712;
   `doorSides` geeft de tegel ervoor en de deurtegel).
2. `roomAt` rekent alles binnen 7 tegels van een kamermidden tot die kamer. Het midden van kamer 0
   is 3534,9712, dus 3541 hoort nog bij kamer 0. Voor de bot is hij niet verder gekomen.
3. De route zegt opnieuw "van kamer 0 naar kamer 1", via dezelfde deur. Beide zijtegels horen bij
   kamer 0, dus de bot neemt de dichtstbijzijnde (waar hij staat), klikt, en steekt terug over.
4. Na 4-10 minuten geeft hij op.

De echte gang naar de volgende kamer begint pas voorbij de deurtegel (bij deur 472 vanaf 3542). De
fix van #64 ("door de gang") werkt alleen als `roomAt` -1 geeft, en dat gebeurt hier nooit.

**Voorstel:**
1. Na `crossed` niet opnieuw de kamer bepalen met `roomAt`, maar doorlopen in de richting van de
   deur, naar het midden van de kamer waar de route heen wil (de route kent die kamer al). Pas daar
   verder plannen.
2. Of: de zijtegels van een deur niet met `roomAt` aan een kamer koppelen, maar aan de kamer aan
   hun kant van de deur (de koppeling `DOOR_LINKS` zegt welke twee kamers het zijn).
3. Unit-test met de vier gevallen hierboven: na `crossed` moet de volgende stap naar de nieuwe
   kamer gaan, niet terug door dezelfde deur.

## Fout in de telemetrie: `at` overschreven

In `barrows_run` staat in het veld `at` de positie (`"at":[3568,9718,0]`) in plaats van de tijd.
Elke metric-regel gebruikt `at` als tijdstempel; analyses die op tijd sorteren of filteren slaan
deze regels over of breken (dat gebeurde in de analysescripts). De positie hoort in een eigen veld,
zoals `where` bij de andere metrics.

## Verder

| Onderwerp | Bewijs | Voorstel |
| --- | --- | --- |
| Construction | 9× `stuck` bij `construction_house`, alle `construct house=false hotspot=- built=0` | De bot start de klus zonder huis. De huis-aankoop gaat eerst (`construction:buy-house`); controleren in `canExecute` dat er een huis is of gekocht kan worden |
| Fishing Guild | 18× `walk_blocked` (#68 hielp eerst, nu weer in de top) | De bank-tegel van het gilde nakijken |
| Lussen | Jorgbot 12 naar Ardougne Noord en Zuid, Markbot 12 naar Seers' Village en Catherby | Markbot 12 is al drie versies het geval met de meeste lussen en de minste XP. In game nakijken |
| Nul-XP | Kram539 haalde 0 XP in het hele venster | In game nakijken |
| Trage beurten | 4×: yew trees 1,4 s, combat 1,4-1,5 s (2×), Seers' rooftop 2,8 s | Geen nieuwe soort |
| Dood | Jorgbot 5 (combat 69), zonder eten, "geen aanvaller gezien", tijdens een errand | |
| Quests | 2 van 22 gehaald | Pakket 5 |
