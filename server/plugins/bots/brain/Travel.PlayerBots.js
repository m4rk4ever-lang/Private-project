"use strict";

/**
 * Bots travel the world: when a bot's rotation switches activity (bot-sites.json
 * `switchMinutes`), it may teleport elsewhere, so bots turn up all over the world rather than
 * only around their spawn site. Two kinds of places, from data/travel-destinations.json:
 *
 * - destinations, where the new activity can be done: picked among those that offer its mode
 *   and suit the bot's level (the skill for a skilling mode, the combat level for combat
 *   training), weighted. The activity then walks to the nearest tree, rock, fishing spot or
 *   monster cluster as usual, and a skiller changes clothes for the job (dressForMode).
 * - hangouts (with `hangoutChance`), busy places where players gather: the Grand Exchange, the
 *   main banks, and for high-level bots the raid and boss entrances, where they stand in their
 *   combat gear. A hangout replaces the activity: the bot roams there until its next switch.
 *
 * Every bot has a home hub per activity, one that fits it: Catherby or Seers for a fisher,
 * Falador or Al Kharid for a miner, the Grand Exchange for anyone, Prifddinas from combat 90.
 * The hub is fixed by the bot's name, so the same bot keeps the same hubs. Between activities it
 * usually goes back to its own hub (`ownHubChance`), and it prefers destinations near it.
 *
 * At a busy bank (`bankstand`) a bot may stand by the booths fletching, mixing potions or
 * crafting (bankstandChance) instead of walking around.
 *
 * Minigames (`minigameChance`): a bot that meets a game's requirements goes to its lobby,
 * dressed for it (Pyromancer at Wintertodt, combat gear at Castle Wars) and stays within the
 * lobby's bounds. A game that already has bots draws more, so they gather in groups, up to
 * `maxGroup`. `play` names the game's own bot code that will take them into the game itself.
 *
 * The bot arrives with the normal teleport and its home moves there. Only skilling and
 * combat-training bots travel; PvP bots and bots in a fight or the Wilderness stay put, and no
 * place is in the Wilderness.
 */
const data = require("../data/travel-destinations.json");

const MODE_SKILL = Object.freeze({
  woodcutting: "WOODCUTTING",
  mining: "MINING",
  fishing: "FISHING",
  thieving: "THIEVING",
});
/** How far from where it stands a place must be to be worth the teleport. */
const MIN_TRAVEL_TILES = 30;
/** Bots at a place before its weight halves (1 / (1 + bots / cap)). */
const OCCUPANCY_SOFT_CAP = 3;

function combatLevelOf(player) {
  return player.getSkillManager?.()?.getCombatLevel?.() ?? player.getCombatLevel?.() ?? 3;
}

function levelFor(player, mode, core) {
  if (mode === "combat_training") return combatLevelOf(player);
  const skill = core.Skill?.[MODE_SKILL[mode]];
  return skill ? player.getSkillManager?.()?.getMaxLevel?.(skill) ?? 1 : 0;
}

function farEnough(place, here) {
  return !here || here.z !== (place.z ?? 0)
    || Math.max(Math.abs(here.x - place.x), Math.abs(here.y - place.y)) >= MIN_TRAVEL_TILES;
}

/** The destinations for a mode and level, at least MIN_TRAVEL_TILES from `here`. */
function destinationsFor(mode, level, here, destinations = data.destinations) {
  return destinations.filter((place) =>
    place.modes.includes(mode) && level >= (place.minLevel ?? 1) && level <= (place.maxLevel ?? Infinity) && farEnough(place, here));
}

/** The hangouts a bot of this combat level may go to, at least MIN_TRAVEL_TILES from `here`. */
function hangoutsFor(combatLevel, here, hangouts = data.hangouts ?? []) {
  return hangouts.filter((place) => combatLevel >= (place.minCombat ?? 1) && farEnough(place, here));
}

/** Whether a bot meets a minigame's requirements: skill levels (`requires`) and `minCombat`. */
function meetsMinigame(player, game, core, combatLevel) {
  if (combatLevel < (game.minCombat ?? 1)) return false;
  const skills = player.getSkillManager?.();
  return Object.entries(game.requires ?? {}).every(([name, level]) => {
    const skill = core.Skill?.[name];
    return skill != null && (skills?.getMaxLevel?.(skill) ?? 1) >= level;
  });
}

/**
 * The minigame lobbies a bot may go to, weighted so company draws company: each bot already
 * there adds to the game's weight, and a full game (maxGroup) takes no more.
 */
function minigamesFor(player, core, combatLevel, attendance, games = data.minigames ?? []) {
  return games
    .filter((game) => meetsMinigame(player, game, core, combatLevel))
    .map((game) => {
      const present = attendance.get(game.id)?.size ?? 0;
      const full = present >= (game.maxGroup ?? Infinity);
      return { game, weight: full ? 0 : (game.weight ?? 1) * (1 + present) };
    })
    .filter((entry) => entry.weight > 0);
}

/** One of `places`, by `weightOf` (default: their `weight`, else 1). */
function pickWeighted(places, random, weightOf = (place) => place.weight ?? 1) {
  const total = places.reduce((sum, place) => sum + weightOf(place), 0);
  let roll = random() * total;
  for (const place of places) {
    roll -= weightOf(place);
    if (roll < 0) return place;
  }
  return places[places.length - 1];
}

/** A stable number in [0, 1) for a name and mode (FNV-1a), so a bot keeps its hubs. */
function stableRoll(name, mode) {
  let hash = 0x811c9dc5;
  for (const char of `${name}:${mode}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

/** The hubs that fit a mode, a level and a combat level. */
function hubsFor(mode, level, combatLevel, hangouts = data.hangouts ?? []) {
  return hangouts.filter((place) =>
    place.hubFor?.includes(mode)
    && combatLevel >= (place.minCombat ?? 1)
    && level < (place.hubMaxLevel ?? Infinity));
}

/** The bot's home hub for a mode: fixed by its name among the hubs that fit it now. */
function hubFor(name, mode, level, combatLevel) {
  const hubs = hubsFor(mode, level, combatLevel);
  if (hubs.length === 0) return null;
  const roll = stableRoll(name, mode);
  return pickWeighted(hubs, () => roll);
}

const NEAR_HUB_TILES = 300;

function nearHub(place, hub) {
  return !!hub && (place.z ?? 0) === (hub.z ?? 0)
    && Math.max(Math.abs(place.x - hub.x), Math.abs(place.y - hub.y)) <= NEAR_HUB_TILES;
}

/**
 * Returns `travel(player, state, activity, nowMs)`: teleports the bot to a fitting place (with
 * `chance`) and moves its home there. Returns the place ({ ...place, hangout: true } for a
 * hangout, where the caller lets the bot roam), or null when it stays.
 */
function createTravel({
  core, log = () => {}, dress = null, equipCombatGear = null, moveTo = null,
  /** (here, place) -> weight factor: walkers prefer places near them. */
  nearness = null,
  random = Math.random, chance = data.chance, hangoutChance = data.hangoutChance ?? 0,
  ownHubChance = data.ownHubChance ?? 0, nearHubBonus = data.nearHubBonus ?? 1,
  bankstandChance = data.bankstandChance ?? 0, minigameChance = data.minigameChance ?? 0,
  wear = null,
  /** For honest bots: whether a place's `requires` (quests, skills) is met; others go anywhere. */
  meets = null,
} = {}) {
  function stayFor(activityId) {
    const [min, max] = data.stayMinutes?.[activityId] ?? data.stayMinutes?.roam ?? [3, 6];
    return (min + random() * (max - min)) * 60_000;
  }
  /**
   * Who went where: place id -> usernames. A place that already has bots weighs less
   * (OCCUPANCY_SOFT_CAP), so they spread over the world instead of piling into one mine.
   */
  const occupancy = new Map();
  function settle(name, placeId) {
    for (const present of occupancy.values()) present.delete(name);
    if (!placeId) return;
    if (!occupancy.has(placeId)) occupancy.set(placeId, new Set());
    occupancy.get(placeId).add(name);
  }
  function crowding(place) {
    return 1 / (1 + (occupancy.get(place.id)?.size ?? 0) / OCCUPANCY_SOFT_CAP);
  }
  /** Who is at each minigame lobby now: game id -> usernames. */
  const attendance = new Map();
  function leaveMinigames(name) {
    for (const present of attendance.values()) present.delete(name);
  }
  function travel(player, state, activity, nowMs) {
    // A switch ends any stay at a minigame lobby, whether or not the bot travels.
    if (player) leaveMinigames(player.getUsername?.() ?? "");
    const mode = activity?.mode;
    if (!player || !mode || !(mode in MODE_SKILL || mode === "combat_training")) return null;
    if (random() >= chance) return null;
    const combat = player.getCombat?.();
    if (combat?.getTarget?.() || combat?.getAttacker?.()) return null;
    if (core.Wilderness?.isIn?.(player)) return null;
    const at = player.getLocation?.();
    const here = at ? { x: at.getX(), y: at.getY(), z: at.getZ() } : null;
    const name = player.getUsername?.() ?? "";
    const level = levelFor(player, mode, core);
    const combatLevel = combatLevelOf(player);
    const hub = hubFor(name, mode, level, combatLevel);
    let place = null;
    if (random() < minigameChance) {
      const games = minigamesFor(player, core, combatLevel, attendance);
      if (games.length > 0) {
        const { game } = pickWeighted(games, random, (entry) => entry.weight);
        if (!attendance.has(game.id)) attendance.set(game.id, new Set());
        attendance.get(game.id).add(name);
        // `play`: the activity that plays the game (Wintertodt); else the bots wait in the lobby.
        place = { ...game, hangout: true, minigame: game.id, activity: game.play ?? "roam" };
        if (!game.play) place.stayMs = stayFor("roam");
      }
    }
    if (!place && random() < hangoutChance) {
      if (hub && random() < ownHubChance && farEnough(hub, here)) {
        place = { ...hub, hangout: true };
      } else {
        const hangouts = hangoutsFor(combatLevel, here).filter((option) => !meets || meets(player, option.requires));
        if (hangouts.length > 0) {
          place = { ...pickWeighted(hangouts, random, (option) => (option.weight ?? 1) * crowding(option)), hangout: true };
        }
      }
      if (place?.activities) {
        // A place says what bots do there (the Grand Exchange: mostly trading and bank standing).
        const options = Object.entries(place.activities).map(([id, weight]) => ({ id, weight }));
        place.activity = pickWeighted(options, random).id;
      } else if (place) {
        place.activity = place.bankstand && random() < bankstandChance ? "bankstand" : "roam";
      }
      // A hangout is a break between jobs, not a new job: the bot goes back to work after a while.
      if (place) place.stayMs = stayFor(place.activity);
    }
    if (!place) {
      const options = destinationsFor(mode, level, here).filter((option) => !meets || meets(player, option.requires));
      if (options.length === 0) return null;
      place = pickWeighted(options, random,
        (option) => (option.weight ?? 1) * (nearHub(option, hub) ? nearHubBonus : 1) * crowding(option)
          * (nearness ? nearness(here, option, player) : 1));
    }
    settle(name, place.minigame ? null : place.id);
    const target = new core.Location(place.x, place.y, place.z ?? 0);
    if (moveTo) {
      // Its own way there (an adventurer walks: Errands.PlayerBots.js).
      moveTo(player, place);
    } else if (core.TeleportHandler?.teleport && core.TeleportType?.NORMAL) {
      core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false);
    } else {
      player.moveTo(target);
    }
    if (state) {
      state.home = { x: place.x, y: place.y, z: place.z ?? 0 };
      // Where it went, for what it says there (Chatter.PlayerBots.js).
      state.place = { id: place.id, minigame: place.minigame ?? null, combatGear: place.combatGear === true };
      // A lobby keeps its bots inside (Wintertodt's safe corridor); anywhere else they roam freely.
      if (state.roaming) {
        const [minX, minY, maxX, maxY] = place.bounds ?? [];
        state.roaming.roamBounds = place.bounds
          ? { id: place.id, minX, minY, maxX, maxY, z: place.z ?? 0 }
          : null;
        state.roaming.target = null;
      }
    }
    if (place.outfit) {
      wear?.(player, place.outfit);
    } else if (place.combatGear) {
      // At a raid or boss entrance a high-level bot wears what it fights in.
      equipCombatGear?.(player, state);
    } else if (!place.hangout) {
      // New place, new job: a skiller changes into what fits it (Lumberjack, Prospector, Angler...).
      dress?.(player, mode);
    }
    log("bot_travel", { username: name || null, to: place.id, mode, hub: hub?.id ?? null, hangout: place.hangout === true, minigame: place.minigame ?? null, at: nowMs });
    return place;
  }
  travel.attendance = attendance;
  travel.occupancy = occupancy;
  return travel;
}

module.exports = { createTravel, minigamesFor, meetsMinigame, destinationsFor, hangoutsFor, hubsFor, hubFor, pickWeighted, levelFor, MIN_TRAVEL_TILES, data };
