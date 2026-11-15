"use strict";

/**
 * Picking up what an honest bot (an adventurer) killed for: its own drops on the ground near it,
 * through the game's own pickup (reach, inventory space and ownership as for a player). That is
 * where its fighting income comes from; it sells the loot later (adventurers/Trade.PlayerBots.js).
 */
const { requestMovement, peekMovementRequest } = require("../behaviours/navigation/Navigation.PlayerBots");

/** How far from the bot it still goes for its loot. */
const LOOT_RADIUS = 8;
/** Loot worth less than this (the whole stack) stays on the ground. */
const MIN_VALUE = 25;
const COINS = 995;

function distance(a, b) {
  return Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY()));
}

/** The nearest of its own drops worth taking that fits in its inventory, or null. */
function lootNear(core, player, { radius = LOOT_RADIUS, minValue = MIN_VALUE, valueOf } = {}) {
  const manager = core.ItemOnGroundManager;
  const here = player.getLocation();
  let best = null;
  for (const ground of manager.ownedBy(player.getUsername())) {
    const at = ground.getPosition();
    if (at.getZ() !== here.getZ() || distance(at, here) > radius) continue;
    if (ground.getPrivateArea?.() !== (player.getPrivateArea?.() ?? null)) continue;
    const item = ground.getItem();
    if (manager.inventoryCapacity(player, item) <= 0) continue;
    if (item.getId() !== COINS && (valueOf?.(item.getId(), item.getAmount()) ?? 0) < minValue) continue;
    const away = distance(at, here);
    if (!best || away < best.away) best = { ground, away };
  }
  return best?.ground ?? null;
}

/**
 * One step toward taking `ground`: pick it up when in reach, else walk to it.
 * Returns "taken", "walking" or "gone".
 */
function takeStep(core, player, ground, { state, nowMs } = {}) {
  const manager = core.ItemOnGroundManager;
  if (!manager.exists(ground) || ground.isPendingRemoval?.()) return "gone";
  const at = ground.getPosition();
  if (distance(at, player.getLocation()) <= 1) {
    const before = player.getInventory().getAmount(ground.getItem().getId());
    manager.pickup(player, ground);
    if (player.getInventory().getAmount(ground.getItem().getId()) > before) return "taken";
  }
  if (player.getMovementQueue().size() > 0 || peekMovementRequest(player)) return "walking";
  requestMovement(player, at.getX(), at.getY(), { state, nowMs, z: at.getZ(), reason: "brain_loot", basicPather: true });
  return "walking";
}

module.exports = { lootNear, takeStep, LOOT_RADIUS, MIN_VALUE };
