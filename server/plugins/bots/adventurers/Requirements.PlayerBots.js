"use strict";

/**
 * Requirement validation before a choice (AI_Constitution §7: no action without CanExecute).
 * The planner's options are checked here first; what cannot be done now is left out of the pick,
 * with the reason, so the planner does not choose it, fail and choose it again.
 *
 * Why: on 20-11-2026 (decision metric, v 696c6cd, 24 min) 39% of the picks did not start. Most
 * known reasons were a tool it could not get (a bird snare 13 times, by the same four bots) and a
 * place it could not reach (the Giant Mole, Wintertodt).
 *
 * Plain logic, no game core: the facts come in through `ctx`, built by the adventurers from the
 * same checks the start of a job uses (owning, shops, the exchange, TravelHubs.onFoot with its
 * floors and locked areas, blocked places). So the check before and the start after agree.
 *
 * ctx: {
 *   has(name)          -> owns it anywhere (bag, worn, bank)
 *   obtainable(name)   -> a shop near or the exchange has it, and it can pay
 *   reachable(place)   -> { x, y, z } can be walked to (floor and locked areas included)
 *   remembered(key)    -> { why, detail } of a recent failure of this option, or null
 *   toolsFor(option)   -> { any: [names], all: [names] } the tools the option needs
 *   placeOf(option)    -> { x, y, z } where it must go, or null when it finds its own spot
 * }
 */

/** Reasons that say a requirement is missing (remembered a while), not a passing hitch. */
const REQUIREMENT_REASONS = new Set(["on_hold", "tool_unbuyable", "not_buyable", "place_unreachable", "no_site", "no_activity",
  "skill_level", "item_missing", "no_style_gear", "too_poor", "no_agility_course", "no_buy_plan"]);
/** How long a failed requirement keeps an option out. */
const REMEMBER_MS = 30 * 60_000;

/** The key an option is remembered by: its mode, or the boss. */
function keyOf(option) {
  if (option?.kind === "boss" || option?.boss) return `boss:${option.boss?.id ?? option.id}`;
  return option?.mode ?? null;
}

/**
 * Whether the option can be done now: { ok: true } or { ok: false, why, detail }. Checked in this
 * order: a recent failure, the tools, the place.
 */
function canExecute(option, ctx) {
  const key = keyOf(option);
  const memory = key ? ctx.remembered?.(key) : null;
  if (memory) return { ok: false, why: memory.why, detail: { ...(memory.detail ?? {}), remembered: true } };
  const tools = ctx.toolsFor?.(option) ?? { any: [], all: [] };
  const usable = (name) => ctx.has?.(name) || ctx.obtainable?.(name);
  if ((tools.any ?? []).length > 0 && !tools.any.some(usable)) {
    return { ok: false, why: "tool_unbuyable", detail: { tools: tools.any } };
  }
  const lacking = (tools.all ?? []).filter((name) => !usable(name));
  if (lacking.length > 0) return { ok: false, why: "tool_unbuyable", detail: { tools: lacking } };
  const place = ctx.placeOf?.(option) ?? null;
  if (place && ctx.reachable && !ctx.reachable(place)) {
    return { ok: false, why: "place_unreachable", detail: { place: { x: place.x, y: place.y, z: place.z ?? 0 } } };
  }
  return { ok: true };
}

/**
 * Remembers a failed start when its reason is a missing requirement (REMEMBER_MS), or a refused
 * errand while errands rest after a failed one (until that rest ends, `restingUntil`): the planner
 * picked such jobs again and again in that rest (17 of 26 failed picks, v eef0e4d, 20-11-2026).
 * Returns whether it did.
 */
function remember(state, option, failure, nowMs, { restingUntil = 0 } = {}) {
  const key = keyOf(option);
  if (!key || !failure) return false;
  if (failure.why === "errand_refused" && failure.detail?.why === "errands_resting" && restingUntil > nowMs) {
    state.set(key, { why: "errands_resting", detail: { errand: failure.detail.errand ?? null }, until: restingUntil });
    return true;
  }
  if (!REQUIREMENT_REASONS.has(failure.why)) return false;
  state.set(key, { why: failure.why, detail: failure.detail ?? null, until: nowMs + REMEMBER_MS });
  return true;
}

/** A remembered failure of `key` that has not run out, or null. */
function recall(state, key, nowMs) {
  const memory = state?.get(key);
  if (!memory) return null;
  if (memory.until <= nowMs) {
    state.delete(key);
    return null;
  }
  return memory;
}

/**
 * Sailing for a bot (ADVENTURER_ROADMAP Fase 6, "Sailing, stappen" 1): not a job yet, but the
 * planner says why in `decision.blocked.sailing`, so the first missing step shows in the logs.
 * The Sailing plugin's order: Pandemonium (Pandemonium.Quest.js) gives the raft, from Junior
 * Jim's dialogue at stage 28 only (grantRaft). A quest set complete by adventurers.json
 * `grantedQuests` (stage only) gives no raft; after it a shipwright's Buy-boat sells one. With
 * a boat it still needs a bot that boards, takes the helm and sails (step 2, not built).
 *
 * facts: { pandemonium: { stage, complete, granted, playthrough }, boats: [{ type, dock }], level }
 * Returns { ok: false, why, detail }: `no_quest_playthrough` (Pandemonium not done and no bot
 * playthrough), `quest_missing` (not done, but playable), `no_boat` (done, no boat),
 * `no_sailing_brain` (a boat, nobody to sail it). Never ok until step 2 is built.
 */
function sailingReadiness(facts = {}) {
  const quest = facts.pandemonium ?? {};
  const boats = Array.isArray(facts.boats) ? facts.boats : [];
  const level = facts.level ?? 1;
  if (!quest.complete) {
    return { ok: false, why: quest.playthrough ? "quest_missing" : "no_quest_playthrough",
      detail: { quest: "Pandemonium", stage: quest.stage ?? 0, level } };
  }
  if (boats.length === 0) {
    return { ok: false, why: "no_boat", detail: { quest: "Pandemonium", granted: Boolean(quest.granted), level } };
  }
  return { ok: false, why: "no_sailing_brain", detail: { boats: boats.map((boat) => `${boat.type}@${boat.dock ?? "?"}`), level } };
}

module.exports = { canExecute, sailingReadiness, remember, recall, keyOf, REQUIREMENT_REASONS, REMEMBER_MS };
