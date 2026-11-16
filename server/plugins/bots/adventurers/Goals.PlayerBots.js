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
function candidates(view, { gear, levelOf, owns, worn, priceOf, questDone, idOf, coins, styles = null }) {
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
  // Ranged or Magic gear only for a style it can train now (a bow and arrows, runes): a Ranged
  // goal without them would leave it fighting with a sword "for" Ranged.
  for (const [name, style] of Object.entries(gear.styles ?? {})) {
    if (styles && !styles.includes(name)) {
      // Not yet: the coins for a start (a bow it owns or can use and 300 arrows; 200 air and
      // 100 mind runes), earned first, as a player saves up for a bow before ranging.
      const kit = styleKit(name, style, { levelOf, owns, priceOf, idOf });
      if (kit) out.push({ kind: "coins", amount: kit.amount, item: kit.item, why: kit.why });
      continue;
    }
    for (const list of Object.values(style)) consider(list);
  }
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

/** The coins to start a fighting style with: { amount, item, why }, or null when it is free. */
function styleKit(name, style, { levelOf, owns, priceOf, idOf }) {
  if (name === "ranged") {
    const bows = (style.weapon ?? []).filter((entry) => levelOf(entry.skill) >= (entry.level ?? 1));
    const bow = bows[bows.length - 1];
    const ammo = (style.ammo ?? []).filter((entry) => levelOf(entry.skill) >= (entry.level ?? 1)).pop();
    if (!bow || !ammo) return null;
    const bowCost = bows.some((entry) => owns(idOf(entry.item))) ? 0 : priceOf(idOf(bow.item));
    const amount = bowCost + 300 * priceOf(idOf(ammo.item));
    return amount > 0 ? { amount, item: bowCost > 0 ? bow.item : ammo.item, why: `een boog en pijlen (Ranged)` } : null;
  }
  if (name === "magic") {
    const amount = 200 * priceOf(idOf("AIR_RUNE")) + 100 * priceOf(idOf("MIND_RUNE"));
    return amount > 0 ? { amount, item: "MIND_RUNE", why: "runes om te toveren (Magic)" } : null;
  }
  return null;
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
    if (goal.skill === "RANGED") return option.mode === "combat_ranged" ? 4 : 1;
    if (goal.skill === "MAGIC") return option.mode === "combat_magic" ? 4 : 1;
    return option.skill === goal.skill ? 4 : 1;
  }
  // Saving up: what earns (loot, pickpockets, produce to sell) more, spending on materials less.
  if (option.mode.startsWith("buy_")) return 0.3;
  if (option.mode === "thieving") return 2;
  if (option.mode === "combat_training") return 1.5;
  // Logs, ore and fish sell too (willows, iron, a bag of cowhides from combat above).
  if (["woodcutting", "mining", "fishing"].includes(option.mode)) return 1.5;
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
