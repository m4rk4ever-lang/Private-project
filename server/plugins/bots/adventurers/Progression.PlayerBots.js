"use strict";

/**
 * Progression by unlock value (AI_Constitution §10, §11; Phase 5): which unlock has the highest
 * future value, not which activity gives the most XP. The values are data
 * (plugins/bots/data/unlock-values.json); this only weighs them.
 *
 * - A quest's value: the unlocks it gives, its share of the Quest Cape, and half the value of the
 *   unlocks it opens the way to (a quest another unlock's quest needs; quest points toward one).
 * - A candidate's score: its value over the effort still in the way (levels, combat, quests and
 *   quest points short), so a near unlock beats a far one of the same worth.
 *
 * Why: the decision metric of 20-11-2026 (v ce581ab) showed about half of the picks only
 * balancing skills ("achterstand", "afwisseling"), serving no unlock.
 *
 * Plain logic, no game core: the adventurer is the planner's view (levels, combat, questPoints,
 * done) and the quests the path from adventurers.json.
 */

/** Of an unlock that a quest opens the way to, this share counts for that quest. */
const DOWNSTREAM_SHARE = 0.5;
/** Effort per quest still to do first, and per quest point short. */
const EFFORT_PER_QUEST = 10;
const EFFORT_PER_QUEST_POINT = 3;
/** Melee skills a training option for combat raises. */
const MELEE = new Set(["ATTACK", "STRENGTH", "DEFENCE", "HITPOINTS"]);

function levelOf(adventurer, skill) {
  if (skill === "COMBAT") return adventurer.combat ?? 3;
  return adventurer.levels?.[skill] ?? 1;
}

/** What still stands between the adventurer and a quest: { skills, combat, quests, questPoints }. */
function gapOf(quest, adventurer) {
  const skills = {};
  for (const [skill, level] of Object.entries(quest.skills ?? {})) if (levelOf(adventurer, skill) < level) skills[skill] = level;
  return {
    skills,
    combat: (adventurer.combat ?? 3) < (quest.combat ?? 0) ? quest.combat : 0,
    quests: (quest.quests ?? []).filter((name) => !adventurer.done?.has(name)),
    questPoints: (adventurer.questPoints ?? 0) < (quest.questPoints ?? 0) ? quest.questPoints : 0,
  };
}

/** Levels, quests and quest points still to go, as one number. */
function effortOf(gap, adventurer) {
  let effort = 0;
  for (const [skill, level] of Object.entries(gap.skills ?? {})) effort += level - levelOf(adventurer, skill);
  if (gap.combat) effort += gap.combat - (adventurer.combat ?? 3);
  effort += (gap.quests?.length ?? 0) * EFFORT_PER_QUEST;
  if (gap.questPoints) effort += (gap.questPoints - (adventurer.questPoints ?? 0)) * EFFORT_PER_QUEST_POINT;
  return effort;
}

/** A quest's value now: its own unlocks, its Quest Cape share, half of what it opens the way to. */
function questValue(quest, { adventurer, quests = [], data = {} } = {}) {
  const unlocks = data.unlocks ?? [];
  const own = unlocks.filter((unlock) => unlock.quest === quest.name).reduce((sum, unlock) => sum + unlock.value, 0);
  const cape = quests.length > 0 ? (data.questCape ?? 0) / quests.length : 0;
  let downstream = 0;
  for (const unlock of unlocks) {
    if (!unlock.quest || unlock.quest === quest.name || adventurer?.done?.has(unlock.quest)) continue;
    const target = quests.find((entry) => entry.name === unlock.quest);
    if (!target) continue;
    const needsIt = (target.quests ?? []).includes(quest.name);
    const shortOfPoints = (target.questPoints ?? 0) > (adventurer?.questPoints ?? 0);
    if (needsIt || shortOfPoints) downstream += unlock.value * DOWNSTREAM_SHARE * (needsIt ? 1 : 0.5);
  }
  return Math.round(own + cape + downstream);
}

/**
 * Everything worth working toward now, best first: quests on the path not done (ready or not)
 * and skill unlocks not reached. Each { kind, name, value, effort, score, quest?, gap?, skill?,
 * level? }. Score = value / (1 + effort / 10).
 */
function candidates(adventurer, quests, data = {}, { available = null } = {}) {
  const out = [];
  for (const quest of quests) {
    if (adventurer.done?.has(quest.name) || (available && !available.has(quest.name))) continue;
    const gap = gapOf(quest, adventurer);
    const effort = effortOf(gap, adventurer);
    const value = questValue(quest, { adventurer, quests, data });
    out.push({ kind: "quest", name: quest.name, quest, gap, value, effort, ready: effort === 0, score: value / (1 + effort / 10) });
  }
  for (const unlock of data.unlocks ?? []) {
    if (!unlock.skill || levelOf(adventurer, unlock.skill) >= unlock.level) continue;
    const effort = unlock.level - levelOf(adventurer, unlock.skill);
    out.push({ kind: "skill", name: unlock.name ?? unlock.id, unlock, skill: unlock.skill, level: unlock.level, value: unlock.value,
      effort, ready: false, score: unlock.value / (1 + effort / 10) });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * The training option that works toward a skill: its own mode, or combat training for a melee
 * skill. Null when it cannot train it now.
 */
function optionFor(skill, options) {
  return options.find((option) => option.skill === skill)
    ?? (MELEE.has(skill) ? options.find((option) => option.skill === "COMBAT") : null)
    ?? null;
}

module.exports = { candidates, questValue, gapOf, effortOf, optionFor, DOWNSTREAM_SHARE };
