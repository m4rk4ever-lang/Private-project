"use strict";

/**
 * What a clan has learned from its own jobs (AI_Constitution §24, §25: learn from runtime and
 * from each other, aggregated): per clan, per activity and per mode, the last jobs' coins and XP
 * per hour and how they ended. Kept over restarts in data/saves/adventurer-knowledge.json.
 *
 * Why (action-fit analysis 22-11-2026, A3): "geld verdienen (eens proberen)" was 87% of the money
 * jobs, meant 1 in 10. Each bot's own measure (entry.earn) was gone after every restart, kept per
 * skill, and an untried mode counted its guess (thieving 30.000 gp/h) against measured ones of a
 * few thousand. Gem stalls, measured at 2.792 gp/h, kept winning.
 *
 * Per clan (the owner, 22-11-2026): each clan learns only from its own members, a race of who
 * learns best. The same numbers are Activity Health (runtime analysis pakket 4): XP per hour and
 * how often a job ended stuck, per activity.
 */
const fs = require("node:fs");
const path = require("node:path");

/** Jobs kept per clan and key: a running window, so old versions fade out. */
const KEEP = 25;
/** A median counts once this many jobs measured it; fewer is still "untried" for the clan. */
const KNOWN_AFTER = 5;
const SAVE_EVERY_MS = 60_000;

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function createKnowledge({ file = path.join(process.cwd(), "data", "saves", "adventurer-knowledge.json"), now = () => Date.now(), write = null } = {}) {
  let state = { v: 1, clans: {} };
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved?.v === 1 && saved.clans && typeof saved.clans === "object") state = saved;
  } catch {
    // None yet, or unreadable: the clans start learning now.
  }
  let dirty = false;
  let savedAt = -Infinity;

  function save(force = false) {
    if (!dirty || (!force && now() - savedAt < SAVE_EVERY_MS)) return;
    dirty = false;
    savedAt = now();
    const text = JSON.stringify(state);
    if (write) return write(text);
    // Off the tick: the file is written in the background (a lost write is the next one's).
    fs.mkdir(path.dirname(file), { recursive: true }, () => {
      fs.writeFile(`${file}.tmp`, text, (error) => {
        if (!error) fs.rename(`${file}.tmp`, file, () => {});
      });
    });
  }

  /**
   * One finished job: `keys` are what it counts for (`mode:thieving`, `activity:gem_stalls`);
   * `gpPerHour` and `xpPerHour` null when it ran too short to measure; `stuck` when it ended so.
   */
  function record(clan, keys, { gpPerHour = null, xpPerHour = null, stuck = false } = {}) {
    if (!clan) return;
    const clanState = (state.clans[clan] ??= {});
    for (const key of keys.filter(Boolean)) {
      const jobs = (clanState[key] ??= []);
      jobs.push([Number.isFinite(gpPerHour) ? Math.round(gpPerHour) : null, Number.isFinite(xpPerHour) ? Math.round(xpPerHour) : null, stuck ? 1 : 0, Math.round(now() / 60_000)]);
      if (jobs.length > KEEP) jobs.splice(0, jobs.length - KEEP);
    }
    dirty = true;
    save();
  }

  /** What the clan knows of one key: { gpPerHour, xpPerHour, stuckRate, n (measured), jobs }. */
  function stats(clan, key) {
    const jobs = state.clans[clan]?.[key] ?? [];
    const gp = jobs.map((job) => job[0]).filter((value) => value !== null);
    return {
      gpPerHour: median(gp),
      xpPerHour: median(jobs.map((job) => job[1]).filter((value) => value !== null)),
      stuckRate: jobs.length ? Math.round((jobs.filter((job) => job[2]).length / jobs.length) * 100) / 100 : null,
      n: gp.length,
      jobs: jobs.length,
    };
  }

  /** Per mode, the clan's measured coins per hour when it has KNOWN_AFTER or more: { mode: { gpPerHour, n } }. */
  function moneyByMode(clan) {
    const out = {};
    for (const key of Object.keys(state.clans[clan] ?? {})) {
      if (!key.startsWith("mode:")) continue;
      const { gpPerHour, n } = stats(clan, key);
      out[key.slice(5)] = { gpPerHour, n, known: n >= KNOWN_AFTER };
    }
    return out;
  }

  /** The whole table, compact: for the metric and the dashboard. */
  function summary(clan) {
    const out = {};
    for (const key of Object.keys(state.clans[clan] ?? {})) out[key] = stats(clan, key);
    return out;
  }

  return { record, stats, moneyByMode, summary, save: () => save(true), clans: () => Object.keys(state.clans) };
}

module.exports = { createKnowledge, median, KNOWN_AFTER, KEEP };
