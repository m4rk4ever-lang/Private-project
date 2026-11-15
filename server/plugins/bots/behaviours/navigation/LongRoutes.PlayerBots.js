"use strict";

const { RegionManager } = require("../../../../src/main/typescript/elvarg/game/collision/RegionManager");
const { MapObjects } = require("../../../../src/main/typescript/elvarg/game/entity/impl/object/MapObjects");
const { RsmodRouteFinding } = require("../../../../src/main/typescript/elvarg/game/model/movement/path/RsmodRouteFinding");
const { planRoute } = require("./LongRoutePlanner.PlayerBots");
const TravelHubs = require("./TravelHubs.PlayerBots");

// Walks shorter than this are left to the route finder's own 128-tile window.
const LONG_ROUTE_MIN_TILES = 32;
// A bot this close to a cached route's waypoint joins that route there.
const REJOIN_TILES = 8;
// Reaching (or overtaking) a waypoint this closely moves on to the next.
const WAYPOINT_ARRIVE_TILES = 4;
const ROUTE_TTL_MS = 10 * 60 * 1000;
const MAX_ROUTES_PER_GOAL = 6;
const FAILED_TTL_MS = 5 * 60 * 1000;
// Planning CPU per game tick (600 ms window); over it, plans wait for the next tick.
// 25 ms starved bots picking a far site for minutes with 500 bots (plans are ~2% CPU).
const PLAN_BUDGET_MS = 60;

// Routes are shared by destination area (16x16): bots heading the same way, and a
// bot re-requesting the next leg, rejoin a cached route instead of re-planning.
const routesByGoal = new Map(); // goal key -> [{ waypoints, at }]
const failedUntil = new Map(); // "startKey>goalKey" -> until
const budget = { windowStart: 0, spentMs: 0 };
const routeFinder = new RsmodRouteFinding();

/** Can the bot walk to this tile from here (inside the route finder's window)? */
function walkable(here, point) {
  return routeFinder.findRoute({
    level: here.z, srcX: here.x, srcY: here.y, srcSize: 1, destX: point.x, destY: point.y,
    destWidth: 1, destLength: 1, locAngle: 0, locShape: -1, moveNear: false,
    blockAccessFlags: 0, maxWaypoints: 25, privateArea: null,
  }).success === true;
}

let isClosedDoor = null;
function doorCheck() {
  // Lazy: DoorOpening lives with the brain and is only needed once a plan runs.
  isClosedDoor ??= require("../../brain/DoorOpening.PlayerBots").isClosedDoor;
  return isClosedDoor;
}

let honestCheck = null;
/** "" for bots that pass toll gates; honest bots by whether they pay one (DoorOpening). */
function routeClass(player) {
  honestCheck ??= require("../../brain/Honest.PlayerBots").isHonest;
  if (!player || !honestCheck(player)) return "";
  const { paysToll } = require("../../brain/DoorOpening.PlayerBots");
  return paysToll(player, "Pay-toll(10gp)") ? ":honest-pays" : ":honest";
}

const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const areaKey = (x, y, z) => `${x >> 4},${y >> 4},${z}`;

function isDoorTile(player) {
  const closedDoor = doorCheck();
  return (x, y, z) => {
    for (const object of MapObjects.mapObjects.get(MapObjects.getHash(x, y, z)) ?? []) {
      const loc = object.getLocation?.();
      if (loc && loc.getX() === x && loc.getY() === y && loc.getZ() === z && closedDoor(object, player)) {
        return true;
      }
    }
    return false;
  };
}

// Expired plans and failures are swept now and then, so the caches stay bounded on a
// server left running overnight.
const SWEEP_MS = 60 * 1000;
let nextSweepAt = 0;
function sweep(nowMs) {
  if (nowMs < nextSweepAt) return;
  nextSweepAt = nowMs + SWEEP_MS;
  for (const [key, until] of failedUntil) if (until <= nowMs) failedUntil.delete(key);
  for (const [key, plans] of routesByGoal) {
    const live = plans.filter((plan) => nowMs - plan.at < ROUTE_TTL_MS);
    if (live.length) routesByGoal.set(key, live);
    else routesByGoal.delete(key);
  }
}

/** A route toward `goal` this player can follow from where it stands; undefined = try later. */
function routeFor(player, here, goal, nowMs, { fresh = false } = {}) {
  sweep(nowMs);
  // Honest bots do not pass a toll gate (DoorOpening): their routes are planned and shared
  // apart, or one would follow a route through the gate and stand in front of it.
  const goalKey = areaKey(goal.x, goal.y, goal.z) + routeClass(player);
  const plans = (routesByGoal.get(goalKey) ?? []).filter((plan) => nowMs - plan.at < ROUTE_TTL_MS);
  for (const plan of fresh ? [] : plans) {
    // Join at the furthest nearby waypoint actually walkable from here: a near one
    // across a fence would skip the gate.
    for (let index = plan.waypoints.length - 1; index >= 0; index -= 1) {
      const point = plan.waypoints[index];
      if (chebyshev(here, point) <= REJOIN_TILES && walkable(here, point)) {
        return { waypoints: plan.waypoints, index };
      }
    }
  }
  const failKey = `${areaKey(here.x, here.y, here.z)}>${goalKey}`;
  if ((failedUntil.get(failKey) ?? 0) > nowMs) {
    return null;
  }
  if (nowMs - budget.windowStart >= 600) {
    budget.windowStart = nowMs;
    budget.spentMs = 0;
  }
  if (budget.spentMs >= PLAN_BUDGET_MS) {
    return undefined;
  }
  const startedAt = Date.now();
  const plan = planRoute({
    from: here,
    to: goal,
    getFlag: (x, y, z) => RegionManager.getClipping(x, y, z, null),
    isDoor: isDoorTile(player),
  });
  budget.spentMs += Date.now() - startedAt;
  if (!plan || plan.waypoints.length === 0) {
    failedUntil.set(failKey, nowMs + FAILED_TTL_MS);
    return null;
  }
  plans.push({ waypoints: plan.waypoints, at: nowMs });
  routesByGoal.set(goalKey, plans.slice(-MAX_ROUTES_PER_GOAL));
  return { waypoints: plan.waypoints, index: 0 };
}

/**
 * The next waypoint of a planned route for a long walk, or null to walk straight
 * at the target (short walk, instance, PvP-only movement, no route, or the last
 * leg). Planned once per movement request and stored on it.
 */
function nextWaypoint(player, request, nowMs = Date.now()) {
  if (!player || !request || request.pvpOnly === true || player.getPrivateArea?.()) {
    return null;
  }
  const loc = player.getLocation();
  const here = { x: loc.getX(), y: loc.getY(), z: loc.getZ() };
  const goal = { x: request.x, y: request.y, z: Number.isFinite(request.z) ? request.z : here.z };
  // Long walks, or any walk a straight dispatch already failed to path (a short
  // hop that needs a long detour round a fence).
  const distance = chebyshev(here, goal);
  const straightFailed = Number(request.noPathAttempts ?? 0) > 0 && distance > WAYPOINT_ARRIVE_TILES;
  // A planned route is followed to its end, also close to the goal: let go near the goal, the
  // straight walk ran into the castle wall, a cached route walked it back out, and the bot went to
  // and fro between the two for minutes.
  const following = request.route && request.route.index < request.route.waypoints.length;
  if (goal.z !== here.z || (distance <= LONG_ROUTE_MIN_TILES && !straightFailed && !following)) {
    return null;
  }
  // The route is walked and the last stretch still has no straight path: plan afresh from here,
  // not by joining another bot's cached route (it may come from the other side).
  if (straightFailed && request.route && !following) {
    request.route = undefined;
    request.fresh = true;
  }
  // Too far to plan in one go: the walk goes hub to hub (TravelHubs), a planned leg at a time.
  // The hub it set out for stays the leg until it is reached: re-picked at every step, the leg
  // jumped from hub to hub as the bot moved, each time a new plan, until it walked into a hill.
  const held = request.legKey ? TravelHubs.hub(request.legKey) : null;
  const keep = held && chebyshev(here, goal) > TravelHubs.DIRECT_TILES
    && chebyshev(here, held) > TravelHubs.AT_HUB_TILES && !request.badHubs?.has?.(held.key);
  const leg = keep ? held : TravelHubs.nextLeg(here, goal, request.badHubs);
  if ((leg?.key ?? null) !== (request.legKey ?? null)) {
    request.legKey = leg?.key ?? null;
    request.route = undefined;
  }
  const target = leg ? { x: leg.x, y: leg.y, z: leg.z } : goal;
  if (request.route === undefined) {
    const route = routeFor(player, here, target, nowMs, { fresh: request.fresh === true });
    if (route === undefined) {
      return null; // planning budget spent this tick: straight-line now, plan next dispatch
    }
    request.route = route;
    if (!route && leg) {
      // No way to this hub from here (a river, a wall): another chain of hubs next dispatch.
      (request.badHubs ??= new Set()).add(leg.key);
      request.route = undefined;
      request.legKey = null;
      return null;
    }
  }
  const route = request.route;
  if (!route) {
    return null;
  }
  // Move past reached (or overtaken) waypoints, but never past an uncrossed door:
  // the tile beyond a gate counts only when the bot stands on it.
  for (let index = route.index; index < route.waypoints.length; index += 1) {
    const point = route.waypoints[index];
    const reached = chebyshev(here, point) <= (point.door ? 0 : WAYPOINT_ARRIVE_TILES);
    if (reached) {
      route.index = index + 1;
    } else if (point.door) {
      break;
    }
  }
  // The leg is walked: on to the hub itself, and from there the next leg is planned.
  return route.waypoints[route.index] ?? (leg ? target : null);
}

/**
 * The planner's verdict on walking to a far spot: true (a route exists, or it is
 * close enough for the route finder), false (no route from here, cached), or
 * undefined (not planned yet: this tick's planning budget is spent).
 */
function canReachSpot(player, goal, nowMs = Date.now()) {
  if (!player || player.getPrivateArea?.()) {
    return true;
  }
  const loc = player.getLocation();
  const here = { x: loc.getX(), y: loc.getY(), z: loc.getZ() };
  const spot = { x: goal.x, y: goal.y, z: Number.isFinite(goal.z) ? goal.z : here.z };
  if (spot.z !== here.z || chebyshev(here, spot) <= LONG_ROUTE_MIN_TILES) {
    return true;
  }
  const route = routeFor(player, here, spot, nowMs);
  return route === undefined ? undefined : route !== null;
}

module.exports = {
  canReachSpot,
  nextWaypoint,
  LONG_ROUTE_MIN_TILES,
};
