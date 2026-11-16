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

/**
 * Adds `extra` members to every clan (adventurers.json "extraPerClan"): the clan's own bot name
 * numbered on (Jorgbot 5, 6 ...), so every clan stays as big as the others. For a longer test run
 * with more adventurers; set it back to 0 to play with the clans as they were.
 */
function expand(data, extra) {
  const count = Math.max(0, Math.floor(Number(extra) || 0));
  if (count === 0 || !Array.isArray(data.clans)) return data;
  for (const clan of data.clans) {
    const numbered = clan.members.map((name) => /^(.*bot) (\d+)$/i.exec(name)).filter(Boolean);
    const prefix = numbered[0]?.[1] ?? `${String(clan.name).split(" ")[0]}bot`;
    let last = Math.max(0, ...numbered.filter((match) => match[1] === prefix).map((match) => Number(match[2])));
    for (let added = 0; added < count; added += 1) {
      let name;
      do name = `${prefix} ${(last += 1)}`; while (clan.members.includes(name));
      clan.members.push(name);
    }
  }
  return data;
}

module.exports = { namesOf, clanOf, matesOf, equalSizes, gift, expand };
