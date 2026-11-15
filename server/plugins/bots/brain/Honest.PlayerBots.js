"use strict";

/**
 * Which bots play honestly (adventurers, world bots with a generated account): from then on the
 * outfit, gear and tool helpers leave them alone, so nothing is put on them that they did not
 * buy, find or make. Kept on the player itself, so every helper can check it without the bot's
 * brain state (SiteSpawner's outfits, Travel's job clothes).
 */
const honest = new WeakSet();

/** Also on the player, for other plugins' own checks (a bot needs its own tinderbox then). */
const HONEST_ATTRIBUTE = "bots:honest";

function markHonest(player) {
  if (!player) return;
  honest.add(player);
  player.setAttribute?.(HONEST_ATTRIBUTE, true);
}

function isHonest(player) {
  return Boolean(player) && honest.has(player);
}

module.exports = { markHonest, isHonest, HONEST_ATTRIBUTE };
