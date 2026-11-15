"use strict";

const { isHonest } = require("./Honest.PlayerBots");

/**
 * How an honest world bot keeps going (one with a generated account, Accounts.PlayerBots.js):
 * now and then it goes to the Grand Exchange, as a player does between trips.
 *
 * It goes when its bag is full of things to sell, when it changes jobs with the last job's
 * things still in its bag (no inventory full of ores, logs and fish from three jobs), when sales
 * or buys are waiting to be collected,
 * when it fights without food, or when its job needs a tool it does not have. There it collects,
 * sells its loot and produce, and buys food and tools with its own coins (carried or banked).
 * It walks there and its job walks it back (Errands.PlayerBots.js): no teleports, so a far bot
 * only goes when it has to.
 *
 * Adventurers do this in their own planner (adventurers/Adventurers.PlayerBots.js).
 */
const Shopping = require("../adventurers/Shopping.PlayerBots");
const Trade = require("../adventurers/Trade.PlayerBots");
const HouseParty = require("./HouseParty.PlayerBots");
const { errandsFor } = require("./Errands.PlayerBots");

const GRAND_EXCHANGE = Object.freeze({ x: 3164, y: 3487, z: 0 });
/** How often bots are looked at, and how many each time (round robin). */
const CHECK_TICKS = 25;
const PER_CHECK = 8;
const FOOD_AMOUNT = 20;
/** Further from the exchange than this, a bot does not walk there to sell. */
const FAR_TILES = 400;
const SELL_WORTH = 1500;
const COMBAT_MODES = new Set(["combat_training", "bossing"]);
/** Gathering jobs and the tool list (adventurer-gear.json) they need. */
const TOOL_FOR_MODE = Object.freeze({ woodcutting: "axe", mining: "pickaxe" });

function createUpkeep({ core, runtime, emit, isFood, errands, now = () => Date.now(), log = () => {} }) {
  /** The job each bot had when last looked at. */
  const lastMode = new Map();
  let cursor = 0;

  function levelOf(player, name) {
    const skill = core.Skill[name];
    return skill ? player.getSkillManager().getMaxLevel(skill) : 1;
  }

  function carriesFood(player) {
    return (player.getInventory().getItems() ?? []).some((item) => item && isFood(item.getId()));
  }

  function hasTool(player, list) {
    return list.some((entry) => Shopping.owns(player, Shopping.idOf(core, entry.item)));
  }

  /** What this bot needs at the exchange now, or null. */
  function needs(player, mode, changedJob = false) {
    const inventory = player.getInventory();
    const keep = Trade.keepIds(player, core, { isFood });
    // Bones go to the house party's altar while one is on, not to the exchange.
    if (HouseParty.isOpen()) {
      for (const item of inventory.getItems() ?? []) {
        if (item && /bones$/i.test(String(core.ItemDefinition?.forId?.(item.getId())?.getName?.() ?? ""))) keep.add(item.getId());
      }
    }
    const goods = Trade.goodsToSell(player, core, keep);
    const worth = goods.reduce((sum, good) => sum + good.value, 0);
    const want = { goods: [], buy: [] };
    // A full bag of things to sell (its made bows, platebodies or loot), or a valuable load.
    if ((inventory.getFreeSlots() <= 2 && goods.length > 0) || worth >= SELL_WORTH * 10 || (changedJob && goods.length > 0)) want.goods = goods;
    if (COMBAT_MODES.has(mode) && !carriesFood(player)) {
      const food = Shopping.foodToBuy(player, core, levelOf(player, "HITPOINTS"));
      if (food) want.buy.push({ itemId: food.itemId, amount: FOOD_AMOUNT });
    }
    const toolList = Shopping.gear.tools?.[TOOL_FOR_MODE[mode]];
    if (toolList && !hasTool(player, toolList)) {
      const best = toolList.find((entry) => !(entry.quests?.length) && levelOf(player, entry.skill) >= (entry.level ?? 1));
      if (best) want.buy.push({ itemId: Shopping.idOf(core, best.item), amount: 1 });
    }
    // From far away (Kourend, the desert) the walk is not worth a bag of goods: its job sells at
    // a nearby store or drops instead. Food and tools it does need, so for those it still goes.
    const at = player.getLocation();
    if (Math.max(Math.abs(at.getX() - GRAND_EXCHANGE.x), Math.abs(at.getY() - GRAND_EXCHANGE.y)) > FAR_TILES) want.goods = [];
    const waiting = Trade.finishedOffers(player, emit) > 0;
    if (!waiting && want.goods.length === 0 && want.buy.length === 0) return null;
    return want;
  }

  function deal(player, want) {
    const { collectedCoins, offered } = Trade.sellAtExchange(player, core, emit, want.goods);
    const bought = [];
    for (const { itemId, amount } of want.buy) {
      if (Number.isInteger(itemId) && Trade.buyAtExchange(player, core, emit, itemId, amount)) bought.push(itemId);
    }
    log("bot_upkeep", { username: player.getUsername?.() ?? null, collectedCoins, sold: offered.length, bought: bought.length });
  }

  function startTrip(entry, want) {
    // What it needs may change on the way (a full bag of ores): looked at again on arrival.
    return errands.go(entry, GRAND_EXCHANGE, { reason: "upkeep", arrive: (player) => deal(player, needs(player, entry.brain?.currentRoot?.()?.mode ?? null, true) ?? want) });
  }

  /** The next few honest world bots (not adventurers, not in a trip, not in PvP). */
  function check(nowMs) {
    const entries = [...(runtime.entriesByUsername?.values?.() ?? [])];
    if (entries.length === 0) return;
    for (let looked = 0; looked < Math.min(PER_CHECK, entries.length); looked += 1) {
      const entry = entries[cursor++ % entries.length];
      const player = entry?.player;
      const state = entry?.state;
      // A paused brain is already away (at a house party, HouseParty.PlayerBots.js).
      if (!player || !(state?.honest || isHonest(player)) || state.adventurer || errands.busy(player) || entry.brain?.paused) continue;
      if (player.getCombat?.()?.getAttacker?.() || player.getHitpoints?.() <= 0) continue;
      const mode = entry.brain?.currentRoot?.()?.mode ?? null;
      if (mode === "pvp" || mode === "minigame") continue;
      const name = player.getUsername?.();
      const changedJob = lastMode.has(name) && lastMode.get(name) !== mode;
      lastMode.set(name, mode);
      const want = needs(player, mode, changedJob);
      if (want) startTrip(entry, want);
    }
  }

  let ticks = 0;
  function tick() {
    if (++ticks % CHECK_TICKS === 0) check(now());
  }

  return { tick, needs, check };
}

function startUpkeep(api, runtime) {
  const isFood = (id) => require("../../items/Food.plugin").isFoodItem(id);
  const upkeep = createUpkeep({ core: api.core, runtime, emit: (name, payload) => api.emitCustomEvent(name, payload), isFood, errands: errandsFor(api) });
  const { Task } = api.core;
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(1, "bot-upkeep", false); }
    execute() { upkeep.tick(); }
  })());
  return upkeep;
}

module.exports = { createUpkeep, startUpkeep, GRAND_EXCHANGE, COMBAT_MODES };
