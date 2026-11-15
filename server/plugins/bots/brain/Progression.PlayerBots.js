"use strict";

/**
 * Bots move on as soon as they can, as players do: when a level-up opens a better activity of
 * the kind a bot is doing (level 60 Woodcutting: yews instead of willows, 40 Thieving: guards
 * instead of silk), it switches to it right away, and may travel to where it is done
 * (Brain.upgradeRoot). Combat training picks its monsters by level by itself.
 */
const definitions = require("../../../data/definitions/bot-activities.json");
const { bestActivity } = require("../adventurers/Planner.PlayerBots");

/** The skill each tiered mode trains. */
const MODE_SKILLS = Object.freeze({
  woodcutting: "WOODCUTTING",
  mining: "MINING",
  fishing: "FISHING",
  thieving: "THIEVING",
});

/** The level an activity asks for (its `level` field, from its own or inherited fields). */
function levelOf(activityId) {
  const fields = new Map();
  for (const activity of definitions.activities ?? []) {
    const own = activity.fieldsFrom ? { ...fields.get(activity.fieldsFrom), ...activity.fields } : activity.fields ?? {};
    fields.set(activity.id, own);
    if (activity.id === activityId) return Number(own.level ?? 1);
  }
  return 1;
}

/** The better activity a bot doing `current` (mode, id) should move to at `level`, or null. */
function upgradeFor(current, level) {
  if (!current || !MODE_SKILLS[current.mode]) return null;
  const best = bestActivity(current.mode, level, definitions);
  if (!best || best === current.id || levelOf(best) <= levelOf(current.id)) return null;
  return best;
}

/** A bot clicks Continue on a level-up this many ticks after it opens (1.2 to 3 s), as a player does. */
const CONTINUE_TICKS = [2, 5];

/**
 * The level-up pop-up pauses skilling until Continue (SkillLevelUp.plugin.js). A player clicks it
 * and carries on; a bot did not, and stood still after every level. It now clicks through a
 * moment later, and what the pop-up paused goes on.
 */
function continueLevelUps(api) {
  api.onCustomEvent("level-up:popup-opened", ({ player }) => {
    if (player?.isPlayerBot?.() !== true) return;
    const { Task, TaskManager } = api.core;
    const ticks = CONTINUE_TICKS[0] + Math.floor(Math.random() * (CONTINUE_TICKS[1] - CONTINUE_TICKS[0] + 1));
    TaskManager.submit(new (class extends Task {
      constructor() { super(ticks, player, false); }
      execute() {
        this.stop();
        if (player.isRegistered?.()) api.emitCustomEvent("level-up:continue", { player });
      }
    })());
  });
}

function startProgression(api, runtime, registry) {
  continueLevelUps(api);
  api.onPlayerLevelUp(({ player, skill, newLevel }) => {
    if (player?.isPlayerBot?.() !== true) return;
    const brain = runtime.entriesByUsername?.get?.(player.getUsername?.())?.brain;
    const current = brain?.currentRoot?.();
    if (!current || String(skill?.getName?.() ?? "").toUpperCase() !== MODE_SKILLS[current.mode]) return;
    const next = upgradeFor(current, newLevel);
    const activity = next ? registry.byId?.get(next) : null;
    if (activity) brain.upgradeRoot(activity, Date.now());
  });
}

module.exports = { startProgression, upgradeFor, levelOf, MODE_SKILLS };
