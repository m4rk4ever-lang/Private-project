# ADR-0004: Beschermde functionaliteit mag niet verslechteren

- Status: Aangenomen
- Datum: 20-11-2026
- Constitution: §21 (QuestHelper), §25 (Clan Intelligence), §29 (Observability), §30 (::volg Framework)

## Context

De eigenaar heeft vastgelegd dat een aantal onderdelen behouden moet blijven. Ze zijn strategisch
belangrijk en worden dagelijks gebruikt.

## Beslissing

Deze onderdelen zijn beschermd. Een wijziging mag ze uitbreiden, maar niet verwijderen, uitzetten
of minder informatief maken:

| Onderdeel | Waar |
| --- | --- |
| Huidige Adventurers (namen, clans, saves, generatie 18) | `plugins/bots/adventurers/`, `plugins/bots/data/adventurers.json` |
| Bestaande logging | `logs/adventurers-activity.jsonl`, `logs/adventurers-metrics.jsonl`, `logs/adventurer-quest-feedback.jsonl`, `scripts/share-bot-logs.sh`, branch `bot-logs` |
| QuestHelper-integraties | `adventurers/QuestHelperSteps.PlayerBots.js`, `tools/quest-helper-bridge`, agent-MCP `quest_helper` |
| Clans | `adventurers/Clans.PlayerBots.js`, `plugins/interface/clans/Clans.plugin.js` (`clans:ensure-member`) |
| Dashboard | `client/public/adventurers.html`, `/api/adventurers` |
| `::volg` | `plugins/bots/runtime/Watch.PlayerBots.js` |

Regels:

- Bestaande velden in logregels en in `/api/adventurers` blijven bestaan met dezelfde betekenis.
  Nieuwe velden en nieuwe `kind`-waarden mogen erbij.
- `generation` in `adventurers.json` wordt niet verhoogd zonder expliciete vraag van de eigenaar
  (een verhoging reset alle accounts).
- Een wijziging die een beschermd onderdeel raakt, vermeldt in de PR hoe is gecontroleerd dat het
  nog werkt.

## Gevolgen

- Refactors rond deze onderdelen zijn duurder. Dat is bewust.
- Uitbreidingen van `::volg` (doel, subdoel, reden, route, §30) zijn welkom en passen hierin.
