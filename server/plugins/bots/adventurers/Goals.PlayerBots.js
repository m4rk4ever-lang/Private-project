"use strict";

/**
 * An adventurer's goal: one concrete next thing to work toward, as a player has one. It steers
 * the planner (Planner.PlayerBots.js trainingWeight) until it is reached, then the next one comes.
 *
 * Goals come from what is in reach and worth having:
 * - the next piece of gear in a slot (adventurer-gear.json): first the level it needs
 *   ("40 Attack for a rune scimitar"), then the coins to buy it;
 * - a better tool for a gathering skill (an axe, a pickaxe) the same way;
 * - an unlock: Firemaking 50 for Wintertodt;
 * - something worth saving for: an amulet of glory (teleports for its errands).
 * The nearest goal is preferred, with a little chance, so five adventurers do not all chase the
 * same thing.
 */
const COMBAT_SKILLS = new Set(["ATTACK", "STRENGTH", "DEFENCE", "HITPOINTS"]);
const SAVE_FOR = Object.freeze([{ item: "AMULET_OF_GLORY_4_", why: "een amulet of glory" }]);

/** Candidate goals: { kind: "level", skill, level, why } | { kind: "coins", amount, why, item }. */
function candidates(view, { gear, levelOf, owns, worn, priceOf, questDone, idOf, coins }) {
  const out = [];
  const consider = (list, label) => {
    // The first piece better than what it has; lists run best first.
    const have = list.findIndex((entry) => owns(idOf(entry.item)) || worn(idOf(entry.item)));
    const better = (have < 0 ? list : list.slice(0, have)).filter((entry) => (entry.quests ?? []).every(questDone));
    const next = better[better.length - 1];
    if (!next) return;
    const name = next.item.toLowerCase().replace(/_/g, " ");
    if (levelOf(next.skill) < (next.level ?? 1)) {
      out.push({ kind: "level", skill: next.skill, level: next.level, why: `${label ?? ""}${name}` });
    } else {
      const price = priceOf(idOf(next.item));
      if (price > 0) out.push({ kind: "coins", amount: price, item: next.item, why: name });
    }
  };
  for (const list of Object.values(gear.slots ?? {})) consider(list);
  for (const list of [gear.tools?.axe, gear.tools?.pickaxe].filter(Boolean)) consider(list);
  if (levelOf("FIREMAKING") < 50) out.push({ kind: "level", skill: "FIREMAKING", level: 50, why: "Wintertodt" });
  for (const save of SAVE_FOR) {
    const id = idOf(save.item);
    if (Number.isInteger(id) && !owns(id) && !worn(id)) {
      const price = priceOf(id);
      // Only once it is in sight: a quarter of the price saved already.
      if (price > 0 && (coins ?? 0) * 4 >= price) out.push({ kind: "coins", amount: price, item: save.item, why: save.why });
    }
  }
  return out;
}

/** How far off a goal is, roughly in effort: levels to go, or coins short per 2,000. */
function distance(goal, { levelOf, coins }) {
  if (goal.kind === "level") return Math.max(0, goal.level - levelOf(goal.skill));
  return Math.max(0, goal.amount - coins) / 2000;
}

function reached(goal, helpers) {
  return goal && distance(goal, helpers) <= 0;
}

/** The next goal: one of the three nearest, the nearest most likely. */
function pickGoal(helpers, random = Math.random) {
  const open = candidates(null, helpers).filter((goal) => !reached(goal, helpers))
    .sort((a, b) => distance(a, helpers) - distance(b, helpers))
    .slice(0, 3);
  if (open.length === 0) return null;
  const roll = random();
  return open[roll < 0.6 || open.length === 1 ? 0 : roll < 0.85 || open.length === 2 ? 1 : 2];
}

/** The planner's weight for a mode under this goal. */
function goalWeight(goal, option) {
  if (!goal) return 1;
  if (goal.kind === "level") {
    if (COMBAT_SKILLS.has(goal.skill)) return option.mode === "combat_training" ? 4 : 1;
    return option.skill === goal.skill ? 4 : 1;
  }
  // Saving up: what earns (loot, pickpockets, produce to sell) more, spending on materials less.
  if (option.mode.startsWith("buy_")) return 0.3;
  if (option.mode === "thieving") return 2;
  if (option.mode === "combat_training") return 1.5;
  return 1;
}

function describe(goal) {
  if (!goal) return null;
  if (goal.kind === "level") {
    const skill = goal.skill.charAt(0) + goal.skill.slice(1).toLowerCase();
    return `${goal.level} ${skill} voor ${goal.why}`;
  }
  return `${goal.amount.toLocaleString("nl-NL")} gp voor ${goal.why}`;
}

module.exports = { candidates, pickGoal, reached, distance, goalWeight, describe, COMBAT_SKILLS };
