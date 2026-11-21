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
/** Modes that earn coins (loot, stolen goods, produce to sell); a first guess before it has measured. */
const MONEY_MODES = new Set(["thieving", "combat_training", "combat_ranged", "combat_magic", "slayer", "woodcutting", "mining", "fishing", "hunter"]);
const MONEY_GUESS = Object.freeze({ thieving: 30_000, combat_training: 20_000, slayer: 25_000, woodcutting: 15_000, mining: 15_000, fishing: 12_000, hunter: 10_000, combat_ranged: 15_000, combat_magic: 10_000 });

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
  // Farming: a farm run when a spot's crops are due (adventurer.farmDue); Construction in its own
  // house, when it has one or the coins for one (adventurer.construction). Both stood at 1 for
  // every account (Fase 6, 21-11-2026).
  if (adventurer.farmDue) options.push({ mode: "farming", skill: "FARMING", level: adventurer.levels.FARMING ?? 1 });
  if (adventurer.construction) options.push({ mode: "construction", skill: "CONSTRUCTION", level: adventurer.levels.CONSTRUCTION ?? 1 });
  if ((adventurer.levels.FIREMAKING ?? 1) >= WINTERTODT_LEVEL) {
    options.push({ mode: "wintertodt", skill: "FIREMAKING", level: adventurer.levels.FIREMAKING });
  }
  // Skills trained on bought materials (logs to fletch or burn, bars to smith), when it can pay.
  for (const skill of adventurer.buyable ?? []) {
    options.push({ mode: `buy_${skill.toLowerCase()}`, skill, level: adventurer.levels[skill] ?? 1,
      // Materials of its own (the logs it chopped): nothing to buy (Goals.goalWeight).
      stocked: (adventurer.stocked ?? []).includes(skill) });
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
  available = null, questChance = 0.45, questGapChance = 0.25, moneyChance = 0, bosses = [], bossChance = 0, random = Math.random,
  focus = {}, busyModes = new Set(), exclude = new Set(), goal = null, explain = null, endgame = null,
} = {}) {
  // How it chose, for the `decision` metric (AI_Constitution §32): which way through this function
  // (`path`) and the options it weighed, best first. The plan returned is the same with or without.
  const decided = (choice, path, extra = {}) => {
    try {
      explain?.({ path, choice, ...extra });
    } catch {
      // Explaining is a help, never a reason not to choose.
    }
    return choice;
  };
  const open = quests.filter((quest) => !adventurer.done.has(quest.name) && (!available || available.has(quest.name)));
  const fightable = bossesFor(adventurer, bosses);
  // A maxed account (most skills at 99): its levels are done, so its time goes to upgrades and a
  // bigger bank, by bossing and money-making (the owner, 20-11-2026). Combat 126 bots with billions
  // spent 31% thieving for 1-7k gp/h and chose a boss 5 times in 4 hours.
  const late = isEndgame(adventurer, endgame);
  if (late) {
    if (bossChance > 0) bossChance = Math.max(bossChance, endgame.bossChance ?? 0.6);
    moneyChance = Math.max(moneyChance, endgame.moneyChance ?? 0.6);
    questChance = Math.min(questChance, endgame.questChance ?? questChance);
  }
  if (fightable.length > 0 && random() < bossChance) {
    return decided({ kind: "boss", boss: fightable[Math.floor(random() * fightable.length)], ...(late ? { reason: "eindspel: loot en upgrades" } : {}) }, "boss", { candidates: fightable.length, endgame: late || undefined });
  }
  const ready = open.filter((quest) => isReady(quest, adventurer));
  if (ready.length > 0 && random() < questChance) {
    return decided({ kind: "quest", quest: ready[0] }, "quest", { candidates: ready.length, alternatives: ready.slice(1, 4).map((quest) => ({ quest: quest.name })) });
  }
  // Modes that could not start just now (no tool, no place) are left out of this pick.
  const options = trainingOptions(adventurer).filter((option) => !exclude.has(option.mode));
  if (options.length === 0) return decided({ kind: "train", mode: COMBAT, skill: "COMBAT", reason: "loot en levels" }, "fallback");
  // Now and then a stretch only to make money: what earned it the most per hour so far (its own
  // measure, adventurer.earn), a mode it has not tried yet now and then, a boss when it can.
  if (random() < moneyChance) {
    const rate = (mode) => adventurer.earn?.[mode] ?? null;
    // A way that earned nothing (or cost) when it tried it is no way to make money.
    const earners = options.filter((option) => MONEY_MODES.has(option.mode) && !(rate(option.mode) !== null && rate(option.mode) <= 0));
    const untried = earners.filter((option) => rate(option.mode) === null);
    if (fightable.length > 0 && random() < (late ? endgame.moneyBossShare ?? 0.5 : 0.25)) {
      return decided({ kind: "boss", boss: fightable[Math.floor(random() * fightable.length)], reason: "geld verdienen" }, "money_boss", { candidates: fightable.length });
    }
    // Something new now and then (one pick in ten), else what it knows earns best: an untried
    // way's guess counts for half against a measured rate ("eens proberen" came up too often).
    const score = (option) => rate(option.mode) ?? (MONEY_GUESS[option.mode] ?? 0) / (earners.some((other) => rate(other.mode) > 0) ? 2 : 1);
    // Maxed: no "eens proberen" (thieving for a few thousand an hour); what it knows earns best.
    const pick = untried.length > 0 && random() < (late ? 0 : 0.1)
      ? untried[Math.floor(random() * untried.length)]
      : [...earners].sort((a, b) => score(b) - score(a))[0];
    if (pick) {
      const known = rate(pick.mode);
      return decided({ kind: "train", mode: pick.mode, skill: pick.skill, money: true,
        reason: known ? `geld verdienen (~${Math.round(known).toLocaleString("nl-NL")} gp/uur)` : "geld verdienen (eens proberen)" }, "money", {
        alternatives: [...earners].sort((a, b) => score(b) - score(a)).slice(0, 3)
          .map((option) => ({ mode: option.mode, gpPerHour: Math.round(score(option)), measured: rate(option.mode) !== null })),
      });
    }
  }
  // What the nearest quest that is not ready still needs, and that the bots can train: now and
  // then (a quarter of the picks), not every time, or every new account would only fight.
  for (const quest of random() < questGapChance ? open : []) {
    if (isReady(quest, adventurer)) continue;
    const gap = missing(quest, adventurer);
    // A combat gap only when combat may be picked now: it was excluded after it could not start,
    // and was picked again in the same decision (Eeshwar, Witch's House, decision metric, ce581ab).
    if (gap.combat && !exclude.has(COMBAT)) {
      return decided({ kind: "train", mode: COMBAT, skill: "COMBAT", reason: `${quest.name} (combat ${gap.combat})`, target: { skill: "COMBAT", level: gap.combat } },
        "quest_gap", { quest: quest.name, missing: gap });
    }
    for (const [skill, level] of Object.entries(gap.skills)) {
      const option = options.find((entry) => entry.skill === skill);
      if (option) {
        return decided({ kind: "train", mode: option.mode, skill, reason: `${quest.name} (${skill.toLowerCase()} ${level})`, target: { skill, level } },
          "quest_gap", { quest: quest.name, missing: gap });
      }
    }
  }
  // Nothing in the way: a weighted pick (trainingWeights), so each adventurer has its own way.
  const weighted = options.map((option) => ({ option, weight: trainingWeight(option, options, adventurer, { focus, busyModes }) * goalWeight(goal, option) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  const choice = (weighted.find((entry) => (roll -= entry.weight) < 0) ?? weighted[weighted.length - 1]).option;
  const forGoal = goal && goalWeight(goal, choice) > 1;
  return decided({ kind: "train", mode: choice.mode, skill: choice.skill, reason: forGoal ? `doel: ${describe(goal)}` : reasonFor(choice, options, focus),
    ...(forGoal && goal.kind === "level" ? { target: { skill: goal.skill, level: goal.level } } : {}) }, "weighted", {
    // Its chance was its share of the total weight; the best three, and the chosen one's share.
    chance: total > 0 ? Math.round((weighted.find((entry) => entry.option === choice)?.weight ?? 0) / total * 100) : null,
    alternatives: [...weighted].sort((a, b) => b.weight - a.weight).slice(0, 3)
      .map((entry) => ({ mode: entry.option.mode, weight: Math.round(entry.weight * 100) / 100, chance: total > 0 ? Math.round(entry.weight / total * 100) : null })),
  });
}

/**
 * How much it wants to train this now:
 * - combat a bit more on a new account: loot is its income and its way to bosses (x2 below combat 40);
 * - its own focus (adventurers.json `focus`), so five adventurers do not all mine at once;
 * - a skill far behind its others catches up (+20% per level under their average);
 * - a mode another adventurer already does weighs half (no clump), unless they are a group;
 * - a skill it has gathered the materials for (logs to fletch, bars to smith) weighs triple.
 */
/**
 * Whether it is a maxed account: at least `share` of its skills at 99 (adventurers.json "endgame").
 */
function isEndgame(adventurer, endgame) {
  if (!endgame) return false;
  const levels = Object.values(adventurer.levels ?? {}).filter((level) => Number.isFinite(level));
  if (levels.length === 0) return false;
  return levels.filter((level) => level >= 99).length / levels.length >= (endgame.share ?? 0.8);
}

function trainingWeight(option, options, adventurer, { focus = {}, busyModes = new Set() } = {}) {
  const average = options.reduce((sum, entry) => sum + entry.level, 0) / options.length;
  let weight = 1;
  // Early on combat a little more often (loot, levels for quests), not all the time.
  if (option.mode === COMBAT && adventurer.combat < 40) weight *= 2;
  // A skill it has hardly touched (level 1-9) comes up often: every account tries them all.
  if (option.mode !== COMBAT && option.level < 10) weight *= 1.5;
  weight *= focus[option.mode] ?? 1;
  weight *= 1 + Math.max(0, average - option.level) * 0.2;
  if (busyModes.has(option.mode)) weight *= 0.5;
  // A skill at 99 gives no levels any more: hardly ever trained for its own sake (a maxed bot
  // ran Seers' rooftop for "achterstand"). Fighting and Slayer still bring loot.
  if (option.level >= 99 && option.mode !== COMBAT && option.mode !== "slayer" && !String(option.mode).startsWith("combat_")) weight *= 0.05;
  // One skill feeds the next: with logs in the bank fletching or burning comes up more often.
  if (option.mode.startsWith("buy_") && (adventurer.stocked ?? []).includes(option.skill)) weight *= 3;
  // What it gathers feeds the next skill, as for a player: a woodcutter far ahead of its
  // fletching and firemaking, a miner ahead of its smelting and smithing, comes to those soon.
  const feeder = FEEDS[option.skill];
  if (option.mode.startsWith("buy_") && feeder && (adventurer.levels[feeder] ?? 1) >= option.level + 10) weight *= 2;
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

/**
 * Every activity of a mode its level allows, best first: [{ id, level }] (highest level, then by
 * id). For a mode with several spots for one tier (bird snaring in the Feldip Hills).
 */
function activitiesFor(mode, level, definitions) {
  const fields = new Map();
  const found = [];
  for (const activity of definitions.activities ?? []) {
    const own = activity.fieldsFrom ? { ...fields.get(activity.fieldsFrom), ...activity.fields } : activity.fields ?? {};
    fields.set(activity.id, own);
    const template = activity.template ? definitions.templates?.[activity.template] : null;
    if ((activity.mode ?? template?.mode) !== mode) continue;
    const required = Number(own.level ?? 1);
    if (required <= level) found.push({ id: activity.id, level: required });
  }
  return found.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
}

/**
 * Of `options` (activitiesFor), the spot to go to: the best tier with room (fewer than `cap`
 * others there, `occupied(id)`), the emptiest of that tier; null when every spot is full. Fifteen
 * bots stood on one crimson swift beach with six birds and caught almost nothing (21-11-2026).
 */
function leastBusy(options, occupied, cap) {
  let tier = null;
  let best = null;
  for (const option of options) {
    if (tier !== null && option.level < tier) break;
    const there = occupied(option.id);
    if (there >= cap) continue;
    tier = option.level;
    if (!best || there < best.there) best = { id: option.id, there };
  }
  return best?.id ?? null;
}

module.exports = { isEndgame, trainingWeight, chooseNext, bossesFor, missing, isReady, trainingOptions, bestActivity, activitiesFor, leastBusy, TRAINABLE, COMBAT };
