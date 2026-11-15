"use strict";

/**
 * Some of the world's bots are Ironmen, as on live OSRS: standard, Ultimate and Hardcore, with
 * the account type's chat icon (the Ironman plugin's own setMode). Which bot is which is fixed by
 * its name, so it stays the same over restarts. The adventurers are never Ironmen.
 *
 * Hardcores can die. Now and then one that is fighting takes a hit it does not survive: its
 * normal death, so the Ironman plugin turns it into a standard Ironman. Every Hardcore death,
 * a bot's or a player's, is announced to everyone online:
 * "<name> has died as a Hardcore Ironman with a total level of 1,234!"
 */
const SHARES = Object.freeze({ hardcore: 0.05, ultimate: 0.03, ironman: 0.1 });
const DOWNFALL_CHECK_TICKS = 500;
/** The chance per check (every 5 minutes) that one fighting Hardcore bot dies: about one an hour. */
const DOWNFALL_CHANCE = 0.08;
const DEATH_COLOUR = "ef1020";

function ironman() {
  return require("../../modes/ironman/Common.Ironman");
}

/** A stable number in [0, 1) for a name (FNV-1a, mixed). */
function roll(name) {
  let hash = 0x811c9dc5;
  for (const char of String(name)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // murmur3's finaliser: similar names (Bot1, Bot2) land far apart.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

/** The account type a bot of this name gets: "hardcore", "ultimate", "ironman" or "none". */
function modeFor(name, shares = SHARES) {
  let value = roll(`iron:${name}`);
  for (const [mode, share] of Object.entries(shares)) {
    if (value < share) return mode;
    value -= share;
  }
  return "none";
}

/** Gives a freshly spawned site bot its account type. */
function assignIronMode(bot) {
  const mode = modeFor(bot?.getUsername?.() ?? "");
  if (mode === "none") return mode;
  try {
    const Common = ironman();
    if (Common.api) Common.setMode(bot, mode);
  } catch (_) {
    // The Ironman plugin is not loaded: every bot is a normal account.
  }
  return mode;
}

/** "<name> has died as a Hardcore Ironman with a total level of N!" to everyone online. */
function announceHardcoreDeath(core, { player }) {
  const total = player?.getSkillManager?.()?.getTotalLevel?.() ?? 0;
  core.World.sendMessage(`<col=${DEATH_COLOUR}>${player.getDisplayName?.() ?? player.getUsername()} has died as a Hardcore Ironman with a total level of ${total.toLocaleString("en-GB")}!</col>`);
}

/** Every few minutes, maybe one Hardcore bot in a fight takes a hit it does not survive. */
function downfall(core, runtime, random = Math.random) {
  if (random() >= DOWNFALL_CHANCE) return null;
  const Common = ironman();
  const fighters = [...(runtime.entriesByUsername?.values?.() ?? [])]
    .map((entry) => entry.player ?? entry.bot ?? null)
    .filter((bot) => bot?.isRegistered?.() && Common.modeOf(bot) === "hardcore"
      && (bot.getCombat?.()?.getTarget?.() || bot.getCombat?.()?.getAttacker?.()));
  const bot = fighters[Math.floor(random() * fighters.length)];
  if (!bot) return null;
  bot.getCombat().getHitQueue().addPendingDamage([new core.HitDamage(bot.getHitpoints() + 5, core.HitMask.RED)]);
  return bot;
}

function startIronmen(api, runtime) {
  const core = api.core;
  api.onCustomEvent("ironman:hardcore-death", (event) => announceHardcoreDeath(core, event));
  const { Task } = core;
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(DOWNFALL_CHECK_TICKS, "bot-hardcore-downfall", false); }
    execute() {
      try {
        downfall(core, runtime);
      } catch (_) {
        // The Ironman plugin is not loaded: no Hardcores to fall.
      }
    }
  })());
}

module.exports = { startIronmen, assignIronMode, modeFor, downfall, announceHardcoreDeath, SHARES };
