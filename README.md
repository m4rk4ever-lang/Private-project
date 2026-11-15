# Realm of Eeshwar

Een eigen Old School-wereld: server en client in TypeScript, te spelen in de browser.

Wat er veranderd is, staat in de **[CHANGELOG](CHANGELOG.md)**.

## Spelen

1. Open de repo in een **GitHub Codespace** (groene knop **Code** > **Codespaces**).
2. Wacht tot de terminal `Compiled successfully` laat zien. De eerste keer duurt dat 10 tot 15 minuten.
3. Het spel opent in een nieuw tabblad. Log in met een naam en wachtwoord; het account wordt dan aangemaakt.

De eerste keer laden downloadt de game-cache naar je browser. Daarna laden plekken direct.
Gebruik Chrome of Edge. Meer uitleg en hulp bij problemen: [.devcontainer/README.md](.devcontainer/README.md).

Lokaal draaien (Node 22): `npm run setup`, daarna `yarn start` en open http://localhost:3000.

## Bijwerken

Typ `update` in een terminal van de codespace. Het spel stopt, de nieuwste versie wordt opgehaald,
nieuwe onderdelen worden geïnstalleerd als dat nodig is en het spel start weer.

## Terminal-commands

Typ deze in een terminal in de map van het project (in een codespace: `/workspaces/Private-project`).

| Command | Wat het doet |
| --- | --- |
| `update` | Spel stoppen, nieuwste versie ophalen, zo nodig installeren en opnieuw starten (zelfde als `yarn update`) |
| `yarn start` | Het spel starten: server en client samen. Een spel dat nog draait, stopt eerst. Stoppen met `Ctrl+C` |
| `yarn stop` | Een draaiend spel stoppen, ook uit een andere terminal |
| `yarn server` | Alleen de gameserver starten |
| `yarn client` | Alleen de browserclient starten |
| `yarn start:prod` | Het spel starten in de snellere productie-versie (bouwen duurt eerst een paar minuten) |
| `npm run setup` | Alle onderdelen (opnieuw) installeren |
| `yarn saves:push` | De nieuwste save-backup nu naar de branch `saves` op GitHub sturen (alleen bij een privé-repo) |
| `git pull` | Alleen de nieuwste versie ophalen, zonder het spel te herstarten |

Blijft `update` hangen op een bezette poort? Stop de codespace op github.com/codespaces en open
hem weer.

## Staff

Het account **Mark** logt in als owner (instelling `OWNER_USERNAME` in `.env`).

| Command | Wat het doet |
| --- | --- |
| `::staffzone` | Naar de staffzone en weer terug (owner en developer) |
| `::allquests` | Alle quests, miniquests en achievement diaries voltooid, zonder beloningen |
| `::quest <naam>` | De stand van een quest bekijken of aanpassen |
| `::diary <naam>` | De stand van een achievement diary bekijken, voltooien of resetten |
| `::adventurers` | De vijf avonturier-bots: levels, quests en wat ze doen |
| `::adventurer <naam>` | Naar een avonturier toe |

## Wereld

- **Getrapte XP-rate** per skill: x25 tot level 49, x15 tot 79, x10 tot 89, daarna x5.
- **Bots:** zo'n 160 bots die hakken, minen, vissen, stelen en vechten, bij banken skillen en bij minigames rondhangen, met een vaste thuisbasis per
  activiteit. Ze reizen door de wereld, hangen rond bij de Grand Exchange en de banken, en
  high-level bots staan bij raids en bosses.
- **Avonturiers:** vijf bots die zelf het spel spelen. Live te volgen op `/adventurers.html`
  (op hetzelfde adres als het spel).
- **Loot beam op waarde:** in de instellingen van de plugin Ground Items, met een schuifbalk.

## Saves en backups

- Elk uur (alleen als er iets veranderd is) gaat een backup van alle saves naar `server/data/backups`.
- Eens per week gaat de nieuwste backup naar de branch `saves` op GitHub. Dat gebeurt alleen als
  deze repo privé is.

## Mappen

| Map | Inhoud |
| --- | --- |
| `server/` | De gameserver. Content zit in `server/plugins/`, wereldinstellingen in `server/data/definitions/world.json` |
| `client/` | De browserclient |
| `scripts/` | `update` en de backup-scripts |
| `.devcontainer/` | De Codespace-instellingen |

Regels voor wie aan de code werkt: [AGENTS.md](AGENTS.md) en [server/AGENTS.md](server/AGENTS.md).

## Licentie

Zie [LICENSE](LICENSE).
