# ADR-0005: Eén exemplaar per uitrusting houden, geen stille banklus

- Status: Aangenomen
- Datum: 20-11-2026
- Constitution: §5 (Runtime First), §18 (Recovery: "Nooit eindeloos herhalen"), §19 (Banking), §29 (Observability)

## Context

Metrics van versie `7a8e40b` (17-11-2026, 17:13 tot 22:08, 60 avonturiers):

- 15 avonturiers kregen 4,5 uur lang 0 XP. Elke 5 minuten stonden ze op dezelfde tegel, 4 tot 8
  tegels van een bankpunt, in fase `errand` met reden `bank`. Ze schreven geen enkele regel in het
  activiteitenlog en telden geen event.
- Samen 25% van alle bot-minuten en 42% van alle errand-minuten.
- Na een herstart rond 20:45 begonnen ze opnieuw en bevroren ze binnen 5 minuten weer. Het is
  dus deterministisch.
- Hun tassen: 8 × Staff of fire, 7 × Mystic fire staff, 24 × Adamant axe, 16 × Rune dagger,
  7 × Black d'hide vambraces, enzovoort.

Oorzaak in de code:

1. `Trade.keepIds` geeft een set van item-id's. `Trade.goodsToSell` sloeg elk exemplaar van een
   behouden id over. Acht dezelfde staffs bleven dus allemaal "houden".
2. Bij een volle tas loopt de avonturier naar de bank. Faalt de laatste meters (muur), dan telt
   "binnen 15 tegels" als aangekomen. De bank kreeg niets, want alles was "houden". De volgende
   beslissing zag weer een volle tas en stuurde hem naar dezelfde bank. Geen log, geen event.
3. `deposit()` zette altijd het hele aantal van een item weg, ongeacht het gevraagde aantal.

## Beslissing

- Van uitrusting en gereedschap uit de gear-lijsten (`adventurer-gear.json`: slots, tools,
  styles) houdt een avonturier één exemplaar. Extra exemplaren zijn gewone goederen: bank of GE.
  Voorraad (runes, munitie, teleports), eten, potions en vistuig (zoals bird snares) vallen hier
  niet onder.
- `deposit()` en `clearBag()` zetten weg of laten vallen wat gevraagd is, nooit meer.
- Kan de bank bij een volle tas niets aannemen, dan:
  - schrijft hij "Kan op de bank in ... niets kwijt" in het activiteitenlog;
  - telt hij event `bankNothing` en schrijft hij metric `kind: "bank_nothing"` met de tas;
  - gaat hij 30 minuten niet opnieuw voor een volle tas naar de bank (`FULL_BAG_RETRY_MS`) en kiest
    hij een klus met de tas zoals die is.

## Gevolgen

- De 15 bevroren profielen komen los: ze banken of verkopen hun extra exemplaren.
- Smeedproducten (rune daggers, adamant axes) worden verkocht in plaats van eeuwig bewaard. Dat
  past bij "geld verdienen" uit §12.
- Gedragsverandering: eten boven `FOOD_CARRY` (10) en potions boven `POTION_CARRY` (8) gingen
  voorheen allemaal de bank in; nu blijft de bedoelde hoeveelheid in de tas, zoals het commentaar
  in `goodsToSell` al beschreef.
- Restrisico: een tas vol unieke, behouden uitrusting (bijvoorbeeld een volledige magic- en
  ranged-set tegelijk) blijft vol. Dat is nu zichtbaar via `bank_nothing` en blokkeert niet meer.
