# Architecture

XRSPS is a full-stack OSRS emulation engine. The client runs in the browser with React and WebGL. The server runs on Node.js with WebSocket networking. Both are written in TypeScript and share the same OSRS cache.

## Project Layout

The repository root contains the **`client/`**, **`server/`**, and **`docs/`** packages plus root scripts for setup and local development.

```
client/                 # @xrsps/client — browser CRA/craco app
  package.json
  craco.config.js
  public/
  scripts/cache/        # Cache export tooling
  common/               # Protocol/types shared by client domains (the server keeps its own copies)
  custom/               # Client side of server-sent custom content (items, NPCs, cache editor rows)
  game/                 # Game domains: chat, combat, ecs, login, input, sync…
  render/               # WebGL + overlays
  widgets/              # Widget tree, CS2 glue, GL widget draw
  components/           # React shell only
  network/              # Browser WebSocket client
  rs/                   # Cache loaders and OSRS engine code
  ui/                   # Canvas, menus, overlays

server/                 # Node WebSocket game server
  package.json
  caches/               # OSRS cache on disk (gitignored; downloaded via ensure-cache)
  scripts/              # ensure-cache, cache dumps, collision build, tooling
  tests/
  src/main/typescript/elvarg/   # Server core
  plugins/              # All gameplay content
  data/                 # World data: definitions/, models/, saves/ (saves are gitignored)
  docs/                 # Server and agent docs

docs/                   # @xrsps/docs — VitePress documentation
  package.json
```

Use `yarn setup` and `yarn start` from the repository root for local development. Package-specific commands can still be run from their package directory.

The server does not import from `client/`: its TypeScript project only includes `server/src`. It keeps its own copies of what it shares with the client, the packet ids in `server/src/main/typescript/elvarg/net/protocol/` and the cache codec in `server/src/main/typescript/elvarg/game/cache/codec/`. A protocol change has to be made on both sides.

### Where code lives

| Layer       | Directory                            | Purpose                                                                                                                                       |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**  | `client/`                            | Browser React + WebGL game client.                                                                                                            |
| **Server**  | `server/`                            | Node WebSocket game server.                                                                                                                   |
| **Docs**    | `docs/`                              | Architecture and contributor docs.                                                                                                            |
| **Core**    | `server/src/main/typescript/elvarg/` | Tick loop, networking, packet decode/encode, entity lifecycle, player sync, collision, pathfinding, plugin hook dispatch. No feature logic. |
| **Plugins** | `server/plugins/`                    | Skills, combat, NPCs, quests, minigames, interfaces, commands, game modes, persistence. See [Plugins](#plugins).                              |
| **Data**    | `server/data/definitions/`           | World data: items, shops, music, NPC definitions, spawns, drops and dialogues, `world.json`.                                                  |
| **Common**  | `client/common/`                     | Types, constants, and utilities shared across client domains.                                                                                 |

### Client code conventions

Adopted from our Vite site discipline, adapted for a game client:

- **File size:** Prefer **100–150** lines for app/domain code; **hard cap 400**. Exceptions: `client/rs/**` Jagex ports, generated/static data, opcode/ID tables, shaders.
- **`client/common`:** Non-UI code shared by **2+** domains (or by client + server). Prefer extending shared helpers over rewriting.
- **`client/components`:** React shell only. PascalCase folder = single component; lowercase folder = group with barrel; nested pieces under `ComponentName/components/`. Prefer `components/common` bases.
- **Game domains** (`game/`, `render/`, `widgets/`): lowercase folders for groups (`chat/`, `combat/`); PascalCase files for one class/module (`EnterToTypeChat.ts`). Groups may use `index.ts` barrels when stable.
- **Orchestrators stay thin:** `OsrsClient` and renderer facades wire explicit `*Deps`; feature logic lives in domain modules.

## Startup

`server/src/main/typescript/elvarg/Server.ts` starts the server in this order:

1. `CachePipeline.initialize()` (`game/cache/CachePipeline.ts`) opens the cache in `server/caches/`
2. `PluginManager.loadFromDirectory("plugins")` finds every `*.plugin.js` under `server/plugins/` and calls its `register(api)`
3. `GameBuilder` loads definitions and starts the tick loop (`game/GameEngine.ts`)
4. `NetworkBuilder` opens the game port (`WEBSOCKET_PORT`, default 43594)

## Game Loop

The server runs a **600ms tick loop** — the same as OSRS. Each tick:

1. Tick NPCs (AI, combat, movement)
2. Tick players. Each player's turn starts with the client packets received since their last
   turn, so input acts on the next tick as in live OSRS. Only connection upkeep, login,
   client-plugin traffic, free movement and logout are handled as they arrive
   (`IMMEDIATE_PACKETS` in `net/NetworkBuilder.ts`).
3. Encode updates into binary packets
4. Send sync packets to all connected clients

Work that spans ticks (delays, skilling loops, timers) runs as a `Task` in `game/task/`, which `TaskManager` processes each tick.

The client receives `PLAYER_SYNC` and `NPC_INFO` packets each tick, decodes them, and renders the updated world state on the next frame.

## Networking

Communication is over **WebSocket** with a **binary protocol**. No JSON at runtime.

| Packets                                   | Client                                    | Server copy (under `server/src/main/typescript/elvarg/`) |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| OSRS-style client packets (clicks, `OP*`) | `client/common/network/ClientPacketId.ts` | `net/protocol/NativeClientPackets.ts`                    |
| Other client packets (login, movement…)   | `client/common/packets/ClientPacketId.ts` | `net/protocol/ClientPackets.ts`                          |
| Server packets                            | `client/common/packets/ServerPacketId.ts` | `net/protocol/ServerPackets.ts`                          |

- Inbound: `net/NetworkBuilder.ts` decodes each frame (`decodeClientPackets` in `net/protocol/ClientProtocol.ts`) and passes interaction packets to the listeners in `net/packet/impl/` (`ObjectActionPacketListener`, `NPCOptionPacketListener`, `ItemActionPacketListener`…).
- Outbound: `net/packet/PacketSender.ts` (`player.getPacketSender()`).

Packets cover movement, interactions, widget clicks, combat, inventory, chat, and sync updates.

## Cache

Both client and server load the OSRS cache — the same binary format Jagex uses. It contains models, animations, maps, widgets, item definitions, NPC definitions, and more.

- **Server:** loads from disk via `CachePipeline` (cwd = `server/`); definitions are read through `CacheDefinitions` (`game/cache/CacheDefinitions.ts`)
- **Client:** loads from IndexedDB (downloaded from CDN on first visit)
- **Client loaders:** `CacheLoaderFactory` provides typed loaders (NPC types, obj types, loc types, animations, textures, etc.)

Cache files are stored in `server/caches/` (gitignored) and managed by `server/scripts/ensure-cache.ts`. The revision in use is in `server/target.txt`; see [Cache revision update](cache-revision-update.md).

## Varps and Varbits

OSRS uses **varps** (player variables) and **varbits** (bit-packed sub-variables) to drive UI state. The server modifies varps, sends delta packets to the client, and client-side CS2 scripts react to the changes to update widgets.

This is how equipment panels, skill tabs, settings, and all widget state stays in sync — no custom UI packets needed.

## Interactions

A click reaches content through plugin hooks:

1. Client sends an interaction packet (`OPLOC`, `OPNPC`, `IF_BUTTON`…)
2. On the player's turn, the matching listener in `net/packet/impl/` validates it and paths the player to the target
3. `PluginManager` calls the handlers plugins registered for it, such as `api.onObjectInteraction("Ladder", { "Climb-up": climbUp })` or `api.onNpcInteraction(...)`
4. The handler does the work (animations, XP, items, dialogue), scheduling a `Task` for anything that takes more than one tick

## Plugins

All gameplay lives in `server/plugins/`, grouped by area (`skills/`, `combat/`, `npcs/`, `quests/`, `minigames/`, `interface/`, `modes/`…). A plugin file exports `{ name, register(api) }`. `register` attaches hooks and nothing else; plugins reach core classes through `api.core` and talk to each other with custom events (`api.emitCustomEvent` / `api.onCustomEvent`).

Game modes are plugins too: Ironman, Leagues, PvP, free-to-play and Hardcore worlds live in `server/plugins/modes/`. Which plugins run, and their settings, comes from the world config (`server/data/definitions/world.json`, overridden locally by `world.local.json`).

- Rules for writing plugins: [server/AGENTS.md](https://github.com/RSPSApp/tsps/blob/main/server/AGENTS.md)
- Structure, hooks, events, members content, command rights: [Plugins](https://github.com/RSPSApp/tsps/blob/main/server/docs/agents/plugins.md)
- Turning plugins and modes on and off: [World configuration](world-configuration.md)

## Persistence

Core defines the `PlayerPersistence` interface (`game/entity/impl/player/persistence/PlayerPersistence.ts`) and starts with a `NullPlayerPersistence` that saves nothing. A plugin in `server/plugins/persistence/` installs the real backend with `api.setPlayerPersistence(...)`:

- `SqlitePlayerPersistence` (the default): `server/data/saves/players.sqlite`, written on a worker thread, with save history and rollback
- `JsonPlayerPersistence`: one JSON file per character under `server/data/saves/characters/`
- `IndexedDbPlayerPersistence`: used when the server runs inside a browser host

To add a backend, write a plugin whose class implements `load`, `save` and `exists` and pass an instance to `api.setPlayerPersistence`. When and why players are saved, the save history and rollbacks are covered in [Player saves](player-saves.md).

## Custom Content

The server can send content that doesn't exist in the OSRS cache. It goes to the client at login in the `GAMEMODE_DATA` packet (`PacketSender.sendContentData(source, datasets)`); the client's `GamemodeContentStore` (`client/common/gamemode/`) unpacks each dataset and registers it.

- **Custom items** are rows in `server/data/definitions/custom-items.json` (ids 50000+), loaded by `plugins/items/ItemDefinitionLoader.plugin.js`. On the client, `CustomItemRegistry` (`client/custom/items/`) holds them and `CustomObjTypeLoader` wraps the base `ObjTypeLoader` so they resolve like cache items. Models for them go in `server/data/models/`. See [Custom content](custom-content.md).
- **Cache editor definitions** (custom locs, NPCs and items) are registered per source with `CacheDefinitions.registerCustomDefinitions(rows, source)`. See [server/docs/agents/cache-editor.md](https://github.com/RSPSApp/tsps/blob/main/server/docs/agents/cache-editor.md).
- **Custom interfaces**: see [server/docs/agents/interfaces.md](https://github.com/RSPSApp/tsps/blob/main/server/docs/agents/interfaces.md).

## Adventurer Platform

The autonomous adventurers (player bots that play an account from level 3 upward) follow
[`AI_Constitution.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/AI_Constitution.md), the source of truth for their direction
([ADR-0001](adr/0001-ai-constitution-als-bron-van-waarheid.md)). This section maps the
constitution's three layers (§6) onto the code as it is today. It does not change the vision; it
shows where each part lives, so new work lands in the right layer
([ADR-0002](adr/0002-adventurer-platform-evolueert-binnen-plugins-bots.md)).

All of it is plugin code under `server/plugins/bots/`. Honesty rules and how-to: 
[`server/docs/agents/adventurers.md`](https://github.com/m4rk4ever-lang/private-project/blob/main/server/docs/agents/adventurers.md).
Roadmap and gap analysis: [ADVENTURER_ROADMAP.md](ADVENTURER_ROADMAP.md). Logs and metrics:
[OBSERVABILITY.md](OBSERVABILITY.md). Working rules: [RUNTIME_POLICY.md](RUNTIME_POLICY.md).

### Layers in the current code

| Layer (§6) | What it does | Where it lives now |
| --- | --- | --- |
| **Knowledge** | Facts about the account and world | `snapshot()`, `levelOf`, `banked`, `wealthOf` in `adventurers/Adventurers.PlayerBots.js`; quest list and requirements from the cache (`adventurers/Quests.PlayerBots.js`); shops and ownership (`adventurers/Shopping.PlayerBots.js`); keep/sell rules (`adventurers/Trade.PlayerBots.js`); places (`adventurers/Sites.PlayerBots.js`, `data/travel-destinations.json`, `data/travel-hubs.json`); activities (`server/data/definitions/bot-activities.json`); transports (`plugins/agent/data/transports.json`); requirement check before a choice (`adventurers/Requirements.PlayerBots.js`, `canExecute`, §7) |
| **Decision** | Goals and what to do next | `adventurers/Planner.PlayerBots.js` (`chooseNext`, weights), `adventurers/Goals.PlayerBots.js` (gear and coin goals), the decide step in `Adventurers.PlayerBots.js` (trade, bank, resume, plan), `adventurers/Slayer.PlayerBots.js`, boss choice (`adventurers.json` `bosses`) |
| **Execution** | Acting in the world through the game's own actions | Errands and teleports (`brain/Errands.PlayerBots.js`), brain and its actions (`brain/Brain.PlayerBots.js`, `brain/actions/`), navigation (`behaviours/navigation/`), doors and shortcuts (`brain/DoorOpening.PlayerBots.js`, `brain/ShortcutCrossing.PlayerBots.js`), quests (`adventurers/QuestPlay.PlayerBots.js`, `adventurers/QuestHelperSteps.PlayerBots.js`), Barrows (`adventurers/BarrowsRun.PlayerBots.js`) |
| **Observability** (§29-32) | What it does and why | Journal and metrics (`logs/*.jsonl`, branch `bot-logs`), `/api/adventurers` + `client/public/adventurers.html`, `::volg` (`runtime/Watch.PlayerBots.js`), `::botinfo` |

Known debt: `Adventurers.PlayerBots.js` (about 4,650 lines) still mixes all three layers. It is
split only piece by piece, as part of a fix that runtime data asks for, never as a rewrite.

### Supporting services

| Service | Role |
| --- | --- |
| Quest Helper bridge (`tools/quest-helper-bridge`, `yarn bridge`) | The real RuneLite Quest Helper tells a bot the next quest step (§21). Started by the server when built (`ADVENTURER_START_BRIDGE`). |
| RuneLite gateway (`runelite-gateway/`) | RuneLite API shape over the server, used by the bridge. |
| Agent MCP (`plugins/agent/`) | Test and inspection tools per worktree port, including `quest_helper`. |
| Persistence (`plugins/persistence/`) | SQLite saves (`server/data/saves/players.sqlite`); adventurer state lives in player attributes (`adventurers:task`, `adventurers:granted-quests`). Achievements race: `server/data/saves/adventurer-achievements.json`. |
| Log sharing (`scripts/share-bot-logs.sh`) | Every 5 minutes and on shutdown, the last 20,000 lines of each log to branch `bot-logs`. |
