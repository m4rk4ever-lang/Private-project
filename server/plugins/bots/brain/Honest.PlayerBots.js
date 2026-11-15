"use strict";

/**
 * Which bots play honestly (adventurers, world bots with a generated account): from then on the
 * outfit, gear and tool helpers leave them alone, so nothing is put on them that they did not
 * buy, find or make. Kept on the player itself, so every helper can check it without the bot's
 * brain state (SiteSpawner's outfits, Travel's job clothes).
 */
const honest = new WeakSet();

function markHonest(player) {
  if (player) honest.add(player);
}

function isHonest(player) {
  return Boolean(player) && honest.has(player);
}

module.exports = { markHonest, isHonest };
