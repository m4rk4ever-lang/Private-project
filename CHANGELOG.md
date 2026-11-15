# Changelog

Alle wijzigingen aan dit project, nieuwste bovenaan.

Dit project is een eigen voortzetting van [TSPS](https://github.com/RSPSApp/tsps)
(BSD 2-Clause, zie `LICENSE`). Wat hieronder staat, is ons eigen werk vanaf de kopie.

Indeling per versie:
- **Toegevoegd**: nieuwe functies, content of tools
- **Gewijzigd**: aanpassingen aan bestaand gedrag
- **Opgelost**: bugfixes
- **Verwijderd**: functies of bestanden die eruit zijn

## [Nog niet uitgebracht]

### Toegevoegd
- `CHANGELOG.md` om ons werk bij te houden.
- Het spel draait in GitHub Codespaces: open de repo in een codespace en het spel start
  vanzelf in je browser (uitleg in `.devcontainer/README.md`).
- Tutorial Island staat aan: nieuwe accounts beginnen op het eiland en gaan daarna naar Lumbridge.
- Het account **Mark** logt in een codespace automatisch in als **owner**.
- Nieuwe instelling `OWNER_USERNAME` in `.env`: deze accounts loggen in als owner
  (meerdere namen met komma's).
- **Staffzone** (`::staffzone`, alleen owner en developer): een privé-kopie van de schatkamer
  van Tombs of Amascut, gedeeld door alle staff. Met vier gratis staffwinkels (wapens, armour,
  voorraad, skilling), een bankier, een trainingsdummy en een sierlijke verjongingspool.
  Osmumten houdt de wacht bij de sarcofaag en staande fakkels verlichten de hal. Je hitpoints,
  prayer, special attack en run-energie blijven er vol. Nog een keer `::staffzone` brengt je terug.
- `::allquests` (owner): rondt alle quests in één keer af, met beloningen en questpunten.

### Gewijzigd
- Nieuwe spelers starten in Lumbridge in plaats van Edgeville. `::home` gaat ook naar Lumbridge.

### Verwijderd
- De bots (nepspelers) staan uit. Je bent alleen in je wereld, op eventuele echte spelers na.

## [0.1.0] - 15-11-2026

Startpunt: 1-op-1 kopie van TSPS `main` (commit `8be9d78`), daarna losgekoppeld.

### Gewijzigd
- Client en server hebben geen ingebouwde WebRTC-relay of STUN-server meer
  (`worlds.rsps.app`, `stun.rsps.app`). Een relay werkt alleen nog als je die zelf instelt met
  `REACT_APP_WEBRTC_SIGNAL_URL` (client) of `WEBRTC_SIGNAL_URL` (server).
- Plugin-downloads in het adminpanel staan uit. Plugins installeer je door een zip te uploaden,
  of je stelt `PLUGIN_RELEASES_URL` in op je eigen GitHub-releases.
- De bugreport-knop in de client opent een issue in deze repo.
- Het adminpanel haalt de plugin-catalogus en minimap niet meer op bij het originele project.
  De minimap in de spawn-picker is daardoor voorlopig leeg.

### Verwijderd
- GitHub Actions-workflows, deploy-scripts en `CODEOWNERS` van het originele project (`.github/`).
- Agent-scripts die naar `RSPSApp/tsps` pushten of daar issues ophaalden (`scripts/agents/ship`,
  `watch-prs`, `watch-issues`, `prune-worktrees`) en de bijbehorende bugfix-skill.
