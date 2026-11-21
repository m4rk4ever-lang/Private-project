/**
 * Ways between the surface and what lies off it (the underground, closed areas such as the Giant
 * Mole's lair), from Shortest Path's transport rows (plugins/agent/data/transports.json), and the
 * choice of one for a walk. Pure: the adventurers' walkTo clicks the one chosen.
 */
const { planRoute } = require("./LongRoutePlanner.PlayerBots");

/**
 * From this y the map is off the surface: the underground above, and the closed areas between
 * (the Giant Mole's lair at y 5100-5250, a quest island at 4800, the museum basement). None of
 * them joins the surface on foot: a rope, ladder or stairs leads out. Four bots stood 20 minutes in
 * the Mole's lair after their fight, every walk out "blocked", because only y 6400 and up counted
 * as under the ground and the lair's rope out was never looked for (21-11-2026).
 */
const OFF_SURFACE_Y = 4160;
/** Whether y lies off the surface (under the ground or in a closed area): out only by its rope, ladder or stairs. */
const offSurface = (y) => y >= OFF_SURFACE_Y;
/** On the way out, a rope, ladder or stairs this near (the same cave or lair), not one in another dungeon. */
const OUT_HOP_TILES = 200;
/** Ways out looked at for a walkable one, nearest first. */
const OUT_HOP_LOOKS = 4;

/**
 * The best way down or up (LEVEL_HOPS) from `here` to `to` on the other side of the surface, or
 * null. `levelOf(skill)` gives its level for a hop's skill need; `reachable(here, tile)` (optional)
 * says whether a way out can be walked to from here. Several caves lie close together off the
 * surface (the Mole's lair beside the Stronghold of Security): the nearest exit by distance alone
 * was a ladder in the other cave.
 */
function chooseLevelHop(hops, here, to, levelOf = () => 99, reachable = null) {
  const goingDown = offSurface(to.y);
  const away = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const options = [];
  for (const hop of hops) {
    if (offSurface(hop.to.y) !== goingDown || hop.from.z !== here.z || hop.to.z !== (to.z ?? 0)) continue;
    if (hop.needs.some(({ level, skill }) => levelOf(skill) < level)) continue;
    // Down: the landing near the goal (the same mine or dungeon), the way in not too far off.
    // Out: a way up in the same cave, its landing weighed (the Mole's one rope lands in Falador,
    // far from most goals, and is still the way out).
    const landing = away(hop.to, to);
    if (goingDown ? landing > 120 : away(here, hop.from) > OUT_HOP_TILES) continue;
    options.push({ hop, cost: away(hop.from, here) + 3 * landing });
  }
  options.sort((a, b) => a.cost - b.cost);
  if (goingDown || !reachable) return options[0]?.hop ?? null;
  // Out: the first one it can walk to, a few looked at at most (each look is a route search).
  // One ladder stands in the table once per tile beside it: a ladder it cannot reach is passed
  // over as a whole, so the looks go to other ways out.
  const unreachable = [];
  let looks = 0;
  for (const { hop } of options) {
    if (unreachable.some((spot) => away(spot, hop.from) <= 3)) continue;
    if (looks >= OUT_HOP_LOOKS) break;
    looks += 1;
    if (reachable(here, hop.from)) return hop;
    unreachable.push(hop.from);
  }
  return null;
}

/**
 * Whether `tile` can be walked to from `from` on its floor, for a way out. `getFlag(x, y, z)` gives
 * the game's collision flags (core.RegionManager.getClipping). An error counts as reachable.
 */
// Each answer is a route search (up to 20,000 tiles): kept for a while per 8x8 area of the start
// and the exit's tile, so a cave's bots do not search again on every walk (tick time, 21-11-2026).
const REACH_CACHE_MS = 10 * 60_000;
const reachCache = new Map();
function reachableOnFoot(from, tile, getFlag, nowMs = Date.now()) {
  const key = `${from.x >> 3},${from.y >> 3},${from.z ?? 0}>${tile.x},${tile.y}`;
  const known = reachCache.get(key);
  if (known && nowMs - known.at < REACH_CACHE_MS) return known.ok;
  let ok = true;
  try {
    ok = planRoute({ from, to: { x: tile.x, y: tile.y }, getFlag, exactOnly: true, maxExpansions: 20_000 }) !== null;
  } catch {
    ok = true;
  }
  if (reachCache.size > 2_000) reachCache.clear();
  reachCache.set(key, { ok, at: nowMs });
  return ok;
}

/** Ways between the surface and what lies off it, from Shortest Path's transport rows (see LEVEL_HOPS). */
function levelHopsFrom(rows) {
  const hops = [];
  for (const [from, to, menu, id, skills, items, quests, varbits, varps] of rows ?? []) {
    if (!Array.isArray(from) || !Array.isArray(to) || items || quests || varbits || varps) continue;
    if (offSurface(from[1]) === offSurface(to[1])) continue;
    // "Climb Rope": the way out of the Giant Mole's lair.
    if (!/^(climb-(down|up)|climb|enter|leave|exit|go-down|go-up|walk-down|walk-up)\b/i.test(String(menu ?? ""))) continue;
    const needs = [...String(skills ?? "").matchAll(/(\d+)\s+([A-Za-z]+)/g)].map(([, level, skill]) => ({ level: Number(level), skill: skill.toUpperCase() }));
    hops.push({ from: { x: from[0], y: from[1], z: from[2] }, to: { x: to[0], y: to[1], z: to[2] }, menu: String(menu), id, needs });
  }
  return hops;
}

module.exports = { OFF_SURFACE_Y, OUT_HOP_TILES, offSurface, chooseLevelHop, levelHopsFrom, reachableOnFoot };
