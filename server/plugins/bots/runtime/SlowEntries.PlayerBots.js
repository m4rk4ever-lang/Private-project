"use strict";

/**
 * Bots whose turn in the behaviour task took long (the server stood still for 2 to 27 s after a
 * restart, BotBehaviorTask, 21-11-2026; route and stairs searches were not it). BehaviorTask
 * reports them here; whoever writes metrics (Adventurers) listens. A help, not a must: a listener
 * that throws is ignored.
 */
const SLOW_ENTRY_MS = 500;
const SLOW_TICK_MS = 1000;
// One listener per name: a reloaded plugin replaces its own.
const listeners = new Map();

function onSlow(name, listener) {
  if (typeof listener === "function") listeners.set(name, listener);
}

function report(event) {
  for (const listener of listeners.values()) {
    try {
      listener(event);
    } catch {
      // A help, not a must.
    }
  }
}

/** What the bot's brain is doing now: its behaviour and action ids. Cheap: property reads. */
function brainNow(entry) {
  try {
    const brain = entry?.brain;
    const frame = brain?.frames?.[brain.frames.length - 1];
    return { mode: entry?.state?.mode ?? null, activity: frame?.behaviour?.id ?? null, frames: brain?.frames?.length ?? 0 };
  } catch {
    return { mode: null, activity: null, frames: null };
  }
}

let planner = null;
/** All planning time so far (ms): the share of a long turn that went to route searches. */
function planMs() {
  try {
    planner ??= require("../behaviours/navigation/LongRoutePlanner.PlayerBots");
    return planner.planTotalMs();
  } catch {
    return 0;
  }
}

module.exports = { SLOW_ENTRY_MS, SLOW_TICK_MS, onSlow, report, brainNow, planMs };
