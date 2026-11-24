# Sailing voor bots (24-11-2026)

Roadmap Fase 6, "Sailing, stappen" 1: meten wat de Sailing-plugin een bot laat doen zonder boot.
Branch `adventurers/sailing-stap1`.

## Bewijs (bot-logs 23-11-2026, laatste `levels` per bot, versie `ceefe7a16`)

- 60 avonturiers, Sailing gemiddeld 24,7: 33 op 1, en 6× 12, 6× 40, 6× 60, 6× 80, 3× 99. Dat zijn
  de startniveaus van de testaccounts; in geen enkele `job`, `skills` of `activity`-regel komt
  Sailing-XP voor.
- `decision`: 20× `quest_gap` voor Fallen From Grace met `missing.skills.SAILING` 62 en
  `missing.quests` ["Pandemonium"]. De planner traint dan iets anders (combat, mining), want er is
  geen modus die Sailing traint.
- Geen enkele regel in `adventurer-quest-feedback.jsonl` noemt Pandemonium: geen bot probeert hem.

## Wat een bot nodig heeft

| Stap | Wat de plugin vraagt | Stand voor bots |
| --- | --- | --- |
| Quest | `Pandemonium.Quest.js` (1.989 regels, stages 0-50, varbit 18314): Will en Anne op de kade van Port Sarim, de tutorialboot met roer en zeilen, het wrak, Junior Jim, de raft, een vaartocht naar Port Sarim met een krat. Beloning 300 Sailing-XP, +100 voor de krat (taak 599). | Geen bot-playthrough (`quest-playthroughs.json` heeft alleen Rune Mysteries) en niet in de Quest Helper-catalogus (`tools/quest-helper-bridge/.../catalog.json`). `helperAll` helpt dus niet. |
| Boot | De raft komt alleen uit Jims dialoog (`GIVE_CUP_MESSAGE_ID` → `grantRaft` → `Sailing.giveBoat(player, "raft", dock)`, stage 28). Geen login- of stage-hook. Na de quest verkoopt elke shipwright boten (Buy-boat, `BoatShop.Sailing.js`, munten); vóór de quest weigert hij (`Pandemonium.Shipwright.js`). | `grantedQuests` zet alleen de stage: de quest is "voltooid", maar er is geen raft en geen 300 XP. Pandemonium staat ook niet in die lijst. Een eerlijke tweede weg is quest + een gekochte boot. |
| Aan boord | `Gangplank.Sailing.js` (Board), kern `Sailing.board(player, dockId)` met `boardRefusal`; event `sailing:can-board`. | Niet gebouwd. Kan via de echte object-actie "Board" op de loopplank, zoals bij andere objecten. |
| Aan het roer | Helm-loc "Navigate" (`Helm.Sailing.js`), daarna sturen met `BoatManager.steerToward(player, x, y)` (een klik op zee) of `setHelmHeading(player, 0-15)` (het SetHeading-pakket). Eerste koers zet volle zeilen. Gusts en Trim (`Trim.Helm.js`, events `sailing:gust`, `sailing:trimmed`) zijn een bonus. Disembark of dock op de loopplank van de bestemming. | Niet gebouwd. Een bot heeft geen client: hij moet de koers zelf kiezen (16 richtingen) en `BoatManager.isSailable` volgen; er is geen zee-routeplanner. Dat is de grootste stap. |
| Havenklus | Courier: board (Inspect) → Accept → Take-cargo bij de ledger → varen → Deposit-cargo bij de bestemming (`PortTasks.Sailing.js`, `porttasks/`). Level 1-taken: Port Sarim ↔ The Pandemonium (78-155 XP, 1 krat). Eis alleen het Sailing-level (`Board.PortTasks.js`). | Niet gebouwd. Port Sarim ↔ Pandemonium is een eiland: zonder te varen geen aflevering. |

## Eenvoudigste eerlijke Sailing-XP

1. **Pandemonium zelf (400 XP)**: speelbaar en eerlijk, maar lang en vol scènes (tutorialboot, roer,
   haak, cutscene), en geen Quest Helper-route. Een hand-geschreven playthrough moet stap 2
   (roer en koers) al kunnen. Niet klein.
2. **Courier Port Sarim ↔ Pandemonium (78-155 XP per taak)**: na quest en boot de kortste lus,
   maar vraagt varen (stap 2).
3. Crystal extractor (250 XP per mote) en bergen vragen een gebouwde faciliteit op een skiff.

Er is dus geen Sailing-XP zonder te varen. De eerste bouwstap is stap 2: één vaste route
Port Sarim ↔ The Pandemonium (aan boord, Navigate, koersen langs vaste zee-tegels, docken). Daarmee
worden zowel de Pandemonium-playthrough als de courierklus haalbaar.

## Gebouwd (stap 1, alleen meten)

- `Requirements.sailingReadiness(facts)` (puur): nooit `ok`; `why` is de eerste ontbrekende stap:
  `no_quest_playthrough` (Pandemonium niet gedaan, geen bot-playthrough), `quest_missing`
  (niet gedaan, wel speelbaar), `no_boat` (voltooid zonder boot, `granted` als `grantedQuests` het
  deed), `no_sailing_brain` (boot, maar geen bot die vaart; `boats` als `raft@the_pandemonium`).
- `precheck` zet dat in `decision.blocked.sailing` (alleen bij `attempt` 0). Er komt geen modus
  bij: de planner kiest Sailing niet, hij zegt alleen waarom niet.
- Tests (`tests/bot-requirements.test.cjs`): de vier redenen, en dat `Sailing.giveBoat` in
  `Pandemonium.Quest.js` alleen in `grantRaft` staat en `grantRaft` één keer wordt aangeroepen
  (Jims dialoog). Komt er een andere weg naar de raft, dan faalt die test en moet `no_boat` mee.

## Bevestigen in de logs

`decision.blocked.sailing.why` = `no_quest_playthrough` voor alle 60 bots, met `detail.stage` 0.
Een ander antwoord (een `stage` > 0, `no_boat`) betekent dat iemand de quest of de boot anders
heeft gekregen dan verwacht.

## Volgende

- Stap 2 met de eigenaar in de game: één bot, `::raft` (developer-commando, alleen om te testen,
  niet voor avonturiers), Board → Navigate → vaste koers Port Sarim ↔ Pandemonium → dock. Metric
  `sailing` (`boarded`, `route`, `arrived`, `xp`).
- Daarna Pandemonium als playthrough, of (beslissing eigenaar) Pandemonium in `grantedQuests` plus
  een gekochte raft bij een shipwright; dat laatste geeft geen 400 XP en zou eerlijk moeten blijven
  (munten uit eigen verdienste).
