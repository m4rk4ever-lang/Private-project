# AI Handover

Overdracht tussen sessies aan het Adventurer Platform. Bovenaan staat de nieuwste sessie. Lees
eerst [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) en [RUNTIME_POLICY.md](RUNTIME_POLICY.md).

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
