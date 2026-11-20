# Architecture Decision Records

Elke ADR legt één beslissing vast: de context, de keuze en de gevolgen. Een ADR wordt niet
herschreven. Verandert een beslissing, dan komt er een nieuwe ADR die de oude vervangt
(status "Vervangen door ADR-xxxx").

Bron van waarheid voor de richting: [`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md).

| Nr | Titel | Status |
| --- | --- | --- |
| [0001](0001-ai-constitution-als-bron-van-waarheid.md) | AI_Constitution.md is de bron van waarheid | Aangenomen |
| [0002](0002-adventurer-platform-evolueert-binnen-plugins-bots.md) | Het Adventurer Platform groeit binnen `plugins/bots`, zonder rewrite | Aangenomen |
| [0003](0003-runtime-logs-sturen-prioriteit.md) | Runtime-logs bepalen de prioriteit | Aangenomen |
| [0004](0004-beschermde-functionaliteit.md) | Beschermde functionaliteit mag niet verslechteren | Aangenomen |
| [0005](0005-een-van-elk-en-geen-stille-banklus.md) | Eén exemplaar per uitrusting houden, geen stille banklus | Aangenomen |

## Sjabloon

```md
# ADR-xxxx: Titel

- Status: Voorgesteld | Aangenomen | Vervangen door ADR-yyyy
- Datum: dd-mm-yyyy
- Constitution: § van AI_Constitution.md waar dit op steunt

## Context
Wat speelt er, met bewijs (logregels, metrics, failures).

## Beslissing
Wat we doen.

## Gevolgen
Wat er beter wordt, wat het kost, welke risico's blijven.
```
