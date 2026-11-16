"use strict";

// Bots spawn one per game tick so the crowd fills in gradually instead of spiking CPU and
// memory while the server is still starting (a codespace has 8 GB for server, client and
// Quest Helper together): ~50 world bots in half a minute.
const SPAWNS_PER_BATCH = 1;
const SPAWN_BATCH_DELAY_MS = 600;

// The adventurers come first; the world bots (sites, Wilderness pool) only after this long
// from startup. BOT_WORLD_DELAY_MS=0 starts them at once.
// Tests (node --test) start them at once.
const WORLD_BOT_DELAY_MS = Math.max(0, Number(process.env.BOT_WORLD_DELAY_MS
  ?? (process.env.NODE_TEST_CONTEXT ? 0 : 45_000)) || 0);
const loadedAt = Date.now();

/** Milliseconds until world bots may spawn (0 when they may now). */
function worldBotWaitMs(now = Date.now()) {
  return Math.max(0, loadedAt + WORLD_BOT_DELAY_MS - now);
}

/** Runs `jobs` (functions) SPAWNS_PER_BATCH at a time, then calls `onDone`. */
function runPaced(jobs, onDone = null) {
  let cursor = 0;
  const flush = () => {
    const end = Math.min(cursor + SPAWNS_PER_BATCH, jobs.length);
    while (cursor < end) jobs[cursor++]();
    if (cursor < jobs.length) {
      setTimeout(flush, SPAWN_BATCH_DELAY_MS);
    } else {
      onDone?.();
    }
  };
  flush();
}

module.exports = {
  WORLD_BOT_DELAY_MS,
  worldBotWaitMs,
  SPAWNS_PER_BATCH,
  SPAWN_BATCH_DELAY_MS,
  runPaced,
};
