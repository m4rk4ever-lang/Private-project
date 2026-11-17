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
      // Not the shops of other game modes (Deadman's Bounty Hunter shop in Edgeville, paid in
      // other currency): a bot walked there for prayer potions, found none, and went on to the GE.
      if (/deadman|bounty hunter|leagues?|tournament|\(pvp\)/i.test(String(shop.name ?? ""))) continue;
      // Only shops that take coins (not marks of grace, tokkul, Nightmare Zone points ...).
      if (shop.currency && !/^(coins?|gp)$/i.test(String(shop.currency))) continue;
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
  // A second level some pieces need too (granite: Strength 50 beside Defence 50).
  if (Object.entries(entry.also ?? {}).some(([skill, level]) => levelOf(skill) < level)) return false;
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
    for (const entry of list.map((piece) => variantOf(core, piece, player))) {
      if (!allowed(entry, { levelOf, questDone })) continue;
      const itemId = idOf(core, entry.item);
      // Earned, not bought (a fire cape): the best it has when it has it, else the next one down.
      if (entry.earned) {
        if (Number.isInteger(itemId) && ownsAnywhere(player, itemId)) return;
        continue;
      }
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
    const usable = list.map((entry) => variantOf(core, entry, player)).filter((entry) => allowed(entry, { levelOf, questDone }))
      .map((entry) => ({ ...entry, itemId: idOf(core, entry.item), tier: entry.tier ?? tierOf(entry.item) }))
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
  // A cape of its own colour once it has a few coins over, as players wear one for the look.
  const wearsCape = Number.isInteger(core.Equipment?.CAPE_SLOT) && (player.getEquipment().getItems() ?? [])[core.Equipment.CAPE_SLOT]?.getId?.() > 0;
  const capeId = idOf(core, capeOf(player));
  if (!wearsCape && Number.isInteger(capeId) && !ownsAnywhere(player, capeId) && coins >= 2000) {
    const price = priceOf(capeId);
    if (price > 0) wants.push({ itemId: capeId, name: capeOf(player), price });
  }
  // No whole set within reach: a single cheaper piece now and then (a weapon first, see below).
  // A two-handed weapon of its own (a scythe): no shield to buy beside it (with an axe in hand
  // the shield slot is empty for a while; a max-level account bought a rune kiteshield for it).
  const ownsTwoHanded = (gear.slots.weapon ?? []).some((entry) => {
    const id = idOf(core, entry.item);
    return Number.isInteger(id) && ownsAnywhere(player, id) && core.ItemDefinition?.forId?.(id)?.isDoubleHanded?.() === true;
  });
  if (!setChosen) for (const [slot, list] of Object.entries(gear.slots)) if (slot !== "weapon" && !(slot === "shield" && ownsTwoHanded)) consider(list);
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

/**
 * Each adventurer's own taste in gear (fixed by its name, so it keeps it): a longsword or a
 * battleaxe instead of a scimitar, a square shield, a medium helm, a chainbody, a plateskirt,
 * and a cape colour. Same metal, same levels; the dragon pieces keep their own names and quests.
 */
const VARIANTS = Object.freeze({
  SCIMITAR: [["SCIMITAR", 4], ["LONGSWORD", 2], ["BATTLEAXE", 2], ["WARHAMMER", 1], ["MACE", 1]],
  KITESHIELD: [["KITESHIELD", 2], ["SQ_SHIELD", 1]],
  FULL_HELM: [["FULL_HELM", 2], ["MED_HELM", 1]],
  PLATEBODY: [["PLATEBODY", 2], ["CHAINBODY", 1]],
  PLATELEGS: [["PLATELEGS", 2], ["PLATESKIRT", 1]],
});
const CAPES = ["RED_CAPE", "BLUE_CAPE", "GREEN_CAPE", "YELLOW_CAPE", "BLACK_CAPE", "PURPLE_CAPE", "ORANGE_CAPE", "PINK_CAPE"];
const METALS = new Set(["BRONZE", "IRON", "STEEL", "BLACK", "MITHRIL", "ADAMANT", "RUNE"]);

function tasteRoll(name, key) {
  let hash = 2166136261;
  for (const char of `${name}:${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash % 1000) / 1000;
}

/** The piece this adventurer would take for `entry` (its own taste), with its quests. */
function variantOf(core, entry, player) {
  const name = player?.getUsername?.() ?? "";
  const [metal, ...rest] = String(entry.item).split("_");
  const part = rest.join("_");
  if (!name || !METALS.has(metal) || !VARIANTS[part]) return entry;
  const options = VARIANTS[part];
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = tasteRoll(name, part) * total;
  const [choice] = options.find(([, weight]) => (roll -= weight) < 0) ?? options[0];
  const item = `${metal}_${choice}`;
  if (item === entry.item || !Number.isInteger(idOf(core, item))) return entry;
  // The quest of the piece it replaces is that piece's (Dragon Slayer I for a rune platebody).
  return { ...entry, item, quests: [] };
}

/** Its cape colour (CAPES), by taste. */
function capeOf(player) {
  return CAPES[Math.floor(tasteRoll(player?.getUsername?.() ?? "", "CAPE") * CAPES.length)];
}

/** The metal of a gear piece ("RUNE_PLATEBODY" -> "RUNE") and its rank, best first. */
// From the best a player gets to (Bandos, Barrows) down to bronze.
const TIER_ORDER = ["TORVA", "BANDOS", "DHAROKS", "DRAGON", "NEITIZNOT", "GRANITE", "RUNE", "ADAMANT", "MITHRIL", "BLACK", "STEEL", "IRON", "BRONZE"];
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
  // No shield beside a two-handed weapon (a scythe, a bow): the game would take the weapon off for
  // it (a wooden shield from Tutorial Island took a scythe off this way).
  const definition = core.ItemDefinition?.forId?.(itemId);
  const shieldSlot = core.Equipment?.SHIELD_SLOT ?? 5;
  if (definition?.getEquipmentType?.()?.getSlot?.() === shieldSlot) {
    const weapon = player.getEquipment().getItems()?.[core.Equipment?.WEAPON_SLOT ?? 3];
    if (weapon && weapon.getId() > 0 && core.ItemDefinition?.forId?.(weapon.getId())?.isDoubleHanded?.() === true) return false;
  }
  core.EquipPacketListener.equip(player, itemId, inventorySlot, core.Inventory.INTERFACE_ID);
  return (player.getEquipment().getItems() ?? []).some((item) => item?.getId?.() === itemId);
}

module.exports = {
  variantOf, capeOf,
  ownsAnywhere,
  shopsSelling, nearestShop, shoppingList, missingTools, foodToBuy, buy, wear, coinsOf, owns, estimatedPrice, allowed, idOf, gear, COINS,
};
