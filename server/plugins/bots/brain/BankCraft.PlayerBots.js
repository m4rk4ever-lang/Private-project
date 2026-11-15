"use strict";

/**
 * Bank standing for real: an honest bot at a bank booth works through its own bank, an inventory
 * at a time, as players do. It takes its tool and materials out of its bank (fletching logs with
 * a knife, cutting gems with a chisel, mixing an unfinished potion with its secondary), makes the
 * best thing its level allows through the game's own menus (Make.PlayerBots.js), and puts the
 * products back. Levels, XP and materials are the game's.
 *
 * The recipes are the adventurers' buyToTrain list for the skills that are done at a bank:
 * Fletching, Crafting and Herblore (Smithing, Cooking and Firemaking need an anvil, a range or
 * open ground). Out of materials it has nothing to make: it stands, as a player waiting on
 * offers does, and its upkeep may buy more (BankStand.PlayerBots.js asks at the exchange).
 */
const BANK_SKILLS = Object.freeze(["FLETCHING", "CRAFTING", "HERBLORE"]);
/** Each material of a pair takes half the bag, less the tool's slot. */
const BAG = 27;

function recipes() {
  return require("../data/adventurers.json").buyToTrain ?? {};
}

function idOf(core, name) {
  return core.ItemIdentifiers?.[name];
}

function bankAmount(player, itemId) {
  return (player.getBanks?.() ?? []).reduce((sum, bank) => sum + (bank?.getAmount?.(itemId) ?? 0), 0);
}

function held(player, itemId) {
  return player.getInventory().getAmount(itemId) + bankAmount(player, itemId);
}

/**
 * The jobs it can do now, best tier first per skill: { skill, level, toolId, materials: [ids],
 * activityMaterials }. A tier counts when its level allows it and it has the tool and every
 * material in its bank or bag.
 */
function jobsFor(player, core, { skills = BANK_SKILLS, questDone = () => true } = {}) {
  const jobs = [];
  for (const skill of skills) {
    const recipe = recipes()[skill];
    if (!recipe || (recipe.quest && !questDone(recipe.quest))) continue;
    const level = player.getSkillManager().getMaxLevel(core.Skill[skill]);
    const toolId = recipe.tool ? idOf(core, recipe.tool) : null;
    if (recipe.tool && !(Number.isInteger(toolId) && held(player, toolId) > 0)) continue;
    for (const [needed, names] of recipe.tiers) {
      if (level < needed) continue;
      const materials = (Array.isArray(names) ? names : [names]).map((name) => idOf(core, name));
      if (!materials.every(Number.isInteger) || !materials.every((id) => held(player, id) > 0)) continue;
      jobs.push({ skill, level, toolId, materials });
      break;
    }
  }
  return jobs;
}

/** Everything but coins and the tool back into the bank (the last inventory's products). */
function depositAll(player, core, keepIds = []) {
  const inventory = player.getInventory();
  const keep = new Set([idOf(core, "COINS"), ...keepIds]);
  for (const item of [...(inventory.getItems() ?? [])]) {
    const id = item?.getId?.() ?? -1;
    if (!(id > 0) || keep.has(id)) continue;
    const amount = inventory.getAmount(id);
    const bank = player.getBank?.(core.Bank?.getTabForItem?.(player, id) ?? 0);
    if (!bank || amount <= 0) continue;
    bank.add(new core.Item(id, amount), false);
    inventory.deleteNumber(id, amount);
  }
  inventory.refreshItems?.();
}

function take(player, core, itemId, amount) {
  const inventory = player.getInventory();
  let got = 0;
  for (const bank of player.getBanks?.() ?? []) {
    const have = bank?.getAmount?.(itemId) ?? 0;
    const want = Math.min(have, amount - got, inventory.getFreeSlots());
    if (want <= 0) continue;
    bank.deleteNumber(itemId, want);
    inventory.add(new core.Item(itemId, want), false);
    got += want;
  }
  return got;
}

/** An inventory for the job: the tool and the materials (split evenly for a pair). */
function withdrawJob(player, core, job) {
  depositAll(player, core, job.toolId ? [job.toolId] : []);
  if (job.toolId && player.getInventory().getAmount(job.toolId) <= 0) take(player, core, job.toolId, 1);
  const share = Math.floor((BAG - (job.toolId ? 0 : -1)) / job.materials.length);
  let got = 0;
  for (const id of job.materials) got += take(player, core, id, share);
  player.getInventory().refreshItems?.();
  return got;
}

/** The job to do, weighted by its level in each skill (a 90 fletcher mostly fletches). */
function pickJob(jobs, random = Math.random) {
  if (jobs.length === 0) return null;
  const weights = jobs.map((job) => Math.max(1, job.level) ** 2);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  return jobs.find((_, index) => (roll -= weights[index]) < 0) ?? jobs[jobs.length - 1];
}

module.exports = { jobsFor, pickJob, withdrawJob, depositAll, BANK_SKILLS };
