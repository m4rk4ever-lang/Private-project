"use strict";

const { isHonest } = require("../Honest.PlayerBots");

/**
 * Bots that play Wintertodt (plugins/minigames/Wintertodt.plugin.js) as a player does. Each bot
 * picks a corner and keeps it. During a round it:
 *
 *   - fixes its brazier when it is broken (hammer) and lights it when it is out (tinderbox),
 *   - chops bruma roots at its corner until it carries a load (8 to 20, or a full inventory),
 *   - feeds the load to its burning brazier, root by root, for points,
 *   - drinks a rejuvenation potion when its warmth runs low, and steps back into the safe
 *     corridor when it has none left or its hitpoints are low.
 *
 * Between rounds it waits by its brazier. Every step goes through the Wintertodt plugin's own
 * handlers (chop, light, fix, feed, drink), so points, XP, warmth and the round all count the
 * bot like any player. The bot walks next to the object first, as a player must.
 */
const WALK_TIMEOUT_MS = 20_000;
const ROOT_SEARCH_TILES = 12;
const LOAD = [8, 20];
const LOW_WARMTH = 0.4;
const LOW_HITPOINTS = 0.4;
const POTION_DOSES = 2;
/** The arena's middle: a corner's standing tile is on the brazier's side that faces it. */
const ARENA_CENTRE = { x: 1630, y: 4006 };
const SAFE_TILE = { x: 1630, y: 3980 };

function wintertodt() {
  return {
    Shared: require("../../../minigames/wintertodt/Shared.Wintertodt"),
    Round: require("../../../minigames/wintertodt/Round.Wintertodt"),
    Corners: require("../../../minigames/wintertodt/Corners.Wintertodt"),
    Braziers: require("../../../minigames/wintertodt/Braziers.Wintertodt"),
    Supplies: require("../../../minigames/wintertodt/Supplies.Wintertodt"),
    Warmth: require("../../../minigames/wintertodt/Warmth.Wintertodt"),
  };
}

function walk(player, x, y, options) {
  return require("../../behaviours/navigation/Navigation.PlayerBots").requestMovement(player, x, y, options);
}

/** The tile beside a 3x3 brazier at (x, y) that faces the arena's middle. */
function brazierStand(brazier) {
  const y = brazier.y < ARENA_CENTRE.y ? brazier.y + 3 : brazier.y - 1;
  return { x: brazier.x + 1, y, z: 0 };
}

function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function here(player) {
  const at = player.getLocation();
  return { x: at.getX(), y: at.getY(), z: at.getZ() };
}

function createWintertodtAction(spec = {}, world = {}) {
  const random = world.random ?? Math.random;
  const move = world.requestMovement ?? walk;
  const load = spec.load ?? LOAD;
  let rootIds = spec.rootIds ?? null;

  function rootObjectIds() {
    if (!rootIds) {
      const { resolveCatalogObjectIds } = require("../ObjectCatalog.PlayerBots");
      rootIds = resolveCatalogObjectIds({ catalog: "minigame", tier: "Bruma roots", option: "Chop" });
    }
    return rootIds;
  }

  function nearestRoots(player, from) {
    const candidates = world.objectSearch?.findCandidatesByIds?.(player, rootObjectIds(), { regionRadius: 1, z: 0 }) ?? [];
    let best = null;
    let bestDistance = Infinity;
    for (const object of candidates) {
      const at = object.getLocation();
      const distance = chebyshev(from, { x: at.getX(), y: at.getY() });
      if (distance <= ROOT_SEARCH_TILES && distance < bestDistance) {
        best = object;
        bestDistance = distance;
      }
    }
    return best;
  }

  function give(player, id, amount = 1) {
    const { Item } = world.core ?? {};
    if (!Item || player.getInventory().contains(id)) return;
    player.getInventory().add(new Item(id, amount));
  }

  /** A bot comes with what a player brings: tinderbox, hammer and a couple of potions. */
  function packUp(player, wt) {
    give(player, wt.Shared.ITEM.TINDERBOX);
    give(player, wt.Shared.ITEM.HAMMER);
    const potions = wt.Shared.POTIONS.reduce((sum, id) => sum + player.getInventory().getAmount(id), 0);
    for (let i = potions; i < POTION_DOSES; i++) {
      player.getInventory().add(new world.core.Item(wt.Shared.ITEM.REJUVENATION_4, 1));
    }
    player.getInventory().refreshItems?.();
  }

  /** Walks next to `target`; true once there (within `range` tiles). */
  function approach(player, bot, target, range, nowMs) {
    const at = here(player);
    if (chebyshev(at, target) <= range) return true;
    if (player.getMovementQueue?.()?.size?.() > 0 && nowMs - bot.walkStarted < WALK_TIMEOUT_MS) return false;
    bot.walkStarted = nowMs;
    move(player, target.x, target.y, { reason: "brain_wintertodt", basicPather: true, z: 0 });
    return false;
  }

  function event(player, object, objectId, location) {
    return {
      player,
      objectId,
      object: object ?? { getLocation: () => new world.core.Location(location.x, location.y, 0) },
      sourceLocation: here(player),
    };
  }

  function drinkIfCold(player, wt) {
    const warmth = wt.Warmth.warmthOf(player) / wt.Shared.MAX_WARMTH;
    if (warmth >= LOW_WARMTH) return false;
    for (const id of [...wt.Shared.POTIONS].reverse()) {
      const slot = player.getInventory().getSlotForItemId?.(id) ?? -1;
      if (slot >= 0) {
        wt.Supplies.drink({ player, slot, itemId: id });
        return true;
      }
    }
    return false;
  }

  function inDanger(player, wt) {
    const hitpoints = player.getHitpoints?.() ?? 1;
    const max = player.getSkillManager?.()?.getMaxLevel?.(world.core?.Skill?.HITPOINTS) ?? 10;
    const warmth = wt.Warmth.warmthOf(player) / wt.Shared.MAX_WARMTH;
    return hitpoints / Math.max(1, max) < LOW_HITPOINTS || warmth < LOW_WARMTH / 2;
  }

  return {
    id: "wintertodt",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const wt = world.wintertodt ?? wintertodt();
      if (!state.wintertodt) {
        state.wintertodt = {
          corner: Math.floor(random() * wt.Shared.CORNERS.length),
          load: load[0] + Math.floor(random() * (load[1] - load[0] + 1)),
          walkStarted: 0,
        };
        // An honest bot (an adventurer) brings what it has.
        if (!state.honest && !isHonest(player)) packUp(player, wt);
      }
      const bot = state.wintertodt;
      // Busy chopping, feeding, lighting or fixing: the plugin's own action runs.
      if (wt.Shared.actionOf?.(player)) return "running";
      const corner = wt.Corners.corner(bot.corner);
      const brazier = corner.corner.brazier;
      const stand = brazierStand(brazier);

      if (!wt.Round.isActive()) {
        approach(player, bot, stand, 2, nowMs);
        return "running";
      }
      if (drinkIfCold(player, wt)) return "running";
      if (inDanger(player, wt)) {
        approach(player, bot, SAFE_TILE, 2, nowMs);
        return "running";
      }

      const inventory = player.getInventory();
      const roots = inventory.getAmount(wt.Shared.ITEM.BRUMA_ROOT) + inventory.getAmount(wt.Shared.ITEM.BRUMA_KINDLING);
      const brazierObject = { getLocation: () => new world.core.Location(brazier.x, brazier.y, 0) };
      if (corner.brazier === wt.Shared.BRAZIER.BROKEN) {
        if (approach(player, bot, stand, 1, nowMs)) wt.Braziers.fix(event(player, brazierObject, wt.Shared.OBJECT.BRAZIER_BROKEN));
        return "running";
      }
      if (corner.brazier === wt.Shared.BRAZIER.UNLIT && corner.pyromancerHealthy) {
        if (approach(player, bot, stand, 1, nowMs)) wt.Braziers.light(event(player, brazierObject, wt.Shared.OBJECT.BRAZIER_UNLIT));
        return "running";
      }
      const loaded = roots >= bot.load || (roots > 0 && inventory.isFull());
      if (loaded && corner.brazier === wt.Shared.BRAZIER.LIT) {
        if (approach(player, bot, stand, 1, nowMs)) {
          wt.Braziers.feed(event(player, brazierObject, wt.Shared.OBJECT.BRAZIER_LIT));
          bot.load = load[0] + Math.floor(random() * (load[1] - load[0] + 1));
        }
        return "running";
      }
      if (inventory.isFull()) {
        // A full pack and an unlit brazier with a hurt pyromancer: wait by it.
        approach(player, bot, stand, 2, nowMs);
        return "running";
      }
      const rootObject = nearestRoots(player, stand);
      if (!rootObject) {
        approach(player, bot, stand, 2, nowMs);
        return "running";
      }
      const at = rootObject.getLocation();
      const rootTile = { x: at.getX(), y: at.getY() };
      if (approach(player, bot, rootTile, 1, nowMs)) {
        wt.Supplies.chop(event(player, rootObject, rootObject.getId?.()));
      }
      return "running";
    },
    stop(ctx) {
      const player = ctx?.player;
      if (player) {
        try {
          (world.wintertodt ?? wintertodt()).Shared.stopAction(player);
        } catch (_) {
          // The Wintertodt plugin is not loaded: nothing to stop.
        }
      }
      if (ctx?.state) ctx.state.wintertodt = null;
    },
  };
}

module.exports = { createWintertodtAction, brazierStand };
