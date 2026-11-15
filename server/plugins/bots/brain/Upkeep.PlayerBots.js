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
 * Then it goes back to where it was. Its brain waits meanwhile.
 *
 * Adventurers do this in their own planner (adventurers/Adventurers.PlayerBots.js).
 */
const Shopping = require("../adventurers/Shopping.PlayerBots");
const Trade = require("../adventurers/Trade.PlayerBots");
const HouseParty = require("./HouseParty.PlayerBots");

const GRAND_EXCHANGE = Object.freeze({ x: 3164, y: 3487, z: 0 });
/** How often bots are looked at, and how many each time (round robin). */
const CHECK_TICKS = 25;
const PER_CHECK = 8;
/** Arrive (teleport), deal, and stand a moment before going back. */
const ARRIVE_MS = 3600;
const STAY_MS = 6000;
const FOOD_AMOUNT = 20;
const SELL_WORTH = 1500;
const COMBAT_MODES = new Set(["combat_training", "bossing"]);
/** Gathering jobs and the tool list (adventurer-gear.json) they need. */
const TOOL_FOR_MODE = Object.freeze({ woodcutting: "axe", mining: "pickaxe" });

function createUpkeep({ core, runtime, emit, isFood, now = () => Date.now(), log = () => {} }) {
  const trips = new Map();
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
    const waiting = Trade.finishedOffers(player, emit) > 0;
    if (!waiting && want.goods.length === 0 && want.buy.length === 0) return null;
    return want;
  }

  function teleport(player, place) {
    const target = new core.Location(place.x, place.y, place.z ?? 0);
    if (core.TeleportHandler?.teleport && core.TeleportType?.NORMAL) {
      core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false);
    } else {
      player.moveTo(target);
    }
  }

  function startTrip(entry, want, nowMs) {
    const player = entry.player;
    const at = player.getLocation();
    trips.set(player, { entry, want, stage: "arriving", at: nowMs + ARRIVE_MS, back: { x: at.getX(), y: at.getY(), z: at.getZ() } });
    if (entry.brain) entry.brain.paused = true;
    teleport(player, GRAND_EXCHANGE);
  }

  function deal(player, want) {
    const { collectedCoins, offered } = Trade.sellAtExchange(player, core, emit, want.goods);
    const bought = [];
    for (const { itemId, amount } of want.buy) {
      if (Number.isInteger(itemId) && Trade.buyAtExchange(player, core, emit, itemId, amount)) bought.push(itemId);
    }
    log("bot_upkeep", { username: player.getUsername?.() ?? null, collectedCoins, sold: offered.length, bought: bought.length });
  }

  function finish(player, trip) {
    trips.delete(player);
    if (trip.entry.brain) trip.entry.brain.paused = false;
    if (player.isRegistered?.() !== false) teleport(player, trip.back);
  }

  function advance(nowMs) {
    for (const [player, trip] of [...trips]) {
      if (player.isRegistered?.() === false) {
        trips.delete(player);
        continue;
      }
      if (nowMs < trip.at) continue;
      if (trip.stage === "arriving") {
        deal(player, trip.want);
        trip.stage = "staying";
        trip.at = nowMs + STAY_MS;
      } else {
        finish(player, trip);
      }
    }
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
      if (!player || !(state?.honest || isHonest(player)) || state.adventurer || trips.has(player) || entry.brain?.paused) continue;
      if (player.getCombat?.()?.getAttacker?.() || player.getHitpoints?.() <= 0) continue;
      const mode = entry.brain?.currentRoot?.()?.mode ?? null;
      if (mode === "pvp" || mode === "minigame") continue;
      const name = player.getUsername?.();
      const changedJob = lastMode.has(name) && lastMode.get(name) !== mode;
      lastMode.set(name, mode);
      const want = needs(player, mode, changedJob);
      if (want) startTrip(entry, want, nowMs);
    }
  }

  let ticks = 0;
  function tick() {
    const nowMs = now();
    advance(nowMs);
    if (++ticks % CHECK_TICKS === 0) check(nowMs);
  }

  return { tick, needs, trips, check, advance };
}

function startUpkeep(api, runtime) {
  const isFood = (id) => require("../../items/Food.plugin").isFoodItem(id);
  const upkeep = createUpkeep({ core: api.core, runtime, emit: (name, payload) => api.emitCustomEvent(name, payload), isFood });
  const { Task } = api.core;
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(1, "bot-upkeep", false); }
    execute() { upkeep.tick(); }
  })());
  return upkeep;
}

module.exports = { createUpkeep, startUpkeep, GRAND_EXCHANGE, COMBAT_MODES };
