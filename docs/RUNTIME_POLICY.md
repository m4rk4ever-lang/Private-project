# Runtime Policy

Werkregels voor iedereen (mens of agent) die aan het Adventurer Platform werkt. Ze volgen uit
[`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md) §2, §5, §18 en §34, en uit
[ADR-0003](adr/0003-runtime-logs-sturen-prioriteit.md) en
[ADR-0004](adr/0004-beschermde-functionaliteit.md). Technische regels voor plugins staan in
`server/AGENTS.md`; de eerlijkheidsregels voor bots in `server/docs/agents/adventurers.md`.

## 1. Bewijs eerst

- Begin elke sessie met de logs van `bot-logs` (recept in [OBSERVABILITY.md](OBSERVABILITY.md)).
- Analyseer per serverversie (`v`). De nieuwste versie telt; oudere regels laten zien of iets al
  opgelost is.
- Rangorde van bewijs: failures en stuck-events > runtime-metrics > observed behaviour in game >
  meldingen van de eigenaar > eigen hypotheses. Simulaties zijn geen bewijs.
- Kies werk op gemeten impact: bot-minuten, aantal getroffen bots, events per uur.
- Noem het bewijs in het commitbericht of in code-commentaar (logsoort, bot, versie, datum).

## 2. Eén probleem per keer

- Werk aan één hoofdprobleem per sessie. Geen meerdere subsystemen tegelijk.
- Geen grote rewrites ([ADR-0002](adr/0002-adventurer-platform-evolueert-binnen-plugins-bots.md)).
- Volg: Observe, Analyze, Identify Root Cause, Implement Small Change, Validate, Deploy (§34).

## 3. Geen eindeloze herhaling

- Elke lus die iets opnieuw probeert heeft een grens: een maximum aantal pogingen, een tijd of
  een afkoelperiode (§18).
- Elke herhaling of fallback schrijft een event (`countEvent`) of metric. Stil falen is een bug.
- Bij falen: Analyse, Recovery, Retry. Recovery-middelen die er al zijn: repath via de
  routeplanner, `blockedPlaces`, `noErrandUntil`, `unstrand` (home teleport na 3 keer vast op
  dezelfde plek), `clearBag`, de errand-watchdog.

## 4. Valideren

- Draai de bot-tests voor en na de wijziging en vergelijk het aantal fouten. Zonder cache en
  gebouwde TypeScript-core falen er in een kale omgeving 16 van de 109 (stand 20-11-2026); dat
  aantal mag niet stijgen.

  ```bash
  cd server && node --test tests/bot-*.test.cjs tests/player-bot-*.test.cjs
  ```

- Een gevonden failure krijgt waar mogelijk een unit-test die hem naspeelt.
- Controle in game via de agent-MCP op de eigen worktree-poort (`server/docs/agents/testing.md`).
- Na deploy: bevestig in de nieuwe logs (nieuwe `v`) dat het probleem weg is.

## 5. Beschermd

Niet verwijderen of verslechteren: huidige Adventurers, bestaande logging, QuestHelper-
integraties, clans, dashboard, `::volg` ([ADR-0004](adr/0004-beschermde-functionaliteit.md)).
`generation` niet verhogen zonder expliciete vraag van de eigenaar.

## 6. Eerlijk spel

Niets uit het niets, alleen echt speelbare content, lopen of echte teleports, echte interfaces
(`server/docs/agents/adventurers.md`, "Rules that never bend"). Bouw geen RuneScape-, combat- of
economy-simulator (§3).

## 7. Afronden

- Changelog-regel in het Nederlands onder "Nog niet uitgebracht" (root `AGENTS.md`).
- Werk [AI_HANDOVER.md](AI_HANDOVER.md) bij: onderzocht, gevonden, aangepast, risico's,
  volgende stap.
- Een beslissing met gevolgen voor later krijgt een ADR in [`docs/adr/`](adr/README.md).
