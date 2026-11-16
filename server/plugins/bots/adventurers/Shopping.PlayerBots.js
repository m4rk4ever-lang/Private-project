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
      // Every place the keeper stands: one "Shop keeper" runs the general store of Lumbridge,
      // Varrock and more, and the nearest of them is the one to walk to.
      if (!Number.isInteger(spawn.id)) continue;
      if (!keeperAt.has(spawn.id)) keeperAt.set(spawn.id, []);
      keeperAt.get(spawn.id).push({ x: spawn.x, y: spawn.y, z: spawn.level ?? 0 });
    }
    for (const shop of Array.isArray(shopsFile) ? shopsFile : shopsFile.shops ?? []) {
      const npcIds = (shop.npcInteractions ?? []).flatMap((link) => link.npcIds ?? []);
      const keepers = npcIds.flatMap((id) => keeperAt.get(id) ?? []);
      if (keepers.length === 0) continue;
      for (const stock of shop.originalStock ?? []) {
        if (!shopIndex.has(stock.id)) shopIndex.set(stock.id, []);
        for (const keeper of keepers) shopIndex.get(stock.id).push({ shopId: shop.id, name: shop.name, keeper });
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

/** Owns it on it or in its bank: no second one is bought for a tool left at the bank. */
function ownsAnywhere(player, itemId) {
  return owns(player, itemId) || (player.getBanks?.() ?? []).some((bank) => (bank?.getAmount?.(itemId) ?? 0) > 0);
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
      if (!Number.isInteger(itemId) || ownsAnywhere(player, itemId)) return; // has the best it may use
      // From a shop, or (exchange) at the Grand Exchange at a little over its guide price.
      const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0);
      if (exchange ? !(guide > 0) : shopsSelling(itemId).length === 0) continue;
      wants.push({ itemId, name: entry.item, price: exchange ? Math.ceil(guide * 1.05) : estimatedPrice(core, itemId) });
      return;
    }
  };
  // Melee gear as one set of one metal, as a player buys it: the best tier (rune, adamant, ...)
  // whose missing pieces it can pay for all together, not a rune helm beside a mithril body.
  const priceOf = (itemId) => {
    if (!exchange) return shopsSelling(itemId).length > 0 ? estimatedPrice(core, itemId) : 0;
    const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0);
    return guide > 0 ? Math.ceil(guide * 1.05) : 0;
  };
  const usableOf = (list) => {
    const usable = list.filter((entry) => allowed(entry, { levelOf, questDone }))
      .map((entry) => ({ ...entry, itemId: idOf(core, entry.item), tier: tierOf(entry.item) }))
      .filter((entry) => Number.isInteger(entry.itemId));
    const ownedAt = usable.findIndex((entry) => ownsAnywhere(player, entry.itemId));
    return ownedAt < 0 ? usable : usable.slice(0, ownedAt);
  };
  // The weapon first and on its own: the best one it can pay for (a rune scimitar beside
  // adamant armour, as a player does), then the armour as one set.
  for (const entry of usableOf(gear.slots.weapon ?? [])) {
    const price = priceOf(entry.itemId);
    if (price > 0 && price <= budget) {
      wants.push({ itemId: entry.itemId, name: entry.item, price });
      budget -= price;
      break;
    }
  }
  const slots = Object.entries(gear.slots).filter(([slot]) => slot !== "weapon").map(([, list]) => usableOf(list));
  const tiers = [...new Set(slots.flatMap((list) => list.map((entry) => entry.tier)))].sort((a, b) => tierRank(a) - tierRank(b));
  let setChosen = false;
  for (const tier of tiers) {
    // Per slot the piece of this tier, or the best below it it does not have yet.
    const pieces = slots.map((list) => list.find((entry) => tierRank(entry.tier) >= tierRank(tier))).filter(Boolean)
      .map((entry) => ({ itemId: entry.itemId, name: entry.item, price: priceOf(entry.itemId) }))
      .filter((piece) => piece.price > 0);
    const cost = pieces.reduce((sum, piece) => sum + piece.price, 0);
    if (pieces.length > 0 && cost <= budget) {
      wants.push(...pieces);
      setChosen = true;
      break;
    }
  }
  // No whole set within reach: a single cheaper piece now and then (a weapon first, see below).
  if (!setChosen) for (const [slot, list] of Object.entries(gear.slots)) if (slot !== "weapon") consider(list);
  if (modes.includes("woodcutting")) {
    consider(gear.tools.axe);
    consider(gear.tools.knife ?? []);
  }
  if (modes.includes("mining")) {
    consider(gear.tools.pickaxe);
    consider(gear.tools.hammer ?? []);
  }
  // Bare-handed first buys a weapon, before tools or armour; otherwise the cheapest first.
  const weaponSlot = core.Equipment?.WEAPON_SLOT;
  const unarmed = !((player.getEquipment().getItems() ?? [])[weaponSlot]?.getId?.() > 0);
  const isWeapon = (want) => unarmed && Object.values(gear.slots).some((list, index) => Object.keys(gear.slots)[index] === "weapon"
    && list.some((entry) => idOf(core, entry.item) === want.itemId));
  const bought = [];
  // The whole list against the whole budget once (the weapon and set above were picked to fit).
  let spendable = Math.floor(coins * (gear.budgetShare ?? 0.6));
  for (const want of wants.sort((a, b) => (isWeapon(b) ? 1 : 0) - (isWeapon(a) ? 1 : 0) || a.price - b.price)) {
    if (want.price > spendable) continue;
    spendable -= want.price;
    bought.push(want);
  }
  return bought;
}

/** The metal of a gear piece ("RUNE_PLATEBODY" -> "RUNE") and its rank, best first. */
const TIER_ORDER = ["DRAGON", "RUNE", "ADAMANT", "MITHRIL", "BLACK", "STEEL", "IRON", "BRONZE"];
function tierOf(name) {
  return String(name).split("_")[0];
}
function tierRank(tier) {
  const index = TIER_ORDER.indexOf(tier);
  return index < 0 ? TIER_ORDER.length : index;
}

/** The tools an activity needs that the adventurer lacks (fishing nets, rods, harpoons). */
function missingTools(player, core, activityId) {
  return (gear.fishingTools[activityId] ?? [])
    .map((name) => ({ name, itemId: idOf(core, name) }))
    .filter((tool) => Number.isInteger(tool.itemId) && !ownsAnywhere(player, tool.itemId));
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
  ownsAnywhere,
  shopsSelling, nearestShop, shoppingList, missingTools, foodToBuy, buy, wear, coinsOf, owns, estimatedPrice, allowed, idOf, gear, COINS,
};
