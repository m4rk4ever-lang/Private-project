# ADR-0001: AI_Constitution.md is de bron van waarheid

- Status: Aangenomen
- Datum: 20-11-2026
- Constitution: hele document ("Status: Source of Truth")

## Context

Het project had al veel werkdocumenten over bots en avonturiers
(`server/docs/agents/adventurers.md`, `server/docs/ai-bots.md`, sessienotities in de CHANGELOG).
Die beschrijven wat er gebouwd is en wat de volgende stap is, maar niet waarom. Op 20-11-2026 is
`AI_Constitution.md` toegevoegd in de root van de repository. De opdrachtgever verwijst er ook naar
als `/docs/AI_CONSTITUTION.md`; dat bestand bestaat niet.

## Beslissing

- `AI_Constitution.md` in de root is de enige bron van waarheid voor visie, filosofie en
  architectuurlagen. Agents lezen het volledig voordat ze aan het Adventurer Platform werken.
- De visie wordt niet aangepast, samengevat of geherformuleerd in andere documenten. Andere
  documenten verwijzen naar paragrafen (bijvoorbeeld "§7 Requirement Validation First").
- Er komt geen kopie in `docs/`. Twee kopieën lopen uit elkaar. Wil de eigenaar het bestand
  verplaatsen naar `docs/AI_CONSTITUTION.md`, dan is dat een `git mv` plus het bijwerken van de
  links in `docs/` en deze ADR.
- Operationele regels die uit de constitution volgen staan in
  [`RUNTIME_POLICY.md`](../RUNTIME_POLICY.md). De vertaling naar code staat in
  [`ARCHITECTURE.md`](../ARCHITECTURE.md#adventurer-platform).

## Gevolgen

- Eén plek om de richting te toetsen. Bij twijfel wint de constitution boven werkdocumenten.
- `server/AGENTS.md` en `server/docs/agents/adventurers.md` blijven gelden voor de technische
  regels (plugins, eerlijkheid, cache-id's). Ze spreken de constitution niet tegen.
- Open punt voor de eigenaar: de gewenste locatie van het bestand (root of `docs/`).
