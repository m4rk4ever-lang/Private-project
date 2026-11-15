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
- `::allquests` (owner): zet alle quests en miniquests in één keer op voltooid, met questpunten
  maar zonder beloningen (geen items of XP). Ook quests en miniquests die nog niet speelbaar
  zijn gebouwd, worden in de questlijst afgevinkt en blijven dat na opnieuw inloggen.
- **Getrapte XP-rate**, per skill op basis van je level: x25 van level 1 tot 49, x15 van 50 tot 79,
  x10 van 80 tot 89 en x5 vanaf 90. Geldt ook voor quest-beloningen, lampen en tomes.
  Aan te passen met de instelling `TieredExperience:tiers`.
- **`update`** (of `yarn update`): stopt het spel, haalt de nieuwste versie op, installeert nieuwe
  onderdelen als dat nodig is en start het spel weer.
- **Automatische backups** van alle saves in `server/data/backups`: elk uur en bij het stoppen van
  de server, alleen als er iets veranderd is. De laatste 48 blijven bewaard
  (instelling `SaveBackups:keep`).

- **Eigen naam: Realm of Eeshwar.** Wereldnaam, tabtitel, loginscherm, welkomstbericht en
  pluginlijst gebruiken de nieuwe naam in plaats van "Old School RuneScape" en "RSPS.app".

### Opgelost
- `update` stopt het spel nu ook als een proces blijft hangen: het zoekt wat de poorten bezet
  houdt, wacht tot 20 seconden en stopt het daarna geforceerd.
- Account Management toont "Membership: Unlimited" in plaats van "None". De client behandelt
  iedereen nu ook als member in de skills-tab en de questlijst (op een members-wereld).

### Gewijzigd
- Nieuwe spelers starten in Lumbridge in plaats van Edgeville. `::home` gaat ook naar Lumbridge.

- **Bots terug, als levendige wereld:** 131 bots die hakken, minen, vissen en tegen monsters vechten,
  elk met een eigen naam, level en uitrusting. Ze starten in Lumbridge, Draynor, Varrock, Falador,
  Catherby en Seers' Village en wisselen om de 15 tot 25 minuten van activiteit. Bij zo'n wissel
  reizen ze vaak (6 op de 10 keer) naar een van 32 plekken in de wereld waar die activiteit kan,
  passend bij hun level: van Lumbridge tot de Slayer Tower, de Woodcutting Guild en Piscarilius.
  De PvP-bots bij Edgeville blijven uit.
- **High-level bots:** twee nieuwe groepen, masters (level 80+) en legends (90+). Zij hakken magic
  trees en redwoods, minen adamantite en runite, vangen sharks en anglerfish, en vechten in Barrows-,
  Bandos- en Armadyl-gear met wapens als de whip, godswords en de Ghrazi rapier.

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
