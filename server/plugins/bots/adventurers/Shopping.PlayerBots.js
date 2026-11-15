"use strict";

/**
 * Adventurers buy what they need, as a player does: from a shop in the world that really stocks
 * it (data/definitions/shops.json), at the keeper (npc-spawns.json), through the normal shop code,
 * so the price, the stock and their own coins are what they are. Nothing is conjured.
 *
 * What to buy comes from data/adventurer-gear.json: per gear slot and tool the best item their
 * level and quests allow, that they do not have yet, and that costs at most `budgetShare` of the
 * coins they carry.
 */
const shopsFile = require("../../../data/definitions/shops.json");
const spawnsFile = require("../../../data/definitions/npc-spawns.json");
const gear = require("../data/adventurer-gear.json");

const COINS = 995;

let shopIndex = null;

/** item id -> [{ shopId, name, keeper: { x, y, z } }], for shops whose keeper stands somewhere. */
function shopsSelling(itemId) {
  if (!shopIndex) {
    shopIndex = new Map();
    const spawns = Array.isArray(spawnsFile) ? spawnsFile : spawnsFile.spawns ?? [];
    const keeperAt = new Map();
    for (const spawn of spawns) {
      if (Number.isInteger(spawn.id) && !keeperAt.has(spawn.id)) keeperAt.set(spawn.id, { x: spawn.x, y: spawn.y, z: spawn.level ?? 0 });
    }
    for (const shop of Array.isArray(shopsFile) ? shopsFile : shopsFile.shops ?? []) {
      const npcIds = (shop.npcInteractions ?? []).flatMap((link) => link.npcIds ?? []);
      const keeper = npcIds.map((id) => keeperAt.get(id)).find(Boolean);
      if (!keeper) continue;
      for (const stock of shop.originalStock ?? []) {
        if (!shopIndex.has(stock.id)) shopIndex.set(stock.id, []);
        shopIndex.get(stock.id).push({ shopId: shop.id, name: shop.name, keeper });
      }
    }
  }
  return shopIndex.get(itemId) ?? [];
}

function idOf(core, name) {
  return core.ItemIdentifiers?.[name];
}

/** The nearest shop that sells `itemId`, from `from` (x, y). */
function nearestShop(itemId, from) {
  let best = null;
  for (const shop of shopsSelling(itemId)) {
    const distance = Math.max(Math.abs(shop.keeper.x - from.x), Math.abs(shop.keeper.y - from.y));
    if (!best || distance < best.distance) best = { ...shop, distance };
  }
  return best;
}

/** What a shop will roughly ask: the item's value (shops sell at value or a little above). */
function estimatedPrice(core, itemId, amount = 1) {
  const definition = core.ItemDefinition?.forId?.(itemId);
  const value = Number(definition?.getValue?.() ?? 0) || 1;
  return Math.ceil(value * 1.3) * amount;
}

function coinsOf(player) {
  return player.getInventory().getAmount(COINS);
}

function owns(player, itemId) {
  if (player.getInventory().contains(itemId)) return true;
  return (player.getEquipment().getItems() ?? []).some((item) => item?.getId?.() === itemId);
}

/** Whether the adventurer meets an entry's skill level and quests. */
function allowed(entry, { levelOf, questDone }) {
  if (levelOf(entry.skill) < (entry.level ?? 1)) return false;
  return (entry.quests ?? []).every((quest) => questDone(quest));
}

/**
 * The purchases worth making now: per slot the best allowed item that is better than what it
 * has, sold somewhere, and affordable within the budget (cheapest first so the coins go round).
 */
function shoppingList(player, core, { levelOf, questDone, modes = [], exchange = false }) {
  const coins = coinsOf(player);
  let budget = Math.floor(coins * (gear.budgetShare ?? 0.6));
  const wants = [];
  const consider = (list) => {
    for (const entry of list) {
      if (!allowed(entry, { levelOf, questDone })) continue;
      const itemId = idOf(core, entry.item);
      if (!Number.isInteger(itemId) || owns(player, itemId)) return; // has the best it may use
      // From a shop, or (exchange) at the Grand Exchange at a little over its guide price.
      const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0);
      if (exchange ? !(guide > 0) : shopsSelling(itemId).length === 0) continue;
      wants.push({ itemId, name: entry.item, price: exchange ? Math.ceil(guide * 1.05) : estimatedPrice(core, itemId) });
      return;
    }
  };
  for (const list of Object.values(gear.slots)) consider(list);
  if (modes.includes("woodcutting")) {
    consider(gear.tools.axe);
    consider(gear.tools.knife ?? []);
  }
  if (modes.includes("mining")) {
    consider(gear.tools.pickaxe);
    consider(gear.tools.hammer ?? []);
  }
  const bought = [];
  for (const want of wants.sort((a, b) => a.price - b.price)) {
    if (want.price > budget) continue;
    budget -= want.price;
    bought.push(want);
  }
  return bought;
}

/** The tools an activity needs that the adventurer lacks (fishing nets, rods, harpoons). */
function missingTools(player, core, activityId) {
  return (gear.fishingTools[activityId] ?? [])
    .map((name) => ({ name, itemId: idOf(core, name) }))
    .filter((tool) => Number.isInteger(tool.itemId) && !owns(player, tool.itemId));
}

/** Food to buy when it carries none: the best its Hitpoints suit, sold somewhere. */
function foodToBuy(player, core, hitpointsLevel) {
  for (const entry of gear.food) {
    if (hitpointsLevel < entry.level) continue;
    const itemId = idOf(core, entry.item);
    if (Number.isInteger(itemId) && shopsSelling(itemId).length > 0) return { itemId, name: entry.item, amount: gear.foodAmount };
  }
  return null;
}

/**
 * Buys through the shop: open it, find the item's slot, buy, close. Returns how many it got
 * (0 when the shop is out of stock or the coins do not reach).
 */
function buy(player, core, shopId, itemId, amount = 1) {
  const { ShopManager } = core;
  const before = player.getInventory().getAmount(itemId);
  if (!ShopManager.open(player, shopId, true)) return 0;
  try {
    const shop = ShopManager.currentShop(player);
    const entries = shop ? ShopManager.displayEntries(shop, player) : [];
    const slot = entries.findIndex((entry) => entry?.itemId === itemId);
    if (slot >= 0) {
      ShopManager.handleItemContainerAction(player, {
        kind: "buy_sell", containerId: ShopManager.ITEMS_INTERFACE_ID, slot, itemId, amount,
      });
    }
  } finally {
    ShopManager.close(player);
  }
  return player.getInventory().getAmount(itemId) - before;
}

/**
 * Wears a piece from the inventory through the game's own equip (its level and quest checks
 * apply, as for a player); what it wore goes back to the inventory. False when it may not.
 */
function wear(player, core, itemId) {
  const inventorySlot = player.getInventory().getItems().findIndex((item) => item?.getId?.() === itemId);
  if (inventorySlot < 0) return false;
  core.EquipPacketListener.equip(player, itemId, inventorySlot, core.Inventory.INTERFACE_ID);
  return (player.getEquipment().getItems() ?? []).some((item) => item?.getId?.() === itemId);
}

module.exports = {
  shopsSelling, nearestShop, shoppingList, missingTools, foodToBuy, buy, wear, coinsOf, owns, estimatedPrice, allowed, idOf, gear, COINS,
};
