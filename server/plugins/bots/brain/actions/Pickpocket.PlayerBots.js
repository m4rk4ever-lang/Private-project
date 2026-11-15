"use strict";

/**
 * Pickpocketing, as a thief trains it: find the nearest NPC of the activity's kind (men and
 * women in Lumbridge, guards in Ardougne, knights of Ardougne at the market), walk up to it and
 * pick its pocket through the Thieving plugin's own handler, so loot, XP, stuns and coin pouches
 * work as for a player. Between attempts the bot:
 *
 *   - waits out a stun (the handler refuses while stunned anyway),
 *   - opens its coin pouches before the plugin's limit,
 *   - eats when its hitpoints run low, from a stack of food it brings (cake by default).
 */
const SEARCH_TILES = 15;
const WALK_TIMEOUT_MS = 15_000;
const POUCH_OPEN_AT = 20;
const LOW_HITPOINTS = 0.5;
const FOOD = { name: "CAKE", heal: 4, amount: 10 };
const EAT_ANIMATION = 829;
const ATTEMPT_MS = 1800;

function thieving() {
  return require("../../../skills/thieving/Pickpocket.Thieving");
}

function walk(player, x, y, options) {
  return require("../../behaviours/navigation/Navigation.PlayerBots").requestMovement(player, x, y, options);
}

function chebyshev(a, b) {
  return Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY()));
}

function nameOf(npc) {
  return String(npc?.getDefinition?.()?.getName?.() ?? "");
}

function createPickpocketAction(spec = {}, world = {}) {
  const names = new Set((spec.npcs ?? []).map((name) => name.toLowerCase()));
  const move = world.requestMovement ?? walk;
  const plugin = () => world.pickpocket ?? thieving();

  function foodId() {
    return world.foodId ?? require("../../../../src/main/typescript/elvarg/util/ItemIdentifiers").ItemIdentifiers[spec.food ?? FOOD.name];
  }

  function nearestTarget(player) {
    const here = player.getLocation();
    let best = null;
    let bestDistance = Infinity;
    for (const npc of player.getLocalNpcs?.() ?? []) {
      if (!npc || npc.isRegistered?.() === false || !names.has(nameOf(npc).toLowerCase())) continue;
      const distance = chebyshev(npc.getLocation(), here);
      if (distance <= SEARCH_TILES && distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Opens every coin pouch into coins, as "Open-all" does. */
  function openPouches(player) {
    const { POUCH_COINS, pouchCoins } = plugin();
    const inventory = player.getInventory();
    let coins = 0;
    for (const id of POUCH_COINS.keys()) {
      const amount = inventory.getAmount(id);
      if (amount <= 0) continue;
      for (let i = 0; i < amount; i++) coins += pouchCoins(id);
      inventory.deleteNumber(id, amount);
    }
    if (coins > 0) inventory.add(new world.core.Item(995, coins));
    inventory.refreshItems?.();
  }

  function pouchCount(player) {
    const { POUCH_COINS } = plugin();
    let count = 0;
    for (const id of POUCH_COINS.keys()) count += player.getInventory().getAmount(id);
    return count;
  }

  function eatIfHurt(player, honest = false) {
    const max = player.getSkillManager?.()?.getMaxLevel?.(world.core.Skill.HITPOINTS) ?? 10;
    if (player.getHitpoints() / Math.max(1, max) >= LOW_HITPOINTS) return false;
    const id = foodId();
    const inventory = player.getInventory();
    if (!Number.isInteger(id) || inventory.getAmount(id) <= 0) {
      // An honest bot (an adventurer) eats only what it carries.
      if (honest) return false;
      inventory.add(new world.core.Item(id, spec.foodAmount ?? FOOD.amount));
    }
    inventory.delete(id, 1);
    inventory.refreshItems?.();
    player.heal(spec.foodHeal ?? FOOD.heal);
    player.performAnimation(new world.core.Animation(EAT_ANIMATION));
    return true;
  }

  return {
    id: "pickpocket",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.pickpocket ??= { nextAt: 0, walkStarted: 0 });
      if (nowMs < bot.nextAt) return "running";
      if (player.getTimers?.()?.getTicks?.(world.core.TimerKey?.STUN) > 0) return "running";
      if (eatIfHurt(player, state.honest === true)) {
        bot.nextAt = nowMs + ATTEMPT_MS;
        return "running";
      }
      if (pouchCount(player) >= POUCH_OPEN_AT) openPouches(player);
      const npc = nearestTarget(player);
      if (!npc) {
        // None here: walk the home area until one comes into view.
        if (state.home && nowMs - bot.walkStarted > WALK_TIMEOUT_MS) {
          bot.walkStarted = nowMs;
          move(player, state.home.x + Math.floor(Math.random() * 11) - 5, state.home.y + Math.floor(Math.random() * 11) - 5,
            { reason: "brain_pickpocket", basicPather: true, z: state.home.z ?? 0 });
        }
        return "running";
      }
      if (chebyshev(npc.getLocation(), player.getLocation()) > 1) {
        if (player.getMovementQueue?.()?.size?.() > 0 && nowMs - bot.walkStarted < WALK_TIMEOUT_MS) return "running";
        bot.walkStarted = nowMs;
        move(player, npc.getLocation().getX(), npc.getLocation().getY(), { reason: "brain_pickpocket", basicPather: true, z: npc.getLocation().getZ() });
        return "running";
      }
      plugin().pickpocket({ player, npc, npcId: npc.getId?.(), definition: npc.getDefinition(), option: "Pickpocket" });
      bot.nextAt = nowMs + ATTEMPT_MS;
      return "running";
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.pickpocket = null;
    },
  };
}

module.exports = { createPickpocketAction };
