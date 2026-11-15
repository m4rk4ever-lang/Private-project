"use strict";

/**
 * Smiths the bars it carries at the nearest anvil, into the best product its Smithing level
 * allows, through the smithing plugin's bot entry point (the anvil's own make loop: hammer,
 * level, bars and XP as for a player). Done when no bar of that kind is left.
 *
 * JSON: { "type": "smith", "bar": "Bronze bar" }
 */
const Smithing = require("../../../skills/Smithing.plugin");
const { resolveCatalogObjectIds } = require("../ObjectCatalog.PlayerBots");
const { playerState } = require("../ActionState.PlayerBots");
const { createObjectReachChecker } = require("../../behaviours/navigation/ObjectReach.PlayerBots");
const { approachBlockedObject, approachObject } = require("../../behaviours/navigation/Navigation.PlayerBots");

const MAX_DIRECT_ROUTE_TILES = 20;
const INTERACT_COOLDOWN_MS = 1500;

function createSmithAction(spec, world) {
  const anvilIds = resolveCatalogObjectIds({ catalog: "anvil" });
  const barName = String(spec.bar ?? "").replace(/_/g, " ").toLowerCase();
  const recipe = Smithing.SMELTING_RECIPES?.find((entry) => String(entry.name ?? "").toLowerCase() === barName) ?? null;
  const barId = recipe?.barId ?? null;
  const canReach = createObjectReachChecker(world.core);
  const hammerId = world.core.ItemIdentifiers.HAMMER;
  const stateFor = (player) => playerState(action, player, () => ({ lastClickAt: 0, started: false }));

  function nearestAnvil(player) {
    const loc = player.getLocation();
    const candidates = world.objectSearch?.findCandidatesByIds?.(player, anvilIds, {
      regionRadius: 2, z: loc.getZ(), privateArea: player.getPrivateArea?.() ?? null,
    }) ?? [];
    let best = null;
    let bestDistance = Infinity;
    for (const object of candidates) {
      const at = object?.getLocation?.();
      if (!at || at.getZ() !== loc.getZ()) continue;
      const distance = Math.max(Math.abs(at.getX() - loc.getX()), Math.abs(at.getY() - loc.getY()));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = object;
      }
    }
    return best;
  }

  const action = {
    id: "smith",
    update(ctx) {
      const { player, nowMs } = ctx;
      const bot = stateFor(player);
      if (!Number.isInteger(barId)) return "failed";
      if (Smithing.isSmithingActive?.(player)) return "running";
      if (player.getInventory().getAmount(barId) <= 0) return "success";
      // A hammer of its own; one that started and stopped with bars left can make nothing more.
      if (!player.getInventory().contains(hammerId)) return "failed";
      if (bot.started) {
        bot.started = false;
        return "success";
      }
      const anvil = nearestAnvil(player);
      if (!anvil) return "failed";
      const at = anvil.getLocation();
      const loc = player.getLocation();
      if (Math.max(Math.abs(loc.getX() - at.getX()), Math.abs(loc.getY() - at.getY())) > MAX_DIRECT_ROUTE_TILES) {
        approachObject(player, anvil, { nowMs, reason: "brain_anvil_approach" });
        return "running";
      }
      if (player.getForceMovement?.() != null || player.getMovementQueue?.()?.size?.() > 0) return "running";
      if (nowMs - bot.lastClickAt < INTERACT_COOLDOWN_MS) return "running";
      bot.lastClickAt = nowMs;
      if (approachBlockedObject(player, anvil, { nowMs, reason: "brain_anvil_approach", canReach })) return "running";
      player.getMovementQueue().walkToObject(anvil, {
        execute: () => {
          if (Smithing.startBotSmithing?.(player, barId, anvil)) bot.started = true;
        },
      });
      return "running";
    },
    stop(ctx) {
      const bot = stateFor(ctx.player);
      bot.lastClickAt = 0;
      bot.started = false;
    },
    describe() {
      return `smith bar=${barName}`;
    },
  };
  return action;
}

module.exports = { createSmithAction };
