"use strict";

/**
 * One line per quest attempt, however it ends (docs/OBSERVABILITY.md, recipe "quest success"):
 * done, failed (put aside), or broken off for something else (gather an item, get off a roof,
 * died, an owner's override). With it the success rate per quest is one count, not a guess from
 * quest_done against the feedback log (152 starts, 0 done in 3 h on 20-11-2026 and no line said
 * how far each got).
 */
const OUTCOMES = ["done", "failed", "gather", "roof", "died", "override"];

/**
 * The quest_end metric for a run (QuestPlay's entry.questRun).
 * @param {object} run  { name, step, tries, startedAt, helperKey, helperStepId, reason, history }
 * @param {string} outcome  one of OUTCOMES
 * @param {object} [extra]  { bot, reason, nowMs, attempt, stage }
 */
function questEnd(run, outcome, extra = {}) {
  if (!run?.name) return null;
  if (!OUTCOMES.includes(outcome)) throw new Error(`[quest_end] unknown outcome '${outcome}'`);
  const nowMs = extra.nowMs ?? Date.now();
  const startedAt = Number.isFinite(run.startedAt) ? run.startedAt
    : run.history?.[0]?.at ? Date.parse(run.history[0].at) : null;
  return {
    kind: "quest_end",
    bot: extra.bot ?? null,
    quest: run.name,
    outcome,
    guide: run.helperKey ? "quest-helper" : "playthrough",
    // How far it got: the step count, the helper's own step id and the quest's stage.
    step: Number.isInteger(run.step) ? run.step : null,
    helperStep: run.helperStepId ?? null,
    stage: Number.isInteger(extra.stage) && extra.stage >= 0 ? extra.stage : null,
    tries: Number.isInteger(run.tries) ? run.tries : null,
    reason: outcome === "done" ? null : (extra.reason ?? run.reason ?? null),
    minutes: Number.isFinite(startedAt) ? Math.round((nowMs - startedAt) / 6000) / 10 : null,
    // This bot's attempt at this quest (1 = first).
    attempt: Number.isInteger(extra.attempt) ? extra.attempt : null,
  };
}

module.exports = { questEnd, OUTCOMES };
