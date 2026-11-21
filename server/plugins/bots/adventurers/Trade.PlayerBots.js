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
// A pot, a bucket and a jug too: quests and cooking ask for them (Cook's Assistant), and they
// fetch next to nothing on the exchange.
// The air talisman: bought for Runecrafting (buyToTrain), its tool for the Air altar every trip.
const KEEP_TOOLS = ["TINDERBOX", "HAMMER", "CHISEL", "NEEDLE", "KNIFE", "FEATHER", "FISHING_BAIT", "POT", "BUCKET", "JUG", "AIR_TALISMAN",
  // Farming and Construction tools (farm runs, building in its house).
  "RAKE", "SEED_DIBBER", "SPADE", "SAW"];

/** A gear list in this adventurer's own taste (a battleaxe for a scimitar: Shopping.variantOf). */
function tasted(list, core, player) {
  return player && core ? list.map((entry) => Shopping.variantOf(core, entry, player)) : list;
}

function gearLists(player = null, core = null) {
  const { slots = {}, tools = {}, styles = {} } = Shopping.gear;
  return [...Object.values(slots).map((list) => tasted(list, core, player)), ...Object.values(tools),
    ...Object.values(styles).flatMap((style) => Object.values(style))];
}

function inventoryIds(player) {
  return new Set((player.getInventory().getItems() ?? []).filter((item) => item && item.getId() > 0).map((item) => item.getId()));
}

function equippedIds(player) {
  return new Set((player.getEquipment().getItems() ?? []).filter((item) => item && item.getId() > 0).map((item) => item.getId()));
}

/** Runes, ammunition (arrows, bolts, darts), teleport tablets and charged teleport jewellery. */
/** A prayer restoring potion (Barrows, bosses): stock to use up to a reserve, the rest goods. */
function isPrayerRestore(core, itemId) {
  const name = String(core.ItemDefinition?.forId?.(itemId)?.getName?.() ?? "").toLowerCase();
  return /^(prayer potion|super restore|sanfew serum)\(\d\)$/.test(name);
}

function isSupply(core, itemId) {
  const definition = core.ItemDefinition?.forId?.(itemId);
  const name = String(definition?.getName?.() ?? "").toLowerCase();
  if (/ rune$/.test(name) || / teleport$/.test(name) || /\(\d+\)$/.test(name) && /(glory|necklace|ring of|bracelet|pendant)/.test(name)) return true;
  const slot = definition?.getEquipmentType?.()?.getSlot?.();
  return Number.isInteger(slot) && slot === core.Equipment?.AMMUNITION_SLOT;
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
/** Whether the weapon it wears takes both hands. */
function twoHanded(player, core) {
  const weapon = player.getEquipment().getItems()?.[core.Equipment?.WEAPON_SLOT ?? 3];
  if (!weapon || !(weapon.getId() > 0)) return false;
  try {
    return weapon.getDefinition?.()?.isDoubleHanded?.() === true || core.ItemDefinition?.forId?.(weapon.getId())?.isDoubleHanded?.() === true;
  } catch {
    return false;
  }
}

function listsFor(style = "melee", player = null, core = null) {
  const lists = Object.fromEntries(Object.entries(Shopping.gear.slots ?? {}).map(([slot, list]) => [slot, tasted(list, core, player)]));
  const own = Shopping.gear.styles?.[style];
  // Its own weapon, ammunition and armour (leather and d'hide, robes) instead of the melee pieces.
  for (const [slot, list] of Object.entries(own ?? {})) lists[slot] = list;
  // A bow takes both hands: no shield with it.
  if (style === "ranged") delete lists.shield;
  return lists;
}

/**
 * The way of fighting its worn weapon is for: "magic" with a staff or wand of the magic list,
 * "ranged" with a bow, else "melee". Between jobs (no plan yet, a restart) the gear stays with it:
 * Markbot 10 trained Magic with its staff in a rune platebody and a berserker helm, put on by the
 * look between jobs that took melee for granted (20-11-2026).
 */
function wornStyle(player, core) {
  const worn = equippedIds(player);
  for (const style of ["magic", "ranged"]) {
    if ((Shopping.gear.styles?.[style]?.weapon ?? []).some((entry) => worn.has(Shopping.idOf(core, entry.item)))) return style;
  }
  return "melee";
}

function wearBest(player, core, { levelOf, questDone }, style = "melee", { skipWeapon = false } = {}) {
  const put = [];
  for (const [slot, list] of Object.entries(listsFor(style, player, core))) {
    // A job with its tool in hand (an axe, a pickaxe): the weapon stays off until it is done.
    if (skipWeapon && slot === "weapon") continue;
    // A two-handed weapon in hand (a scythe, a bow, a two-handed staff): no shield beside it, or
    // the shield took the weapon off and the weapon the shield, again and again.
    if (slot === "shield" && twoHanded(player, core)) continue;
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

/**
 * Gear in its bank that beats what it wears and what it carries, per slot, and that its levels
 * and quests allow: the ids to take out before wearBest. A whip or a rapier in the bank was never
 * worn while it fought with a dragon scimitar (high-level bots, 20-11-2026): wearBest looks in
 * the bag only. One id per slot, the best; none for the weapon while a tool is in hand.
 */
function bankUpgrades(player, core, { levelOf, questDone }, style = "melee", bankIds = new Set(), { skipWeapon = false } = {}) {
  const out = [];
  const held = inventoryIds(player);
  for (const [slot, list] of Object.entries(listsFor(style, player, core))) {
    if (skipWeapon && slot === "weapon") continue;
    if (slot === "shield" && twoHanded(player, core)) continue;
    const allowed = (entry) => Shopping.allowed(entry, { levelOf, questDone });
    // What it has now: worn, or the best allowed piece in its bag (wearBest puts that on anyway).
    let rank = wornRank(list, core, equippedIds(player));
    const carried = list.findIndex((entry) => held.has(Shopping.idOf(core, entry.item)) && allowed(entry));
    if (carried >= 0 && carried < rank) rank = carried;
    for (let index = 0; index < rank; index += 1) {
      const entry = list[index];
      const itemId = Shopping.idOf(core, entry.item);
      if (!Number.isInteger(itemId) || !bankIds.has(itemId) || !allowed(entry)) continue;
      out.push(itemId);
      break;
    }
  }
  return out;
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
  const tools = new Set(Object.values(Shopping.gear.tools ?? {}));
  for (const list of gearLists(player, core)) {
    const rank = wornRank(list, core, worn);
    // Tools (axes, pickaxes) are kept whatever it wears: the best one it holds does the work.
    const isTool = tools.has(list);
    list.forEach((entry, index) => {
      const id = Shopping.idOf(core, entry.item);
      if (Number.isInteger(id) && (isTool || index < rank)) keep.add(id);
    });
  }
  // What it uses up and needs plenty of: food, runes, ammunition, teleport tablets and charged
  // teleport jewellery. Never sold or dropped, however many.
  for (const id of inventoryIds(player)) if (isFood(id) || isSupply(core, id)) keep.add(id);
  return keep;
}

/**
 * Copies of a piece of gear in its bank beyond the one it keeps: one of each piece is enough,
 * worn, in the bag or banked; the rest is money for its next upgrade. keepIds kept every copy
 * of anything better than it wears, per style, so a melee fighter kept all its magic and ranged
 * pieces and a bot saving for a twisted bow sat on spare elite gear (the owner, 21-11-2026).
 * Not tools (axes, pickaxes), nor supplies (ammunition, charged jewellery, tablets).
 */
function spareGear(player, core, itemId, inBank) {
  if (!(inBank > 0) || isSupply(core, itemId)) return 0;
  const { slots = {}, styles = {} } = Shopping.gear;
  const lists = [...Object.values(slots), ...Object.values(styles).flatMap((style) => Object.values(style))];
  const isGear = lists.some((list) => (list ?? []).some((entry) => Shopping.idOf(core, entry.item) === itemId));
  if (!isGear) return 0;
  const elsewhere = (player.getInventory().getAmount?.(itemId) ?? 0) + (equippedIds(player).has(itemId) ? 1 : 0);
  return Math.max(0, inBank - Math.max(0, 1 - elsewhere));
}

/** Food it carries for itself; more than this (a bag of fish it caught and cooked) is stock. */
const FOOD_CARRY = 10;
/**
 * Prayer potions it carries for itself, as food: more than this (a thousand it made training
 * Herblore) are goods to sell; its bank keeps a reserve of its own (Adventurers need()).
 */
const POTION_CARRY = 8;

/** How many bag slots these goods take (a stack takes one, each unstackable item one). */
function slotsOf(player, goods) {
  const ids = new Set(goods.map((good) => good.itemId));
  return (player.getInventory().getItems() ?? []).filter((item) => item && ids.has(item.getId())).length;
}

/**
 * What it would bank or sell: [{ itemId, amount, value }], tradeable items it does not keep, and
 * food beyond what it carries for itself (cooked fish fill a bag too), and spare copies of
 * gear and tools it keeps: one of each is enough.
 */
function goodsToSell(player, core, keep, { isFood = null, worthless = false } = {}) {
  const totals = new Map();
  const food = new Map();
  const potions = new Map();
  // Gear and tools are kept one of a kind. Eight staffs of fire or 24 adamant axes it smithed all
  // stayed "kept": a bag of them could not go in the bank, and 15 of 60 adventurers stood for
  // hours at a bank wall going nowhere (metrics 17-11-2026, 7a8e40b).
  const gear = new Set(gearLists(player, core).flat().map((entry) => Shopping.idOf(core, entry.item)).filter(Number.isInteger));
  const seen = new Set();
  for (const item of player.getInventory().getItems() ?? []) {
    if (!item || !(item.getId() > 0)) continue;
    if (keep.has(item.getId()) && gear.has(item.getId()) && !isSupply(core, item.getId())) {
      if (!seen.has(item.getId())) {
        seen.add(item.getId());
        continue;
      }
      totals.set(item.getId(), (totals.get(item.getId()) ?? 0) + item.getAmount());
      continue;
    }
    if (isFood?.(item.getId())) {
      food.set(item.getId(), (food.get(item.getId()) ?? 0) + item.getAmount());
      continue;
    }
    if (isPrayerRestore(core, item.getId())) {
      potions.set(item.getId(), (potions.get(item.getId()) ?? 0) + item.getAmount());
      continue;
    }
    // Runes, arrows and teleports are never sold, wherever the keep list came from.
    if (keep.has(item.getId()) || isSupply(core, item.getId())) continue;
    totals.set(item.getId(), (totals.get(item.getId()) ?? 0) + item.getAmount());
  }
  // The best food stays (the most of one kind first), up to FOOD_CARRY pieces in all.
  let carry = FOOD_CARRY;
  for (const [id, amount] of [...food].sort((a, b) => b[1] - a[1])) {
    const kept = Math.min(amount, carry);
    carry -= kept;
    if (amount > kept) totals.set(id, amount - kept);
  }
  // The fullest potions stay first, up to POTION_CARRY in all; the rest are goods.
  let potionCarry = POTION_CARRY;
  for (const [id, amount] of [...potions].sort((a, b) => b[1] - a[1])) {
    const kept = Math.min(amount, potionCarry);
    potionCarry -= kept;
    if (amount > kept) totals.set(id, amount - kept);
  }
  return [...totals].map(([itemId, amount]) => ({ itemId, amount, value: Value.itemValue(core, itemId, amount) }))
    // For the bank (`worthless`) also what has no exchange price: it still takes up the bag.
    .filter((good) => worthless || good.value > 0)
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
 * coins it carries or its bank, as for a player. True when placed. When not, `outcome.why` says
 * why (the exchange's reason, see "ge:place-offer").
 */
function buyAtExchange(player, core, emit, itemId, quantity, outcome = {}) {
  const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0) || 1;
  const request = { player, sell: false, itemId, quantity, price: Math.ceil(guide * 1.05) };
  emit("ge:place-offer", request);
  if (request.placed !== true) outcome.why = request.why ?? "unknown";
  return request.placed === true;
}

/** Finished offers waiting to be collected, without collecting them. */
function finishedOffers(player, emit) {
  const peek = { player, peek: true };
  emit("ge:collect", peek);
  return peek.finished ?? 0;
}

module.exports = {
  slotsOf, listsFor, twoHanded, isSupply, isPrayerRestore, wearBest, wornStyle, bankUpgrades, spareGear, keepIds, goodsToSell, sellAtExchange, buyAtExchange, finishedOffers, COINS, KEEP_TOOLS };
