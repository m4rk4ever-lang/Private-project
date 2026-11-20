# ADR-0003: Runtime-logs bepalen de prioriteit

- Status: Aangenomen
- Datum: 20-11-2026
- Constitution: §5 (Runtime First Principle), §32 (Replay & Diagnostics), §34

## Context

De server schrijft drie JSONL-logs en deelt ze elke 5 minuten op de branch `bot-logs`
(zie [OBSERVABILITY.md](../OBSERVABILITY.md)). Elke regel draagt `v`, de korte git-commit. Eerdere
sessies kozen hun werk vaak uit meldingen van de eigenaar of uit eigen ideeën. Op 20-11-2026 liet
één analyse van de logs zien dat 15 van de 60 avonturiers 4,5 uur stilstonden zonder één logregel.
Geen melding of hypothese had dat gevonden.

## Beslissing

- Een sessie begint met het ophalen van `bot-logs` en een analyse per serverversie (`v`), de
  nieuwste eerst. Werk wordt gekozen op gemeten impact: bot-minuten, aantal getroffen bots,
  events.
- Een fix noemt in code-commentaar of commitbericht het bewijs (logsoort, bot, versie).
- Simulaties en hypothetische scenario's zijn geen reden voor werk. Een unit-test die een
  gevonden failure naspeelt is wel gewenst.
- Elke nieuwe herhaallus of fallback moet een event of metric schrijven. Stil falen is een bug.

## Gevolgen

- Prioriteit is uitlegbaar en herhaalbaar.
- Logs met een cap van 20.000 regels dekken soms maar een paar uur; een lange run kan
  onderbelicht zijn. Zie de risico's in [AI_HANDOVER.md](../AI_HANDOVER.md).
