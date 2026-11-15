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
  Ook alle achievement diaries (alle tiers) worden voltooid. De diary-beloningen haal je zelf op
  bij de NPC van elke diary.
- **Getrapte XP-rate**, per skill op basis van je level: x25 van level 1 tot 49, x15 van 50 tot 79,
  x10 van 80 tot 89 en x5 vanaf 90. Geldt ook voor quest-beloningen, lampen en tomes.
  Aan te passen met de instelling `TieredExperience:tiers`.
- **`update`** (of `yarn update`): stopt het spel, haalt de nieuwste versie op, installeert nieuwe
  onderdelen als dat nodig is en start het spel weer.
- **Automatische backups** van alle saves in `server/data/backups`: elk uur en bij het stoppen van
  de server, alleen als er iets veranderd is. De laatste 48 blijven bewaard
  (instelling `SaveBackups:keep`).
- **Wekelijkse backup naar GitHub:** hoogstens eens per 7 dagen, zolang de server draait, gaat de
  nieuwste backup naar de branch `saves` van de repo. Elke week een commit, dus oude versies blijven
  terug te halen. Alleen als de repo privé is, want de saves bevatten wachtwoord-hashes.
  Handmatig: `yarn saves:push`.

- **Eigen naam: Realm of Eeshwar.** Wereldnaam, tabtitel, loginscherm, welkomstbericht en
  pluginlijst gebruiken de nieuwe naam in plaats van "Old School RuneScape" en "RSPS.app".
- **Eigen logo** op het loginscherm in plaats van het RuneScape-logo, en "Realm of Eeshwar is loading"
  op het laadscherm. Een codespace met de oude servernaam "Codespace" wordt vanzelf omgezet.

### Opgelost
- `update` stopt nu ook een spel dat op een poort blijft hangen zonder dat zichtbaar is welk
  proces het is (de melding "Er draait nog iets op poort 3000").
- Minder bots die vastlopen bij de Al Kharid-mijn en de tolpoort: die mijn wordt minder vaak gekozen.
- In een codespace laden de graphics op een nieuwe plek niet langer traag. De client haalt de
  hele game-cache bij de eerste keer laden in één keer binnen en bewaart die in je browser.
  Die eerste keer duurt wat langer, daarna komen er geen graphics meer over het netwerk.
- Combat-bots kozen hun uitrusting met een zwakke hash, waardoor bots met bijna gelijke namen
  vaak hetzelfde droegen. Elke bot houdt zijn eigen vaste uitrusting, maar de spreiding is nu echt
  willekeurig, en beginners dragen nog maar de helft van de tijd een cape.
- `update` stopt het spel nu ook als een proces blijft hangen: het zoekt wat de poorten bezet
  houdt, wacht tot 20 seconden en stopt het daarna geforceerd.
- Account Management toont "Membership: Unlimited" in plaats van "None". De client behandelt
  iedereen nu ook als member in de skills-tab en de questlijst (op een members-wereld).

### Gewijzigd
- De README is herschreven voor Realm of Eeshwar: spelen, bijwerken, staff-commands, backups en
  een link naar deze changelog.
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
- **Meer variatie in hoe bots eruitzien:** niet meer elk slot gevuld (de meeste beginners dragen geen
  cape), keuze uit 50 team capes, cloaks, hoeden en kostuums, skilling-outfits (Lumberjack,
  Prospector, Angler, Graceful) vanaf gevorderd niveau, en een skillcape bij 99. Na het reizen
  kleedt een skiller zich om voor zijn nieuwe klus.
- **Loot beam op waarde:** in de instellingen van de plugin **Ground Items** stel je met een
  schuifbalk in vanaf welke waarde een drop een loot beam krijgt (1k tot 100m, standaard 100k).
  Aan of uit met "Lootbeam by value". De kleur volgt de waardegrenzen van Ground Items.
- **Maxed bots:** 13 extra bots bij de Grand Exchange, waarvan 10 maxed (alles 99, combat 126)
  in max gear: Torva, Masori en Ancestral, met de Scythe of Vitur, Twisted bow en Kodai wand.
  Opgeladen wapens zijn echt opgeladen. Meestal dragen ze een max cape. Nu 144 bots.
- **Bots hebben een thuisbasis:** elke bot heeft per activiteit een vaste hub die erbij past.
  Vissers bij Catherby, Seers of Draynor, miners bij Falador, Varrock West of Al Kharid,
  woodcutters bij Seers, Draynor of Edgeville, vechters bij Edgeville of Varrock. Iedereen kan
  de Grand Exchange als hub hebben, beginners Lumbridge, en vanaf combat 90 ook Prifddinas.
  Tussen activiteiten lopen bots daar een tijdje rond en ze werken het liefst in de buurt.
- **Drukke plekken:** bots hangen ook rond bij de Grand Exchange (verreweg het drukst), de banken
  en pleinen van Varrock, Falador, Edgeville en Ardougne. High-level bots staan in hun
  combat-gear bij Chambers of Xeric, Theatre of Blood, Tombs of Amascut, de Colosseum,
  God Wars, Barrows, TzHaar, de Giant Mole en de Kalphite Lair.
- Bots trainen nu ook in de Taverley, Brimhaven en Fremennik Slayer Dungeons en de Catacombs of
  Kourend, en vechten op master- en legend-niveau tegen sterkere monsters met betere food.


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
