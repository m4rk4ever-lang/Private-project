"use strict";

/**
 * Where an adventurer does its job: a place from the travel destinations (data/travel-
 * destinations.json) that fits the job (its mode, its level range, the `activities` it names),
 * that its quests and items let it reach on foot (`meets`), and that is near: a player picks
 * the nearest good spot, not a hub or a quiet corner as the world bots do (Travel.PlayerBots.js
 * spreads those out). The job itself then runs on the bot's brain from there (state.home).
 *
 * Its own module so the adventurers do not share the world bots' travel rules (hubs, crowding,
 * hangouts, minigames): a change for the world population does not move the adventurers.
 */
const { data: travelData, levelFor } = require("../brain/Travel.PlayerBots");

/** Skill modes a site can be chosen for, as the travel data names them. */
function sitesFor(activity, level, { meets = () => true, destinations = travelData.destinations } = {}) {
  const mode = activity?.mode;
  return destinations.filter((place) => place.modes?.includes(mode)
    && level >= (place.minLevel ?? 1) && level <= (place.maxLevel ?? Infinity)
    && (!Array.isArray(place.activities) || place.activities.includes(activity.id))
    && meets(place));
}

/**
 * The site for this job: the nearest that fits, with a little spread (a second place nearly as
 * near now and then, so three thieves do not always stand at the same stall). Null when there is
 * none (a job done anywhere, or nowhere it can reach yet).
 */
function pickSite(player, activity, { core, distance, meets, random = Math.random, destinations } = {}) {
  const level = levelFor(player, activity?.mode, core);
  const here = player.getLocation();
  const from = { x: here.getX(), y: here.getY(), z: here.getZ() };
  const options = sitesFor(activity, level, { meets: (place) => meets?.(player, place.requires, place) ?? true, destinations })
    .map((place) => ({ place, away: distance(from, place, player) }))
    .filter((entry) => Number.isFinite(entry.away))
    .sort((a, b) => a.away - b.away);
  if (options.length === 0) return null;
  const near = options.filter((entry) => entry.away <= options[0].away * 1.25 + 20);
  return near[Math.floor(random() * near.length)].place;
}

/** Sends its brain there: the job's home is the site, as Travel does for the world bots. */
function settleAt(state, place) {
  if (!state || !place) return;
  state.home = { x: place.x, y: place.y, z: place.z ?? 0 };
  state.place = { id: place.id, minigame: null, combatGear: false };
  if (state.roaming) {
    state.roaming.roamBounds = null;
    state.roaming.target = null;
  }
}

module.exports = { sitesFor, pickSite, settleAt };
