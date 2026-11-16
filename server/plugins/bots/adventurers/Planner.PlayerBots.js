"use strict";

/**
 * What an adventurer does next, from its levels and quests: a pure function, so it is easy to
 * test and to reason about. An adventurer trains a skill, does a quest or fights a boss (from the
 * boss's combat level, with `bossChance`).
 *
 * - A quest is ready when its required skills, quests, quest points and recommended combat level
 *   are met. With `questChance` the adventurer takes the first ready quest on the path.
 * - Otherwise it trains. It prefers what the next quest on its path still needs (Mining 10 for
 *   The Knight's Sword, combat 45 for Dragon Slayer I); with nothing needed, a weighted pick
 *   (trainingWeight): combat early, its own favourites, skills that lag behind, and not what
 *   the others already do.
 *   Each choice is a mode the bots can do (woodcutting, mining, fishing, thieving, combat,
 *   Wintertodt for Firemaking from level 50) and the best activity of that mode for its level.
 */
const { goalWeight, describe } = require("./Goals.PlayerBots");

const TRAINABLE = Object.freeze({
  WOODCUTTING: "woodcutting",
  MINING: "mining",
  FISHING: "fishing",
  THIEVING: "thieving",
  HUNTER: "hunter",
});
const COMBAT = "combat_training";
/** The gathering skill whose goods a processing skill uses. */
const FEEDS = Object.freeze({ FLETCHING: "WOODCUTTING", FIREMAKING: "WOODCUTTING", SMELTING: "MINING", SMITHING: "MINING", COOKING: "FISHING" });
const WINTERTODT_LEVEL = 50;

/** The quest's unmet requirements: { skills: { NAME: level }, combat, quests, questPoints }. */
function missing(quest, adventurer) {
  const skills = {};
  for (const [skill, level] of Object.entries(quest.skills ?? {})) {
    if ((adventurer.levels[skill] ?? 1) < level) skills[skill] = level;
  }
  const quests = (quest.quests ?? []).filter((name) => !adventurer.done.has(name));
  return {
    skills,
    combat: adventurer.combat < (quest.combat ?? 0) ? quest.combat : 0,
    quests,
    questPoints: adventurer.questPoints < (quest.questPoints ?? 0) ? quest.questPoints : 0,
  };
}

function isReady(quest, adventurer) {
  const gap = missing(quest, adventurer);
  return Object.keys(gap.skills).length === 0 && !gap.combat && gap.quests.length === 0 && !gap.questPoints;
}

/** The modes this adventurer can train, with the skill each trains and its level. */
function trainingOptions(adventurer) {
  const options = Object.entries(TRAINABLE).map(([skill, mode]) => ({ mode, skill, level: adventurer.levels[skill] ?? 1 }));
  options.push({ mode: COMBAT, skill: "COMBAT", level: adventurer.combat });
  // Fighting with a bow and arrows, or spells with runes, when it has them (adventurer.styles).
  if ((adventurer.styles ?? []).includes("ranged")) options.push({ mode: "combat_ranged", skill: "RANGED", level: adventurer.levels.RANGED ?? 1 });
  if ((adventurer.styles ?? []).includes("magic")) options.push({ mode: "combat_magic", skill: "MAGIC", level: adventurer.levels.MAGIC ?? 1 });
  // Slayer: a task from a master, then only its monsters (adventurer.slayer, Slayer.PlayerBots.js).
  if (adventurer.slayer) options.push({ mode: "slayer", skill: "SLAYER", level: adventurer.levels.SLAYER ?? 1 });
  // Agility: laps on the best course its level allows (adventurers.json agilityCourses).
  options.push({ mode: "agility", skill: "AGILITY", level: adventurer.levels.AGILITY ?? 1 });
  if ((adventurer.levels.FIREMAKING ?? 1) >= WINTERTODT_LEVEL) {
    options.push({ mode: "wintertodt", skill: "FIREMAKING", level: adventurer.levels.FIREMAKING });
  }
  // Skills trained on bought materials (logs to fletch or burn, bars to smith), when it can pay.
  for (const skill of adventurer.buyable ?? []) {
    options.push({ mode: `buy_${skill.toLowerCase()}`, skill, level: adventurer.levels[skill] ?? 1 });
  }
  return options;
}

/**
 * The next thing to do: { kind: "quest", quest } or { kind: "train", mode, skill, reason }.
 * `quests` is the path (adventurers.json), `available` the names this server has.
 */
/** The bosses this adventurer can take on: its combat level reaches the boss's. */
function bossesFor(adventurer, bosses = []) {
  return bosses.filter((boss) => adventurer.combat >= (boss.combat ?? 1));
}

function chooseNext(adventurer, quests, {
  available = null, questChance = 0.45, bosses = [], bossChance = 0, random = Math.random,
  focus = {}, busyModes = new Set(), exclude = new Set(), goal = null,
} = {}) {
  const open = quests.filter((quest) => !adventurer.done.has(quest.name) && (!available || available.has(quest.name)));
  const fightable = bossesFor(adventurer, bosses);
  if (fightable.length > 0 && random() < bossChance) {
    return { kind: "boss", boss: fightable[Math.floor(random() * fightable.length)] };
  }
  const ready = open.filter((quest) => isReady(quest, adventurer));
  if (ready.length > 0 && random() < questChance) {
    return { kind: "quest", quest: ready[0] };
  }
  // Modes that could not start just now (no tool, no place) are left out of this pick.
  const options = trainingOptions(adventurer).filter((option) => !exclude.has(option.mode));
  if (options.length === 0) return { kind: "train", mode: COMBAT, skill: "COMBAT", reason: "loot en levels" };
  // What the nearest quest that is not ready still needs, and that the bots can train.
  for (const quest of open) {
    if (isReady(quest, adventurer)) continue;
    const gap = missing(quest, adventurer);
    if (gap.combat) {
      return { kind: "train", mode: COMBAT, skill: "COMBAT", reason: `${quest.name} (combat ${gap.combat})`, target: { skill: "COMBAT", level: gap.combat } };
    }
    for (const [skill, level] of Object.entries(gap.skills)) {
      const option = options.find((entry) => entry.skill === skill);
      if (option) return { kind: "train", mode: option.mode, skill, reason: `${quest.name} (${skill.toLowerCase()} ${level})`, target: { skill, level } };
    }
  }
  // Nothing in the way: a weighted pick (trainingWeights), so each adventurer has its own way.
  const weighted = options.map((option) => ({ option, weight: trainingWeight(option, options, adventurer, { focus, busyModes }) * goalWeight(goal, option) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  const choice = (weighted.find((entry) => (roll -= entry.weight) < 0) ?? weighted[weighted.length - 1]).option;
  const forGoal = goal && goalWeight(goal, choice) > 1;
  return { kind: "train", mode: choice.mode, skill: choice.skill, reason: forGoal ? `doel: ${describe(goal)}` : reasonFor(choice, options, focus),
    ...(forGoal && goal.kind === "level" ? { target: { skill: goal.skill, level: goal.level } } : {}) };
}

/**
 * How much it wants to train this now:
 * - combat first on a new account: loot is its income and its way to bosses (x3 below combat 40);
 * - its own focus (adventurers.json `focus`), so five adventurers do not all mine at once;
 * - a skill far behind its others catches up (+20% per level under their average);
 * - a mode another adventurer already does weighs half (no clump), unless they are a group;
 * - a skill it has gathered the materials for (logs to fletch, bars to smith) weighs triple.
 */
function trainingWeight(option, options, adventurer, { focus = {}, busyModes = new Set() } = {}) {
  const average = options.reduce((sum, entry) => sum + entry.level, 0) / options.length;
  let weight = 1;
  if (option.mode === COMBAT && adventurer.combat < 40) weight *= 3;
  weight *= focus[option.mode] ?? 1;
  weight *= 1 + Math.max(0, average - option.level) * 0.2;
  if (busyModes.has(option.mode)) weight *= 0.5;
  // One skill feeds the next: with logs in the bank fletching or burning comes up more often.
  if (option.mode.startsWith("buy_") && (adventurer.stocked ?? []).includes(option.skill)) weight *= 3;
  // What it gathers feeds the next skill, as for a player: a woodcutter far ahead of its
  // fletching and firemaking, a miner ahead of its smelting and smithing, comes to those soon.
  const feeder = FEEDS[option.skill];
  if (option.mode.startsWith("buy_") && feeder && (adventurer.levels[feeder] ?? 1) >= option.level + 10) weight *= 4;
  // A bow or runes it has and a style far behind its melee: it trains that way too.
  if ((option.mode === "combat_ranged" || option.mode === "combat_magic")
      && (adventurer.levels.ATTACK ?? 1) >= option.level + 10) weight *= 3;
  // A Slayer task it has is one it means to finish.
  if (option.mode === "slayer" && adventurer.slayer?.task) weight *= 3;
  return weight;
}

function reasonFor(choice, options, focus = {}) {
  const average = options.reduce((sum, entry) => sum + entry.level, 0) / options.length;
  if ((focus[choice.mode] ?? 1) > 1) return "favoriet";
  if (choice.level + 5 < average) return "achterstand";
  if (choice.mode === COMBAT) return "loot en levels";
  return "afwisseling";
}

/** The best activity of `mode` for `level`: the highest `level` field not above it. */
function bestActivity(mode, level, definitions) {
  const fields = new Map();
  let best = null;
  for (const activity of definitions.activities ?? []) {
    const own = activity.fieldsFrom ? { ...fields.get(activity.fieldsFrom), ...activity.fields } : activity.fields ?? {};
    fields.set(activity.id, own);
    const template = activity.template ? definitions.templates?.[activity.template] : null;
    const activityMode = activity.mode ?? template?.mode;
    if (activityMode !== mode) continue;
    const required = Number(own.level ?? 1);
    if (required <= level && (!best || required > best.level)) best = { id: activity.id, level: required };
  }
  return best?.id ?? null;
}

module.exports = { trainingWeight, chooseNext, bossesFor, missing, isReady, trainingOptions, bestActivity, TRAINABLE, COMBAT };
