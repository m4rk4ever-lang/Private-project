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

/**
 * The adventurers themselves (15 player-like accounts): their brain runs every server cycle, as a
 * player clicks on, so a kill is followed by the next attack and a full fish spot by the next
 * cast without seconds of standing around. World bots stay on the cheaper far-away schedule.
 */
const adventurers = new WeakSet();

function markAdventurer(player) {
  if (player) adventurers.add(player);
}

function isAdventurer(player) {
  return Boolean(player) && adventurers.has(player);
}

module.exports = { markHonest, isHonest, markAdventurer, isAdventurer, HONEST_ATTRIBUTE };
