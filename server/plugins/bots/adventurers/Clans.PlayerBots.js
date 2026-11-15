"use strict";

/**
 * The adventurers' clans (adventurers.json "clans"): three clans of equal size, each with a
 * leader who founds it in game, racing each other. Within a clan they hand each other
 * materials one of them really has spare (gift()).
 */

/** Every adventurer's name, clan by clan; the old flat `names` list when there are no clans. */
function namesOf(data) {
  if (!Array.isArray(data.clans) || data.clans.length === 0) return [...(data.names ?? [])];
  return data.clans.flatMap((clan) => clan.members);
}

/** The clan this adventurer is in, or null. */
function clanOf(data, name) {
  return (data.clans ?? []).find((clan) => clan.members.includes(name)) ?? null;
}

/** The others in its clan. */
function matesOf(data, name) {
  return (clanOf(data, name)?.members ?? []).filter((other) => other !== name);
}

/** Equal sizes: the race is fair only when every clan has as many members. */
function equalSizes(data) {
  const sizes = new Set((data.clans ?? []).map((clan) => clan.members.length));
  return sizes.size <= 1;
}

/**
 * Hands over `wanted` of an item from clanmates' spare stock: each mate gives only what is
 * above its own need (`spare(mate, itemId)`). `take(mate, amount)` removes it from the mate's
 * bank and returns how many came out. Returns [{ mate, amount }].
 */
function gift(mates, itemId, wanted, { spare, take }) {
  const given = [];
  let left = wanted;
  for (const mate of mates) {
    if (left <= 0) break;
    const amount = Math.min(left, Math.max(0, Math.floor(spare(mate, itemId))));
    if (amount <= 0) continue;
    const got = take(mate, amount);
    if (got > 0) {
      given.push({ mate, amount: got });
      left -= got;
    }
  }
  return given;
}

module.exports = { namesOf, clanOf, matesOf, equalSizes, gift };
