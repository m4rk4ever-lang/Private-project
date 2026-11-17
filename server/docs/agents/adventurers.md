# Adventurers and honest bots: goals, direction, next steps

The page for an agent picking up bot work. Read it before changing anything under
`plugins/bots/`. Keep it current: when you finish or start something, update **Status** and
**Next**.

## The goal

15 adventurers in three clans of 5 race each other (`adventurers.json` "clans"): Jorg Clan
(leader Bekoek + Jorgbot 1-4), Patrick Clan (leader Slayed Soul, Eeshwar + Patrickbot 1-3),
Mark Clan (leader Call me Mark, Kram539 + Markbot 1-3). Clans stay equal in size. The leader
founds the clan in game (`clans:ensure-member`); clanmates hand each other spare materials
they really have (`adventurers/Clans.PlayerBots.js`). They play like real players who choose
their own path. World bots are kept few (about 50: `bot-sites.json` pvp pool 30, 3 per region). World bots get the same honesty, starting from
a generated account. The owner follows them on `/adventurers.html` and in game with `::volg`.

## Rules that never bend

1. **Nothing from nothing.** No conjured items, coins, gear, tools, food, runes or toll coins.
   Coins come only from monster drops, shop and GE sales, and pickpocket pouches. Items come
   from drops, shops, the GE, skilling or the ground. Every grant path checks
   `state.honest || isHonest(player)` (`brain/Honest.PlayerBots.js`).
2. **Only what is really playable.** No simulated quests, diaries, minigames or rewards. A
   bot does a quest or diary task only when the game can really play it and the bot meets the
   level and quest requirements. If it cannot be simulated yet, the bot does not do it.
3. **Walk.** Teleports only when real: spell with runes and level, tablet (used up),
   charged jewellery to its own destinations (costs a charge). No Wilderness or quest-locked
   destinations.
4. **Real interfaces and actions.** Make items through the skill's real menus and object
   interactions, never by adding the product.
5. **Adventurers are outside the world bot code** for outfits, loadouts, PvP restores,
   upkeep and provisioning (`state.adventurer = true`). Their own planner trades for them.
6. Every unexplained worn item is logged (`adventurer_unexplained_item`, "Onverklaard" on the
   page). That log is the honesty check: an item without a source is a bug.

## How it is built

| Part | Where |
| --- | --- |
| Adventurer loop: plan, walk, train, trade, bank, audit, goals | `plugins/bots/adventurers/Adventurers.PlayerBots.js` |
| What to train next (weights, goal, catch-up, busy skills) | `adventurers/Planner.PlayerBots.js` |
| Goals ("20 Attack for a mithril scimitar", saving up) | `adventurers/Goals.PlayerBots.js` |
| Selling, buying, wearing the best, what to keep | `adventurers/Trade.PlayerBots.js` |
| Shops, tools, shopping list | `adventurers/Shopping.PlayerBots.js` |
| Quest list and requirements (from the cache) | `adventurers/Quests.PlayerBots.js` |
| Settings: banks, buy-to-train recipes, courses, limits | `data/adventurers.json`, `data/adventurer-gear.json` |
| Walking errands and teleports | `brain/Errands.PlayerBots.js` |
| Generated world bot accounts | `brain/Accounts.PlayerBots.js` |
| Bank standers that really craft | `brain/BankCraft.PlayerBots.js`, `actions/BankStand` |
| Doors and the toll gate (honest bots pay only with 1.000 gp+) | `brain/DoorOpening.PlayerBots.js` |
| Clans, the race, gifts between clanmates | `adventurers/Clans.PlayerBots.js`, `clans:ensure-member` in `plugins/interface/clans/Clans.plugin.js` |
| Slayer tasks; masters from the Slayer plugin's table, best tier it can walk to | `adventurers/Slayer.PlayerBots.js`, activity `slayer_task` |
| Quests played for real (walk, Talk-to, answer, ladders into basements) | `adventurers/QuestPlay.PlayerBots.js`, `data/quest-playthroughs.json` |
| Quests guided by the real Quest Helper (talk, use objects, take items, buy, dialogue) when the quest-helper bridge runs; stuck quests put aside and logged to `logs/adventurer-quest-feedback.jsonl` (also `questFeedback` in `/api/adventurers`) | `adventurers/QuestHelperSteps.PlayerBots.js`, `helperAll`/`helperQuests` in `data/quest-playthroughs.json`, bridge: `tools/quest-helper-bridge` (`yarn bridge`, `QUEST_HELPER_TOKEN`) |
| Where a job is done: the nearest fitting site (mode, level, `activities`, quests), apart from the world bots' Travel | `adventurers/Sites.PlayerBots.js`, `data/travel-destinations.json` |
| Achievements race (first player / clan to a milestone) | `adventurers/Achievements.PlayerBots.js`, `data/saves/adventurer-achievements.json` |
| The running job, saved and resumed after a restart | `adventurers/Tasks.PlayerBots.js` (attribute `adventurers:task`) |
| Long walks hub to hub; what is reachable on foot; quest-locked areas | `behaviours/navigation/TravelHubs.PlayerBots.js`, `data/travel-hubs.json` |
| `::volg` spectating | `runtime/Watch.PlayerBots.js` |
| Adventurers page | `client/public/adventurers.html` (icons via `/wiki-icons`) |

Plugins talk through custom events: `ge:place-offer`, `ge:collect`, `ge:reset`,
`construction:*`, `slayer:assignment`, `slayer:current-task`, `slayer:on-task`. No requiring
`src/` from plugin logic; take `core` from the plugin API.

## Direction (how we think about it)

- **Freedom within the rules.** The planner weighs options; it never forces the lowest
  skill. Goals steer, randomness and preference stay. Skills chain naturally: woodcutting can
  lead to banking, fletching, firemaking or more woodcutting.
- **Need, not fixed numbers.** Keep what it uses (runes, ammo, food, teleports) in any
  amount; materials for current and coming levels up to `bankCap`; sell outgrown tiers.
- **Bank like a player.** Between jobs the last job's leftovers go to the nearest reachable
  bank. A blocked road blocks that place only. Dropping is the last resort and only for cheap
  things (`cheapValue`).
- **Buy to train** when there is gold, sell the products, loss is fine if efficient.
- **Sell to fund.** Saving up for a coins goal (gear, teleport jewellery, tools), it may sell
  banked materials (logs, gems, bars) on the GE until the shortfall is covered; supplies stay.
- **No idling.** Stuck detection (2 min), retries with exclusion, next pick at once.
- Use what the world already knows (spawns, shops, objects, cache) instead of hand lists.

## Status (15-11-2026, evening)

Added this session: the running job is saved and resumed after a restart; melee rotates to the
lowest of Attack/Strength/Defence (ranged and magic train Defence with longrange or defensive
casting); combat spots vary among the best few, leaning to stronger monsters; supplies (arrows,
runes) and tools are fetched at a bank in person and banked when the next job does not use them;
bots click through level-up pop-ups; pickpocketing finds its targets (world NPC search, no client);
long walks go hub to hub (planner box is ~640 tiles) along links checked in game, holding the hub
until reached; places off the mainland or behind a quest are not chosen; home teleport with its
30-minute cooldown; quests played for real (Rune Mysteries checked start to finish with the agent
MCP); `::volg` shows quests and diary tasks; the page groups adventurers by clan.

Later the same evening: smelting own ore (`process_smelting`, bar "auto") and Runecraft at the
Air altar (`process_runecrafting_air`, CraftRunes action) as buy-to-train recipes; Slayer masters
from the Slayer plugin's table and protective gear from `slayer-gear.json`; a Slayer task is fought
to the end; empty gear slots are filled from bag or bank and an unarmed adventurer buys a weapon
first; routes are followed to their end (no to-and-fro near a goal) and a stalled errand hands its
walk to the route planner; quests climb stairs themselves; clan emblems and a per-clan view on the
page; a full save reset on starting over (`api.resetPersistentAttributes`).

Next morning: honest bots tire (run energy) and rest; the stretch starts on arrival; groups only
for a shared goal (boss, Wintertodt); a staggered start; monsters attack adventurers under player
rules (`NpcAggression`: honest bots, NPCs from the world) and they retaliate; a death leaves a grave
they walk back to (`gravestones:reclaim`: Loot and Pay at the grave); coin pouches opened; teleport
tablets and charged jewellery bought on the GE, Ardougne/Trollheim Teleport after their quests;
Hunter (bird snares at the Feldip crimson swifts, `HuntBirds` action); tools no nearby shop sells
bought on the GE; quests open the door between bot and NPC with the brain's `DoorOpening` (and
passages: caves, gaps) and click stairs and ladders like a player.

Debugging: plugin logs are off by default (`LOG_DISABLED_TYPES=plugin`); start with
`LOG_DISABLED_TYPES=npc.face,Combat` to see `bot_errand_failed` (why: stuck, no-closer, too-long)
and `bot_errand_replan`. `::botinfo <name>` shows a bot's walk target and current segment (a
segment that flips between two points is a to-and-fro). `::advquest <name>:<quest>` starts a quest
with a playthrough.

Known gaps: dungeons and other underground places need an entrance in `quest-playthroughs.json`
`places` (only the Wizards' Tower basement so far); Slayer protective items (nose peg, earmuffs,
anti-dragon shield), points and the slayer helm; more quests and diaries; Hunter, Farming,
Construction, Runecraft training after Rune Mysteries; capes and quest-reward teleports.

## Status (15-11-2026)

Done: honest economy, generated world bot accounts, walking errands and real teleports,
GE buy/sell, buy-to-train (fletching, firemaking, crafting gems, herblore, cooking,
smithing), bank use by need, agility courses with marks, ranged and magic with own supplies,
goals, house parties with gilded altar, `::volg` with inventory, equipment and skills,
adventurers page with icons and gear, toll gate detour, leftovers banked between jobs.

Not verified in game here (no cache in the agent container): long walks, agility runner,
make menus, house party, GE flows, equipment mirror, the Al Kharid detour.

## Next, in order

1. **Slayer** (first version done 15-11-2026; next: dungeons, finishing items, Vannaka): walk to a real master (Turael Burthorpe, Spria Draynor,
   Vannaka at 40 combat), `slayer:assignment`, fight only NPCs where `slayer:on-task` is true
   (TrainCombat filter, level band 1..1000, home near the nearest spawn by name), stop when
   `slayer:current-task` is empty. Planner mode `slayer`.
2. **Runecraft** now that Rune Mysteries is played (air altar: talisman, essence from the GE),
   then **Hunter** (chinchompas for Ranged later).
3. **More quests for real** (QuestPlay): play one with the agent MCP first (`dialogue`,
   `npc_option`), write its steps in `quest-playthroughs.json` with the stage each step reaches,
   add a ladder to `places` for any basement. Druidic Ritual (Herblore) next; then short F2P quests
   and diaries whose tasks are really playable.
4. **Places from the world** (spawns, objects, shops) instead of hand lists.
5. **Smarter stopping** (finish to a level), better prices, death recovery.
6. `::volg`: more interfaces (bank, combat tab), clickable control.
7. Later: diaries when tasks are really doable, Construction, leather crafting, Tempoross
   and other minigames, Graceful from marks (Rogues' Den), Wintertodt rewards in the audit.

## Status (16-11-2026) and next steps

Working: job sites chosen per job (Sites), real stall stealing (menu option, out of sight),
GE purchases collected, saved position after a restart, clan help (leader first), achievements
race, Prayer by burying bones, Quest Helper guided quests with a feedback loop. Codespaces set up
and start the Quest Helper bridge themselves (`scripts/quest-helper-setup.sh`, `.devcontainer/start.sh`).

Next, in order:
1. **Quest Helper "unavailable" around Lumbridge castle**: the bridge asks for object definitions
   the server does not fill (`requestsUnresolved: objectDefinitions` in the MCP `quest_helper`
   result). Fill them in the runtime's request handling; this blocks Rune Mysteries.
2. **Read `logs/adventurer-quest-feedback.jsonl`** from the live game and fix the most common
   reasons first (doors, gates, shops, items on the ground).
3. **Dungeon routes** (Taverley dungeon for Druidic Ritual and Herblore, Stronghold of Security,
   underground Slayer spots: `UNDERGROUND_Y` filter in Adventurers).
4. Rune essence mining after Rune Mysteries; arrows (fletching) and runes (runecrafting) for
   their own Ranged and Magic.
5. Finish separating adventurers from the world bots (shared activity templates and claims).

## Testing quickly

- `::advtrain <name>:<mode>` starts a job now (e.g. `slayer`, `hunter`, `thieving`, `buy_prayer`); watch its XP in `/api/adventurers` for a minute.
- `::advquest <name>:<quest>[:<stage>]` starts a quest, optionally at a stage, to test one step.
- The agent MCP's `quest_helper` shows what the helper tells a bot (`player`: the bot's name).

## How to extend safely

- New skill: an activity in `data/definitions/bot-activities.json`, a planner option, tools
  bought or made, a real action in `brain/actions/`. Check every item it gets has a source
  the audit knows (`acquire()`).
- New place: from data the world already has; check reachability (route finder, doors,
  tolls, quest gates) before choosing it.
- Tests: `node --test tests/bot-adventurers.test.cjs tests/bot-errands.test.cjs ...`.
  Cache-dependent bot tests fail without a cache; compare the fail count before and after.
- Changelog line in Dutch for every change; push to `origin main` only.

## Logs van een draaiende server lezen

De server schrijft drie logs in `server/logs/`: `adventurers-activity.jsonl` (elke journaalregel),
`adventurer-quest-feedback.jsonl` (vastgelopen quests met stappen en tijden) en
`adventurers-metrics.jsonl` (voor ontwikkelaars). De server zelf draait elke 5 minuten (en bij afsluiten)
`scripts/share-bot-logs.sh`, dat de laatste 20.000 regels van elk log als één commit naar de branch `bot-logs` pusht
(force, zodat de repo niet groeit). Ophalen: `git fetch origin bot-logs && git show origin/bot-logs:bot-logs/adventurers-metrics.jsonl`.

De metrics-regels, op `kind`:
- `bot` (elke 5 min, `ADVENTURER_METRICS_MS`): fase, taak en reden, doel, plek, XP per skill, XP/uur,
  geld erbij, `time` in minuten per soort (working, walking, errand, quest, idle) en `events`
  (stuck, walkBlocked, died, questFailed, targetReached, idle).
- `job` (einde van een taak): ook `coinsPerHour` (bezit erbij per uur; bijgehouden als `entry.earn` per modus voor de geldklus `moneyChance`); mode, reden, doel-level, level bij start en eind, `targetMet`, minuten,
  XP en `ended` (target reached, time up, full bag, stuck, quest done/failed, replaced).
- `goal`: doel gezet, gehaald of geschrapt, met de minuten sinds het gezet werd.
- `idle`: een avonturier staat een minuut zonder XP op zijn klus (plek, home, hp, in gevecht, vrije slots).
- `walk_blocked`: een route die niet lukte, van waar naar waar, met `tilesLeft`, coins en de momentopname hieronder.
- `stuck`: een klus zonder voortgang: modus, reden, plek, `home`, en de momentopname: `activity`, `action`, `describe`
  (de eigen uitleg van de actie, zoals site/target/approach bij combat), `npcsNear` (naam (level): aantal), `hp`, `freeSlots`.
- `quest_done`: een voltooide quest: duur, aantal stappen en de gesprekskeuzes (`dialogue`: opties en wat hij koos).
- `quest_fetch`: wat hij voor een quest ging halen (aangeraden of nodig) en of hij het na de boodschap echt in zijn tas had (`got`, `have`, `minutes`). Zo volgt op elke "gaat ... halen" in de log of het gelukt is.
- `teleport`: elke teleport onderweg (spreuk, tablet, sieraad of home teleport), met waarheen en waarvoor. Ook als regel in het activiteitenlog.
Elke regel in de drie logbestanden heeft `v`: de korte git-commit van de draaiende server. Zo zie je welke regels van vóór en na een update zijn.
  Mislukte quests staan in `adventurer-quest-feedback.jsonl`, nu ook met `dialogue`.
- `stranded`: de bot teleporteerde naar huis omdat hij drie keer vanaf dezelfde plek vastliep (`teleportedOut` in `events`).
- `death`: een avonturier stierf: fase, klus of quest, plek, wie hem het laatst raakte (`killer`, `killerLevel`, binnen een minuut), of hij eten had (`hadFood`), zijn prayer-punten en een grove reden (`reason`: geen eten, sterkere tegenstander, verloor met eten bij zich, onbekend).
  In `bot`-regels telt `fledLowHp` hoe vaak hij stopte omdat zijn HP laag was zonder eten.
- `skills` (elke 5 min): per skill hoeveel avonturiers XP kregen, hoeveel XP en via welke activiteit, en welke skills niemand trainde (`untouched`).
- `server`: aantal avonturiers en bots, gemiddelde en maximale duur van de avonturiers-tick, geheugen,
  quests die voor iedereen geblokkeerd zijn.

## Quest-sweep

`::advquestall` (eigenaar): elke avonturier tegelijk op een andere quest uit het pad (eerst een waarvoor hij klaar is), met de
blokkades opgeheven; wie klaar is of vastloopt pakt de volgende ongeteste quest (twee uur, `::advquestall stop`). Na een paar minuten staan de vastlopers in `adventurer-quest-feedback.jsonl` (stap, plek, helperstap, gesprekskeuzes)
en de geslaagde in de metrics als `quest_done`.

## Stand 16-11-2026 (avond) en volgende stappen

Gedaan vandaag (zie CHANGELOG): logs live naar `bot-logs` (server zelf, elke 5 min + bij afsluiten), metrics met
momentopnames (stuck/idle/walk_blocked/death/stranded/quest_done, gp/uur per klus), 15 testaccounts op profielen,
`::advquestall` sweep, bridge auto-start, verwerkende skills (bankgeld, partijen, noted), veiligheid (stoppen bij lage HP
zonder eten, auto-retaliate alleen bij gevechten), gestrande bots → home teleport, Giant Mole via spade + kaars,
quest-dialogen (geen uitlegvragen, lusbreker), quest-items oprapen via speler-klik, zelf verzamelen (clay).

Eerst doen bij een nieuwe sessie: `git fetch origin +refs/heads/bot-logs:refs/remotes/origin/bot-logs` en de drie logs
uitlezen (per activiteit: job.ended, stuck/idle-momentopnames, walk_blocked per vertrekplek; per quest: feedback +
dialogue; quest_done; death; stranded).

Open, van makkelijk naar moeilijk:
1. Coal in Barbarian Village: bots staan stil zonder XP bij een gevonden rots (idle, `gather target=11366`): drukte op
   weinig rotsen of een lege rots; andere coal-plek of wachten/wisselen.
2. Imp Catcher: stap "Collect one of each bead" heeft geen tegel en geen requirements; beads kopen (GE) of imps doden.
3. Gnome Stronghold-route: vanaf Seers/Ardougne start de wandeling niet (bot staat stil); vanaf de poort werkt het.
   Hubs `fishing_guild_road` → `gnome_stronghold_gate` bestaan; de errand naar de baan faalt vermoedelijk op lengte.
4. Ardougne-markt (stalls): route; check `walk_blocked` met de nieuwe momentopname.
5. Sarachnis: per boot naar Kourend (Veos, Port Sarim) en de Forthos Dungeon; staat op `onFoot: false`.
6. Quest-vervolgstappen uit de sweeps: deur Hetty (Witch's Potion), Veos (fix gepusht, nog niet bevestigd),
   Corsair Curse (schip), Druidic Ritual na Sanfew, Doric na het gesprek (clay: kopen met bankgeld of minen).
7. Verdieping-af (ladder in huis Varrock) werkte nog niet in test; dakbanen via kaartscan wel gepusht.

## Stand 17-11-2026 (ochtend) en volgende stappen

Generatie staat op 18: niet meer verhogen zonder expliciete vraag van de eigenaar (elke verhoging reset alle accounts).

Nog open, gemeld door de eigenaar:
- Na een boom die omvalt (en bij combat en andere skills: een volgend doel) kiest de bot er een ver weg in plaats van de dichtstbijzijnde (InteractObject findTarget, TrainCombat target ordering).
- "Wacht even (geen bank bereikbaar)": 9 van 60 bots in een test na 7878535; uitzoeken waarom geen bank bereikbaar is.
- Gathering met een tas vol spullen die hij niet gebruikt: vaker en grondiger leegmaken (clearBag-drempel 18 vrije vakjes, keep-lijst).
- Banken "van buiten de bank" (Draynor): bankt zodra de errand binnen ARRIVE_TILES (3) is, ook door een muur heen; moet de balie echt bereiken.
- Lumbridge castle-bank (verdieping 2): loopklussen naar een andere verdieping klimmen geen trappen; daarna toevoegen aan banks.
- Agility Varrock obstakel 4 (muur 3194,3416) en Al Kharid tropical tree: directe klik ingebouwd (7ed416d), in-game nog 7 nieuwe stuck-meldingen gezien; verder uitzoeken.
- Kopen van law runes (rijk + Magic 25) nog niet in-game gezien; teleports met sieraden/tablets/home wel.
- Charges: trident, blowpipe, Tumeken's shadow; prayer flicking; Barrows-run (taak 43); clue scrolls.

### Aanvullingen 17-11 (middag), nog open
- Combatstijl per monster: de zwakte uit monsters-complete.json (defence_stab/slash/crush/magic/ranged) gebruiken om melee/ranged/magic te kiezen, en de keuze loggen. Bij Barrows magic tegen alle broers behalve Ahrim.
- High-level bots trainen op plekken die niets opleveren (Ardougne soldiers): liever bossing (Barrows, DT2) of Slayer; ook gp per uur meewegen.
- Gathering: doel kiezen op looproute in plaats van hemelsbreed (willow aan de overkant van het water bij de GE); Draynor dead trees houden bots op.
- Gnome Stronghold-route faalt steeds op dezelfde lijn (ten zuiden van Coal Trucks, bij de River Dougne/Baxtorian).
- Cooking: bot draait vlak voor het fornuis in Lumbridge om en loopt weg.
- Desert Treasure II-bosses staan als plugin in het spel (Duke Sucellus, Leviathan, Vardorvis, Whisperer) maar zijn niet bereikbaar via ::teleports en niet in adventurers.json bosses.
- Meerdere werelden (wisselen bij een volle mijn of combatplek), OSRS Wiki money-making en skill-guides als bron voor taken.
- Bij testen: bot met teletome naar de plek, `advtrain` (dat wist de lopende loopklus), binnen seconden testen.

## Stand 17-11-2026 (middag, einde sessie): wat loopt en wat openstaat

### Net gebouwd, nog niet volledig getest
- **Barrows-run** (`adventurers/BarrowsRun.PlayerBots.js`, boss `boss_barrows` in adventurers.json,
  events `barrows:bot-view`, `barrows:bot-answer-puzzle`, `barrows:bot-process` in
  `minigames/Barrows.plugin.js`). Getest tot: prayer potions, spade, Barrows- en Varrock-tablets
  kopen, met de tablet teleporteren, de heuvel ingraven (landt in de crypte). Nog niet gezien:
  sarcofaag doorzoeken → broer verschijnt → gevecht, tunnel-dialoog ("Yeah I'm fearless!"),
  deuren/puzzel in de tunnels, kist openen en plunderen, wegteleporteren. Laatste waarneming: na
  de eerste zoekklik klom hij weer naar boven zonder broer; nu tot 3 zoekpogingen met logregels.
  Test: `::advtrain Markbot 18:boss_barrows` (bot bij de Barrows zetten met `::teletome`).
- **Engine-let op:** `PluginManager.emitPlayerProcess` draait niet voor bots (`World.ts`,
  `isPlayerBot`). Elke minigame die op `onPlayerProcess` leunt, werkt voor bots pas als de
  bot-module de verwerking zelf aanroept (zoals `barrows:bot-process`).
- **Ondergronds via trap/ladder** (`levelHop`/`clickHop` in Adventurers, uit
  `agent/data/transports.json`): Mining Guild (Mining 60). Nog niet in het spel gezien dat een bot
  echt afdaalt; de Dwarven Mine staat nog niet als plek in travel-destinations.
- **Tijdelijk vrijgegeven quests** (adventurers.json `grantedQuests`, attribuut
  `adventurers:granted-quests`): alleen de stage, geen beloningen. Weghalen uit de lijst zet de
  quest terug op 0.

### Gevonden in logs / gemeld door de gebruiker, nog open
- **"Eens proberen"-taken**: bots kiezen te vaak willekeurige klussen; doelmatiger kiezen.
- **Geld vs XP strenger toetsen**: Patrickbot 16 traint Herblore "voor geld" maar verdient niets.
  Een geldklus moet aantoonbaar winst maken (verkoopprijs product − inkoop), anders XP-klus.
- **Voorraad per run bijhouden** (bosses, Barrows): hoeveel eten/potions/tablets een run kost, en
  genoeg meenemen voor meerdere runs zodat hij niet na elke run hoeft te banken.
- **GE en bank zijn twee dingen**: atExchange zet spullen op de bank bij de GE; controleren dat
  bank-acties bij een bank horen en GE-acties bij de GE (en niet onnodig heen en weer).
- **Markbot 18 "Begint" + lopen naar Edgeville**: deels verklaard (Deadman Bounty Hunter-winkel
  voor prayer potions, nu uitgesloten; potions/spade werden gebankt, nu bossKit). In nieuwe logs
  controleren of het weg is.
- **Seers-rooftop vast op 2710,3475,3** (na GAP_28 landt de bot 8 tegels van GAP_29's routetegel;
  RunCourse klikt alleen binnen 5 tegels / herkent de voortgang niet). Ook: agility-klus bij 99.
- **High-level bots** doen nog lage klussen (endgame-bot gem stalls voor een torva-doel van 180M).
- **Construction** (gebruikerswens): huis met portal room, house tabs, pool om stats te herstellen.
- **Fletching** wordt weinig/niet echt getraind (gebruikersmelding) — nakijken.
- Ouder open: Gnome Stronghold-route en agility Gnome/Falador, combatstijl per monsterzwakte,
  Draynor dode bomen, banken van buiten de bank, koken bij Lumbridge-fornuis, meerdere werelden,
  charges opladen (scythe/trident), prayer flicking, clue scrolls, skilltiers uit
  `osrs-guides.md` (teaks, barbarian fishing, ...), Lumbridge-kasteelbank (trappen).

### Aanvulling 17-11 (avond)
Gefixt: errand-watchdog (bots bleven uren in fase "errand" na een GE- of bankboodschap met
`replan: false`), Barrows-kist op zijn tegel aanklikken, stuck-metric max 1×/min (vulde de logs),
inventaris in de bot-metric, geldklussen op gemeten opbrengst (minder "eens proberen"),
questitems/geodes niet weggooien, Ahrim-animatie, bosskit eerst via de GE.
Nog open:
- Barrows nog niet tot de kist gezien; testserver: verkocht eerder zijn spade (vóór bossKit),
  shop-route naar Darkmeyer (nu GE eerst). Opnieuw testen met `::advtrain Markbot 18:boss_barrows`.
- Seers-rooftop: bot blijft op 2728,3491,3 en 2710,3475,3 staan (ook na de 10-tegel-fix) — RunCourse
  nakijken; ook de Varrock-rooftop (3194,3416,1) waar meerdere bots uren vastzaten.
- Bots rapen botten niet (gemeld): Loot.lootNear/takeStep lijkt intact, oorzaak nog niet gevonden.
- Voorraad per bossrun bijhouden, construction, fletching, DT2-bosses voor endgame.
