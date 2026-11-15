"use strict";

/**
 * Bots travel the world: when a bot's rotation switches activity (bot-sites.json
 * `switchMinutes`), it may teleport to another place where that activity can be done, so bots
 * turn up all over the world rather than only around their spawn site. The place is picked
 * from data/travel-destinations.json among those that offer the new activity's mode and suit
 * the bot's level (the skill for a skilling mode, the combat level for combat training). The bot
 * arrives with the normal teleport, and its home moves there: searches and roaming start from it,
 * and the activity walks to the nearest tree, rock, fishing spot or monster cluster as usual. A
 * skiller also changes clothes for the new job (SiteSpawner's dressForMode).
 *
 * Only skilling and combat-training bots travel; PvP bots and bots in a fight, a bank trip or
 * the Wilderness stay put, and no destination is in the Wilderness.
 */
const data = require("../data/travel-destinations.json");

const MODE_SKILL = Object.freeze({
  woodcutting: "WOODCUTTING",
  mining: "MINING",
  fishing: "FISHING",
});
/** How far from where it stands a destination must be to be worth the teleport. */
const MIN_TRAVEL_TILES = 30;

function levelFor(player, mode, core) {
  if (mode === "combat_training") return player.getSkillManager?.()?.getCombatLevel?.() ?? player.getCombatLevel?.() ?? 3;
  const skill = core.Skill?.[MODE_SKILL[mode]];
  return skill ? player.getSkillManager?.()?.getMaxLevel?.(skill) ?? 1 : 0;
}

/** The destinations for a mode and level, at least MIN_TRAVEL_TILES from `here`. */
function destinationsFor(mode, level, here, destinations = data.destinations) {
  return destinations.filter((place) =>
    place.modes.includes(mode)
    && level >= (place.minLevel ?? 1)
    && (!here || here.z !== (place.z ?? 0)
      || Math.max(Math.abs(here.x - place.x), Math.abs(here.y - place.y)) >= MIN_TRAVEL_TILES));
}

/**
 * Returns `travel(player, state, activity, nowMs)`: teleports the bot to a fitting destination
 * (with `chance`) and moves its home there. Returns the destination, or null when it stays.
 */
function createTravel({ core, log = () => {}, dress = null, random = Math.random, chance = data.chance } = {}) {
  return function travel(player, state, activity, nowMs) {
    const mode = activity?.mode;
    if (!player || !mode || !(mode in MODE_SKILL || mode === "combat_training")) return null;
    if (random() >= chance) return null;
    const combat = player.getCombat?.();
    if (combat?.getTarget?.() || combat?.getAttacker?.()) return null;
    if (core.Wilderness?.isIn?.(player)) return null;
    const at = player.getLocation?.();
    const here = at ? { x: at.getX(), y: at.getY(), z: at.getZ() } : null;
    const options = destinationsFor(mode, levelFor(player, mode, core), here);
    if (options.length === 0) return null;
    const place = options[Math.floor(random() * options.length)];
    const target = new core.Location(place.x, place.y, place.z ?? 0);
    if (core.TeleportHandler?.teleport && core.TeleportType?.NORMAL) {
      core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false);
    } else {
      player.moveTo(target);
    }
    if (state) state.home = { x: place.x, y: place.y, z: place.z ?? 0 };
    // New place, new job: a skiller changes into what fits it (Lumberjack, Prospector, Angler...).
    dress?.(player, mode);
    log("bot_travel", { username: player.getUsername?.() ?? null, to: place.id, mode, at: nowMs });
    return place;
  };
}

module.exports = { createTravel, destinationsFor, levelFor, MIN_TRAVEL_TILES, data };
