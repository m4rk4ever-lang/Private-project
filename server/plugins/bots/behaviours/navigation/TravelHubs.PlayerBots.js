"use strict";

/**
 * Long walks across the map. The route planner (LongRoutePlanner) plans within a box of about
 * 640 tiles, so a walk from Lumbridge to the Gnome Stronghold got no plan, and the bot walked
 * straight at it into the first wall or river and stood there. Towns and crossroads
 * (data/travel-hubs.json) are stepping stones: the walk goes hub to hub, each leg short enough to
 * plan, along links that were checked with the planner in game. The hubs are found with a
 * shortest path (Dijkstra) over those links, from where the bot stands to the goal.
 */
const data = require("../../data/travel-hubs.json");

/** Walks up to this long are planned in one go; longer ones go by hubs. */
const DIRECT_TILES = 250;
/** A hub this close counts as reached: the next one is the leg. */
const AT_HUB_TILES = 6;
/** Legs to and from hubs that are not checked links cost a little more (a river may be between). */
const UNCHECKED_COST = 1.25;

const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function build(source = data) {
  const hubs = new Map(Object.entries(source.hubs ?? {}).map(([key, [x, y, z = 0]]) => [key, { key, x, y, z }]));
  const links = new Map([...hubs.keys()].map((key) => [key, []]));
  // A link: [a, b, tiles], the walk's length as the planner found it (straight distance if left out).
  for (const [a, b, tiles] of source.links ?? []) {
    if (!hubs.has(a) || !hubs.has(b)) continue;
    const cost = Number.isFinite(tiles) ? tiles : chebyshev(hubs.get(a), hubs.get(b));
    links.get(a).push({ to: b, cost });
    links.get(b).push({ to: a, cost });
  }
  return { hubs, links };
}

let graph = null;

/**
 * The next hub to walk to on the way from `here` to `goal` ({ x, y, z }), or null when the goal
 * is close enough to plan at once, on another floor, or no chain of hubs leads there.
 * `avoid`: hub keys this walk could not reach (it tried, the planner found no way).
 */
function nextLeg(here, goal, avoid = null, source = null) {
  const { hubs, links } = source ? build(source) : (graph ??= build());
  const z = here.z ?? 0;
  if ((goal.z ?? 0) !== z || chebyshev(here, goal) <= DIRECT_TILES) return null;
  const usable = [...hubs.values()].filter((hub) => hub.z === z && !avoid?.has?.(hub.key));
  const dist = new Map();
  const first = new Map();
  const done = new Set();
  // From here: hubs within a plannable walk, except the one it stands at.
  for (const hub of usable) {
    const away = chebyshev(here, hub);
    if (away > DIRECT_TILES || away <= AT_HUB_TILES) continue;
    dist.set(hub.key, away * UNCHECKED_COST);
    first.set(hub.key, hub);
  }
  // Standing at a hub: its own links are the way on.
  const at = usable.find((hub) => chebyshev(here, hub) <= AT_HUB_TILES);
  if (at) {
    for (const link of links.get(at.key) ?? []) {
      const hub = hubs.get(link.to);
      if (!hub || avoid?.has?.(hub.key)) continue;
      if (link.cost < (dist.get(hub.key) ?? Infinity)) {
        dist.set(hub.key, link.cost);
        first.set(hub.key, hub);
      }
    }
  }
  let best = { cost: Infinity, first: null };
  while (true) {
    let key = null;
    for (const [candidate, cost] of dist) if (!done.has(candidate) && (key === null || cost < dist.get(key))) key = candidate;
    if (key === null || dist.get(key) >= best.cost) break;
    done.add(key);
    const hub = hubs.get(key);
    const toGoal = chebyshev(hub, goal);
    if (toGoal <= DIRECT_TILES) {
      const total = dist.get(key) + toGoal * UNCHECKED_COST;
      if (total < best.cost) best = { cost: total, first: first.get(key) };
    }
    for (const link of links.get(key) ?? []) {
      if (avoid?.has?.(link.to) || done.has(link.to)) continue;
      const cost = dist.get(key) + link.cost;
      if (cost < (dist.get(link.to) ?? Infinity)) {
        dist.set(link.to, cost);
        first.set(link.to, first.get(key));
      }
    }
  }
  return best.first;
}

/** Hub keys connected by links to `from` (Lumbridge, where every account starts). */
let mainland = null;
function connectedTo(from = "lumbridge", source = null) {
  const { links } = source ? build(source) : (graph ??= build());
  if (!source && mainland) return mainland;
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    for (const link of links.get(queue.shift()) ?? []) {
      if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    }
  }
  if (!source) mainland = seen;
  return seen;
}

/**
 * Whether a place can be walked to from Lumbridge: a hub joined to Lumbridge's network lies within
 * a plannable walk of it. Zeah (a boat), Morytania (Priest in Peril's temple) and islands are not.
 */
function onFoot(place, source = null) {
  const { hubs } = source ? build(source) : (graph ??= build());
  const joined = connectedTo("lumbridge", source);
  for (const key of joined) {
    const hub = hubs.get(key);
    if (hub && hub.z === (place.z ?? 0) && chebyshev(hub, place) <= DIRECT_TILES) return true;
  }
  return false;
}

/** A hub by its key, or null. */
function hub(key, source = null) {
  const { hubs } = source ? build(source) : (graph ??= build());
  return hubs.get(key) ?? null;
}

module.exports = { nextLeg, hub, onFoot, connectedTo, build, DIRECT_TILES, AT_HUB_TILES };
