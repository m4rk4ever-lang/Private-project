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
 * The bot arrives with the normal teleport and its home moves there. Only skilling and
 * combat-training bots travel; PvP bots and bots in a fight or the Wilderness stay put, and no
 * place is in the Wilderness.
 */
const data = require("../data/travel-destinations.json");

const MODE_SKILL = Object.freeze({
  woodcutting: "WOODCUTTING",
  mining: "MINING",
  fishing: "FISHING",
});
/** How far from where it stands a place must be to be worth the teleport. */
const MIN_TRAVEL_TILES = 30;

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
    place.modes.includes(mode) && level >= (place.minLevel ?? 1) && farEnough(place, here));
}

/** The hangouts a bot of this combat level may go to, at least MIN_TRAVEL_TILES from `here`. */
function hangoutsFor(combatLevel, here, hangouts = data.hangouts ?? []) {
  return hangouts.filter((place) => combatLevel >= (place.minCombat ?? 1) && farEnough(place, here));
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
  core, log = () => {}, dress = null, equipCombatGear = null,
  random = Math.random, chance = data.chance, hangoutChance = data.hangoutChance ?? 0,
  ownHubChance = data.ownHubChance ?? 0, nearHubBonus = data.nearHubBonus ?? 1,
} = {}) {
  return function travel(player, state, activity, nowMs) {
    const mode = activity?.mode;
    if (!player || !mode || !(mode in MODE_SKILL || mode === "combat_training")) return null;
    if (random() >= chance) return null;
    const combat = player.getCombat?.();
    if (combat?.getTarget?.() || combat?.getAttacker?.()) return null;
    if (core.Wilderness?.isIn?.(player)) return null;
    const at = player.getLocation?.();
    const here = at ? { x: at.getX(), y: at.getY(), z: at.getZ() } : null;
    const level = levelFor(player, mode, core);
    const combatLevel = combatLevelOf(player);
    const hub = hubFor(player.getUsername?.() ?? "", mode, level, combatLevel);
    let place = null;
    if (random() < hangoutChance) {
      if (hub && random() < ownHubChance && farEnough(hub, here)) {
        place = { ...hub, hangout: true };
      } else {
        const hangouts = hangoutsFor(combatLevel, here);
        if (hangouts.length > 0) place = { ...pickWeighted(hangouts, random), hangout: true };
      }
    }
    if (!place) {
      const options = destinationsFor(mode, level, here);
      if (options.length === 0) return null;
      place = pickWeighted(options, random,
        (option) => (option.weight ?? 1) * (nearHub(option, hub) ? nearHubBonus : 1));
    }
    const target = new core.Location(place.x, place.y, place.z ?? 0);
    if (core.TeleportHandler?.teleport && core.TeleportType?.NORMAL) {
      core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false);
    } else {
      player.moveTo(target);
    }
    if (state) state.home = { x: place.x, y: place.y, z: place.z ?? 0 };
    if (place.combatGear) {
      // At a raid or boss entrance a high-level bot wears what it fights in.
      equipCombatGear?.(player, state);
    } else if (!place.hangout) {
      // New place, new job: a skiller changes into what fits it (Lumberjack, Prospector, Angler...).
      dress?.(player, mode);
    }
    log("bot_travel", { username: player.getUsername?.() ?? null, to: place.id, mode, hub: hub?.id ?? null, hangout: place.hangout === true, at: nowMs });
    return place;
  };
}

module.exports = { createTravel, destinationsFor, hangoutsFor, hubsFor, hubFor, pickWeighted, levelFor, MIN_TRAVEL_TILES, data };
