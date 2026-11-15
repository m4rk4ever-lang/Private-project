"use strict";

/**
 * An adventurer's money, as a player earns it: coins come only from what it sells (its loot and
 * produce, at the Grand Exchange or a shop) and from what it finds (drops, coin pouches). Nothing
 * is conjured. The coins pay for its gear, tools and food (Shopping.PlayerBots.js).
 *
 * - Dropped gear it may wear and that beats what it wears goes on first (the game's own equip).
 * - It keeps its coins, food, tools and gear that is better than what it wears (for later).
 * - Everything else that trades is sold at the Grand Exchange, at the guide price, through the
 *   exchange itself ("ge:place-offer"): its slots, fill times and tax apply. Coins from finished
 *   offers are collected on its next visit ("ge:collect").
 */
const Shopping = require("./Shopping.PlayerBots");
const Value = require("../../interface/ValueWarning");

const COINS = 995;
const PLATINUM_TOKEN = 13204;
/** Tools and bait an adventurer keeps, beside its axes, pickaxes and fishing gear. */
const KEEP_TOOLS = ["TINDERBOX", "HAMMER", "CHISEL", "NEEDLE", "KNIFE", "FEATHER", "FISHING_BAIT"];

function gearLists() {
  const { slots = {}, tools = {} } = Shopping.gear;
  return [...Object.values(slots), ...Object.values(tools)];
}

function inventoryIds(player) {
  return new Set((player.getInventory().getItems() ?? []).filter((item) => item && item.getId() > 0).map((item) => item.getId()));
}

function equippedIds(player) {
  return new Set((player.getEquipment().getItems() ?? []).filter((item) => item && item.getId() > 0).map((item) => item.getId()));
}

/** For each gear list: the position of the best piece it wears (lists run best first). */
function wornRank(list, core, worn) {
  const index = list.findIndex((entry) => worn.has(Shopping.idOf(core, entry.item)));
  return index < 0 ? list.length : index;
}

/**
 * Wears found gear that beats what it wears and that its levels and quests allow, through the
 * game's equip. Returns the names it put on.
 */
function wearBest(player, core, { levelOf, questDone }) {
  const put = [];
  for (const list of Object.values(Shopping.gear.slots ?? {})) {
    const held = inventoryIds(player);
    const rank = wornRank(list, core, equippedIds(player));
    for (let index = 0; index < rank; index += 1) {
      const entry = list[index];
      const itemId = Shopping.idOf(core, entry.item);
      if (!held.has(itemId) || !Shopping.allowed(entry, { levelOf, questDone })) continue;
      if (Shopping.wear(player, core, itemId)) put.push(entry.item);
      break;
    }
  }
  return put;
}

/** The ids it does not sell: coins, food, tools, and gear better than what it wears. */
function keepIds(player, core, { isFood = () => false } = {}) {
  const keep = new Set([COINS, PLATINUM_TOKEN]);
  for (const name of KEEP_TOOLS) {
    const id = Shopping.idOf(core, name);
    if (Number.isInteger(id)) keep.add(id);
  }
  for (const names of Object.values(Shopping.gear.fishingTools ?? {})) {
    for (const name of names) {
      const id = Shopping.idOf(core, name);
      if (Number.isInteger(id)) keep.add(id);
    }
  }
  const worn = equippedIds(player);
  for (const list of gearLists()) {
    const rank = wornRank(list, core, worn);
    // Tools (axes, pickaxes) are kept whatever it wears: the best one it holds does the work.
    const isTool = Object.values(Shopping.gear.tools ?? {}).includes(list);
    list.forEach((entry, index) => {
      const id = Shopping.idOf(core, entry.item);
      if (Number.isInteger(id) && (isTool || index < rank)) keep.add(id);
    });
  }
  for (const id of inventoryIds(player)) if (isFood(id)) keep.add(id);
  return keep;
}

/** What it would sell: [{ itemId, amount, value }], tradeable items it does not keep. */
function goodsToSell(player, core, keep) {
  const totals = new Map();
  for (const item of player.getInventory().getItems() ?? []) {
    if (!item || !(item.getId() > 0) || keep.has(item.getId())) continue;
    totals.set(item.getId(), (totals.get(item.getId()) ?? 0) + item.getAmount());
  }
  return [...totals].map(([itemId, amount]) => ({ itemId, amount, value: Value.itemValue(core, itemId, amount) }))
    .filter((good) => good.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * At the Grand Exchange: collects finished offers, then offers its goods for sale (as many as
 * it has free slots). Returns { collectedCoins, offered: [{ itemId, amount, value }] }.
 */
function sellAtExchange(player, core, emit, goods) {
  const before = player.getInventory().getAmount(COINS);
  const collect = { player };
  emit("ge:collect", collect);
  const collectedCoins = player.getInventory().getAmount(COINS) - before;
  const offered = [];
  for (const good of goods) {
    const request = { player, sell: true, itemId: good.itemId, quantity: good.amount };
    emit("ge:place-offer", request);
    if (request.placed) offered.push(good);
    else if (request.placed === undefined) break;
  }
  return { collectedCoins, offered };
}

/**
 * A buy offer at the Grand Exchange, a little over the guide so it fills soon. Paid from the
 * coins it carries or its bank, as for a player. True when placed.
 */
function buyAtExchange(player, core, emit, itemId, quantity) {
  const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0) || 1;
  const request = { player, sell: false, itemId, quantity, price: Math.ceil(guide * 1.05) };
  emit("ge:place-offer", request);
  return request.placed === true;
}

/** Finished offers waiting to be collected, without collecting them. */
function finishedOffers(player, emit) {
  const peek = { player, peek: true };
  emit("ge:collect", peek);
  return peek.finished ?? 0;
}

module.exports = { wearBest, keepIds, goodsToSell, sellAtExchange, buyAtExchange, finishedOffers, COINS, KEEP_TOOLS };
