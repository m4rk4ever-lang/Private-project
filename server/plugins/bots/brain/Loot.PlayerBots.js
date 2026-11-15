"use strict";

/**
 * Picking up what an honest bot (an adventurer) killed for: its own drops on the ground near it,
 * through the game's own pickup (reach, inventory space and ownership as for a player). That is
 * where its fighting income comes from; it sells the loot later (adventurers/Trade.PlayerBots.js).
 */
// Navigation loads the game core: required on the first walk to loot.
const navigation = () => require("../behaviours/navigation/Navigation.PlayerBots");

/** How far from the bot it still goes for its loot. */
const LOOT_RADIUS = 8;
/** Loot worth less than this (the whole stack) stays on the ground. */
const MIN_VALUE = 25;
const COINS = 995;

function distance(a, b) {
  return Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY()));
}

function fillsEmptySlot(core, player, itemId) {
  const slot = core.ItemDefinition?.forId?.(itemId)?.getEquipmentType?.()?.getSlot?.();
  if (!Number.isInteger(slot) || slot < 0 || slot === core.Equipment?.AMMUNITION_SLOT) return false;
  return !((player.getEquipment?.()?.getItems?.()?.[slot]?.getId?.() ?? -1) > 0);
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
    // Cheap but useful: a piece for an empty slot (that wizard hat) is taken whatever it is worth.
    if (item.getId() !== COINS && (valueOf?.(item.getId(), item.getAmount()) ?? 0) < minValue && !fillsEmptySlot(core, player, item.getId())) continue;
    const away = distance(at, here);
    if (!best || away < best.away) best = { ground, away };
  }
  return best?.ground ?? null;
}

/**
 * A drop that fills an empty slot goes on at once (an imp's wizard hat on a bare head): through
 * the game's own equip, so its level requirements apply. Ammunition and a slot it already
 * fills are left alone (the bot's planner decides upgrades).
 */
function wearIfFree(core, player, itemId) {
  const slot = core.ItemDefinition?.forId?.(itemId)?.getEquipmentType?.()?.getSlot?.();
  if (!Number.isInteger(slot) || slot < 0 || slot === core.Equipment?.AMMUNITION_SLOT) return false;
  if ((player.getEquipment().getItems()[slot]?.getId?.() ?? -1) > 0) return false;
  const inventorySlot = player.getInventory().getItems().findIndex((item) => item?.getId?.() === itemId);
  if (inventorySlot < 0 || !core.EquipPacketListener?.equip) return false;
  core.EquipPacketListener.equip(player, itemId, inventorySlot, core.Inventory.INTERFACE_ID);
  return true;
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
    const itemId = ground.getItem().getId();
    const before = player.getInventory().getAmount(itemId);
    manager.pickup(player, ground);
    if (player.getInventory().getAmount(itemId) > before) {
      wearIfFree(core, player, itemId);
      return "taken";
    }
  }
  if (player.getMovementQueue().size() > 0 || navigation().peekMovementRequest(player)) return "walking";
  navigation().requestMovement(player, at.getX(), at.getY(), { state, nowMs, z: at.getZ(), reason: "brain_loot", basicPather: true });
  return "walking";
}

module.exports = { lootNear, takeStep, wearIfFree, LOOT_RADIUS, MIN_VALUE };
