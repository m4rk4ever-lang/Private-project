"use strict";

/**
 * What an adventurer does next, from its levels and quests: a pure function, so it is easy to
 * test and to reason about. An adventurer either trains a skill or does a quest.
 *
 * - A quest is ready when its required skills, quests, quest points and recommended combat level
 *   are met. With `questChance` the adventurer takes the first ready quest on the path.
 * - Otherwise it trains. It prefers what the next quest on its path still needs (Mining 10 for
 *   The Knight's Sword, combat 45 for Dragon Slayer I); with nothing needed, its lowest skill.
 *   Each choice is a mode the bots can do (woodcutting, mining, fishing, thieving, combat,
 *   Wintertodt for Firemaking from level 50) and the best activity of that mode for its level.
 */
const TRAINABLE = Object.freeze({
  WOODCUTTING: "woodcutting",
  MINING: "mining",
  FISHING: "fishing",
  THIEVING: "thieving",
});
const COMBAT = "combat_training";
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
  if ((adventurer.levels.FIREMAKING ?? 1) >= WINTERTODT_LEVEL) {
    options.push({ mode: "wintertodt", skill: "FIREMAKING", level: adventurer.levels.FIREMAKING });
  }
  return options;
}

/**
 * The next thing to do: { kind: "quest", quest } or { kind: "train", mode, skill, reason }.
 * `quests` is the path (adventurers.json), `available` the names this server has.
 */
function chooseNext(adventurer, quests, { available = null, questChance = 0.45, random = Math.random } = {}) {
  const open = quests.filter((quest) => !adventurer.done.has(quest.name) && (!available || available.has(quest.name)));
  const ready = open.filter((quest) => isReady(quest, adventurer));
  if (ready.length > 0 && random() < questChance) {
    return { kind: "quest", quest: ready[0] };
  }
  const options = trainingOptions(adventurer);
  // What the nearest quest that is not ready still needs, and that the bots can train.
  for (const quest of open) {
    if (isReady(quest, adventurer)) continue;
    const gap = missing(quest, adventurer);
    if (gap.combat) {
      return { kind: "train", mode: COMBAT, skill: "COMBAT", reason: `${quest.name} (combat ${gap.combat})` };
    }
    for (const [skill, level] of Object.entries(gap.skills)) {
      const option = options.find((entry) => entry.skill === skill);
      if (option) return { kind: "train", mode: option.mode, skill, reason: `${quest.name} (${skill.toLowerCase()} ${level})` };
    }
  }
  // Nothing in the way: bring up the lowest, with a little chance so it is not always the same.
  const sorted = options.slice().sort((a, b) => a.level - b.level);
  const pickFrom = sorted.slice(0, Math.min(3, sorted.length));
  const choice = pickFrom[Math.floor(random() * pickFrom.length)];
  return { kind: "train", mode: choice.mode, skill: choice.skill, reason: "lowest skills" };
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

module.exports = { chooseNext, missing, isReady, trainingOptions, bestActivity, TRAINABLE, COMBAT };
