"use strict";

/**
 * A general guard against errand loops (AI_Constitution §18: never repeat endlessly). The same
 * errand (reason and place) set off `repeats` times within `windowMs` without any XP gained is a
 * loop: it is reported once (the caller writes the event, metric and log line) and that errand is
 * refused for `blockMs`, so the planner picks something else.
 *
 * Why general: on 20-11-2026 three loops were found one after the other, each only after the last
 * was fixed (a bank, a buy at the exchange, a job's kit banked and fetched), each silent and each
 * fixed on its own. This catches the next one too, and says what it was.
 *
 * Plain data, no game core: the state lives on the adventurer (`entry.loops`).
 */
const LOOP_REPEATS = 8;
const LOOP_WINDOW_MS = 5 * 60_000;
const LOOP_BLOCK_MS = 15 * 60_000;
/** Errands with their own limits (a quest's tries, the way back to a grave). */
const EXEMPT_REASONS = new Set(["quest", "grave"]);
/** How many recent errands the report shows. */
const RECENT = 10;

function createLoopGuard({ now = () => Date.now(), repeats = LOOP_REPEATS, windowMs = LOOP_WINDOW_MS, blockMs = LOOP_BLOCK_MS } = {}) {
  const stateOf = (entry) => (entry.loops ??= { recent: [], blocked: new Map() });

  /** Whether this errand is refused for now (it was a loop). */
  function blocked(entry, reason, key) {
    const until = entry.loops?.blocked?.get(`${reason}|${key}`) ?? 0;
    return until > now();
  }

  /**
   * Notes an errand it set off. `progressAt` is when it last gained XP. Returns null, or once per
   * loop { reason, key, repeats, seconds, recent } when this errand has become a loop (now blocked).
   */
  function record(entry, reason, key, { to = key, progressAt = 0 } = {}) {
    const state = stateOf(entry);
    const at = now();
    state.recent.push({ reason, key, to, at });
    if (state.recent.length > 50) state.recent = state.recent.slice(-50);
    if (EXEMPT_REASONS.has(reason)) return null;
    // Only what is recent and came after its last XP counts.
    const since = Math.max(at - windowMs, progressAt ?? 0);
    const same = state.recent.filter((errand) => errand.reason === reason && errand.key === key && errand.at >= since);
    if (same.length < repeats) return null;
    state.blocked.set(`${reason}|${key}`, at + blockMs);
    const report = {
      reason, key, repeats: same.length, seconds: Math.round((at - same[0].at) / 1000),
      recent: state.recent.slice(-RECENT).map((errand) => ({ reason: errand.reason, to: errand.to })),
    };
    // Start counting afresh, so it reports this loop once.
    state.recent = state.recent.filter((errand) => !(errand.reason === reason && errand.key === key));
    return report;
  }

  return { blocked, record };
}

module.exports = { createLoopGuard, LOOP_REPEATS, LOOP_WINDOW_MS, LOOP_BLOCK_MS, EXEMPT_REASONS };
