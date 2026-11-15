"use strict";

/**
 * A generated account for a world bot: it logs in as if it had played before. Its levels were
 * rolled by the site (SiteSpawner.PlayerBots.js); this gives it what such an account would own:
 * tools for its skills, gear for its combat levels, food, coins and a bank with some produce.
 * From then on it is honest (state.honest), like the adventurers: nothing is conjured any more.
 * It uses up its food, bait and runes, earns from its loot and produce, and buys more with its own
 * coins (Upkeep.PlayerBots.js).
 *
 * Every bot gets its own account, so the world shows every stage of the game at once: a bronze
 * newcomer beside a maxed one, without anyone waiting weeks to get there.
 */
const Shopping = require("../adventurers/Shopping.PlayerBots");
const { markHonest } = require("./Honest.PlayerBots");

const COMBAT_MODES = new Set(["combat_training", "bossing"]);
const BANK_MODES = new Set(["bankskilling", "bankstanding"]);
/** Produce an account keeps in its bank, by skill and level (best it can make first). */
const PRODUCE = Object.freeze({
  WOODCUTTING: [[75, "MAGIC_LOGS"], [60, "YEW_LOGS"], [45, "MAPLE_LOGS"], [30, "WILLOW_LOGS"], [15, "OAK_LOGS"], [1, "LOGS"]],
  MINING: [[85, "RUNITE_ORE"], [70, "ADAMANTITE_ORE"], [55, "MITHRIL_ORE"], [30, "COAL"], [15, "IRON_ORE"], [1, "COPPER_ORE"]],
  FISHING: [[76, "RAW_SHARK"], [50, "RAW_SWORDFISH"], [40, "RAW_LOBSTER"], [20, "RAW_TROUT"], [1, "RAW_SHRIMPS"]],
  SMITHING: [[85, "RUNITE_BAR"], [70, "ADAMANTITE_BAR"], [50, "MITHRIL_BAR"], [30, "STEEL_BAR"], [15, "IRON_BAR"], [1, "BRONZE_BAR"]],
  COOKING: [[80, "SHARK"], [40, "LOBSTER"], [15, "TROUT"], [1, "SHRIMPS"]],
});

function levelOf(bot, core, name) {
  const skill = core.Skill[name];
  return skill ? bot.getSkillManager().getMaxLevel(skill) : 1;
}

/** The best entry of a gear list its levels allow, ignoring quest-locked items. */
function bestAllowed(list, core, bot) {
  return list.find((entry) => !(entry.quests?.length) && levelOf(bot, core, entry.skill) >= (entry.level ?? 1)) ?? null;
}

function give(container, core, name, amount = 1) {
  const id = Shopping.idOf(core, name);
  if (!Number.isInteger(id) || !(amount > 0)) return false;
  container.add(new core.Item(id, amount), false);
  return true;
}

/**
 * Fills in a bot's account. `equipCombatGear` is TrainCombat's gear and food for its levels,
 * applied once here, before the bot turns honest. Returns what it got, for logs and tests.
 */
function generateAccount(bot, state, { core, mode, equipCombatGear = null, random = Math.random }) {
  const inventory = bot.getInventory();
  const got = { tools: [], coins: 0, bank: [] };
  if (COMBAT_MODES.has(mode) && equipCombatGear) {
    // Its fighting gear, ammunition or runes and a load of food, as the levels suit.
    equipCombatGear(bot, state);
  }
  // Tools for the gathering skills (the bot's job first: an inventory has 28 slots).
  const axe = bestAllowed(Shopping.gear.tools?.axe ?? [], core, bot);
  const pickaxe = bestAllowed(Shopping.gear.tools?.pickaxe ?? [], core, bot);
  const tools = mode === "mining" ? [pickaxe, axe] : [axe, pickaxe];
  for (const entry of tools) if (entry && give(inventory, core, entry.item)) got.tools.push(entry.item);
  if (give(inventory, core, "TINDERBOX")) got.tools.push("TINDERBOX");
  // To make something of its produce: a knife for its logs, a hammer for its bars.
  if (mode === "woodcutting" && give(inventory, core, "KNIFE")) got.tools.push("KNIFE");
  if (mode === "mining" && give(inventory, core, "HAMMER")) got.tools.push("HAMMER");
  if (mode === "fishing") {
    const fishing = levelOf(bot, core, "FISHING");
    const kit = [["SMALL_FISHING_NET", 1, 1], ["FLY_FISHING_ROD", 1, 20], ["FEATHER", 500 + Math.floor(random() * 2500), 20],
      ["LOBSTER_POT", 1, 40], ["HARPOON", 1, 35]];
    for (const [name, amount, level] of kit) if (fishing >= level && give(inventory, core, name, amount)) got.tools.push(name);
  }
  // Coins: a richer account the further it got. Most in the bank, some at hand.
  const total = bot.getSkillManager().getTotalLevel?.() ?? 32;
  const wealth = Math.floor(total * total * (1 + random() * 9));
  const carried = Math.floor(wealth * (0.02 + random() * 0.08));
  if (give(inventory, core, "COINS", carried)) got.coins += carried;
  const bank = bot.getBank?.(0);
  if (bank) {
    if (give(bank, core, "COINS", wealth - carried)) got.coins += wealth - carried;
    for (const [skill, table] of Object.entries(PRODUCE)) {
      if (random() < 0.5) continue;
      const level = levelOf(bot, core, skill);
      const [, name] = table.find(([needed]) => level >= needed) ?? [];
      const amount = 20 + Math.floor(random() * 480);
      if (name && give(bank, core, name, amount)) got.bank.push([name, amount]);
    }
  }
  // A bank stander's bank has what it works on at the booth (BankCraft.PlayerBots.js): its tools
  // and a stock of logs and uncut gems for its levels.
  if (BANK_MODES.has(mode) && bank) {
    const recipes = require("../data/adventurers.json").buyToTrain ?? {};
    for (const skill of ["FLETCHING", "CRAFTING"]) {
      const recipe = recipes[skill];
      if (!recipe) continue;
      give(bank, core, recipe.tool, 1);
      const level = levelOf(bot, core, skill);
      const [, name] = recipe.tiers.find(([needed]) => level >= needed) ?? [];
      const amount = 200 + Math.floor(random() * 1800);
      if (name && give(bank, core, name, amount)) got.bank.push([name, amount]);
    }
  }
  inventory.refreshItems?.();
  if (state) state.honest = true;
  markHonest(bot);
  return got;
}

module.exports = { generateAccount, PRODUCE, COMBAT_MODES };
