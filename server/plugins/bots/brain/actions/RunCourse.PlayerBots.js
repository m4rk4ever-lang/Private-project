"use strict";

/**
 * Runs an agility course, obstacle after obstacle, as a player does: the next obstacle of the lap
 * (the Agility plugin's own lap progress says which), clicked through the object's interaction,
 * so the success rolls, falls, XP and marks of grace are the game's. A mark of grace that lands
 * near it is picked up. After a fall it starts the lap again from the first obstacle.
 *
 * JSON: { "type": "runCourse", "course": "draynor", "start": { "x": 3103, "y": 3279, "z": 0 } }
 */
const { playerState } = require("../ActionState.PlayerBots");

const PROGRESS_ATTRIBUTE = "agility.progress";
/** How far around it looks for the next obstacle. */
const SEARCH_REGIONS = 1;
const CLICK_COOLDOWN_MS = 2400;
/** No progress on an obstacle this long: back to the start of the lap. */
const STUCK_MS = 45_000;

function navigation() {
  return require("../../behaviours/navigation/Navigation.PlayerBots");
}

function createRunCourseAction(spec, world) {
  const course = require("../../../skills/agility/courses/Courses.Agility").COURSES.find((entry) => entry.key === spec.course);
  if (!course) throw new Error(`[bot activities] unknown agility course '${spec.course}'`);
  const obstacles = [...course.obstacles].sort((a, b) => a.index - b.index);
  const start = spec.start ?? null;
  const stateFor = (player) => playerState(action, player, () => ({ clickAt: 0, index: null, since: 0 }));

  function nextIndex(player) {
    const progress = player.getAttribute?.(PROGRESS_ATTRIBUTE);
    if (!progress || progress.course !== course.key) return 1;
    return progress.index >= obstacles[obstacles.length - 1].index ? 1 : progress.index + 1;
  }

  function nearestObject(player, obstacle) {
    const ids = (Array.isArray(obstacle.object) ? obstacle.object : [obstacle.object]).filter(Number.isInteger);
    const here = player.getLocation();
    let found = world.objectSearch?.findCandidatesByIds?.(player, ids, { regionRadius: SEARCH_REGIONS, z: here.getZ() }) ?? [];
    // Up on a roof the bots' object index can come up empty: the map itself, 12 tiles round, on
    // its own floor (Al Kharid's tropical tree right beside a bot left on the roof).
    if (found.length === 0 && here.getZ() > 0) {
      const MapObjects = world.core?.MapObjects;
      const wanted = new Set(ids);
      found = [];
      for (let dx = -12; dx <= 12; dx += 1) {
        for (let dy = -12; dy <= 12; dy += 1) {
          for (const object of MapObjects?.mapObjects?.get?.(MapObjects.getHash(here.getX() + dx, here.getY() + dy, here.getZ())) ?? []) {
            const at = object.getLocation();
            if (wanted.has(object.getId()) && at.getX() === here.getX() + dx && at.getY() === here.getY() + dy) found.push(object);
          }
        }
      }
    }
    let best = null;
    let bestDistance = Infinity;
    for (const object of found) {
      const at = object.getLocation();
      if (at.getZ() !== here.getZ()) continue;
      if (obstacle.at && (at.getX() !== obstacle.at[0] || at.getY() !== obstacle.at[1])) continue;
      const distance = Math.max(Math.abs(at.getX() - here.getX()), Math.abs(at.getY() - here.getY()));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = object;
      }
    }
    return best;
  }

  /** A mark of grace of its own nearby: picked up first (Loot.PlayerBots.js does the walking). */
  function markNearby(player) {
    const Loot = require("../Loot.PlayerBots");
    const mark = world.core?.ItemIdentifiers?.MARK_OF_GRACE;
    const ground = Loot.lootNear(world.core, player, { radius: 6, valueOf: (id) => (id === mark ? Infinity : 0) });
    return ground && ground.getItem().getId() === mark ? ground : null;
  }

  const action = {
    id: "runCourse",
    update(ctx) {
      const { player, nowMs } = ctx;
      const bot = stateFor(player);
      if (player.getForceMovement?.() != null || player.busy?.() || player.getMovementQueue?.()?.size?.() > 0) return "running";
      if (navigation().peekMovementRequest(player)) return "running";
      const mark = markNearby(player);
      if (mark) {
        require("../Loot.PlayerBots").takeStep(world.core, player, mark, { state: ctx.state, nowMs });
        return "running";
      }
      if (nowMs < bot.clickAt) return "running";
      // Up on a roof with no lap in progress (a restart, a lap broken off), standing where an
      // obstacle starts (Al Kharid's tropical tree): the lap goes on from there, as the game takes
      // it, not back to an obstacle on the ground it cannot see from up here.
      if (player.getLocation().getZ() > 0 && !player.getAttribute?.(PROGRESS_ATTRIBUTE)) {
        const here = player.getLocation();
        const from = obstacles.find((entry) => entry.index > 1 && Array.isArray(entry.route) && (entry.route[2] ?? 0) === here.getZ()
          && Math.max(Math.abs(entry.route[0] - here.getX()), Math.abs(entry.route[1] - here.getY())) <= 2);
        if (from) player.setAttribute?.(PROGRESS_ATTRIBUTE, { course: course.key, index: from.index - 1 });
      }
      const index = nextIndex(player);
      if (index !== bot.index) {
        bot.index = index;
        bot.since = nowMs;
      } else if (nowMs - bot.since > STUCK_MS) {
        // Stuck on one obstacle (or fell off the roof): back to the start of the lap.
        player.setAttribute?.(PROGRESS_ATTRIBUTE, null);
        bot.index = null;
        bot.since = nowMs;
        if (start) navigation().requestMovement(player, start.x, start.y, { nowMs, z: start.z ?? 0, reason: "brain_agility", state: ctx.state });
        return "running";
      }
      const obstacle = obstacles.find((entry) => entry.index === index) ?? obstacles[0];
      let object = nearestObject(player, obstacle);
      // Up on the roof without its lap's progress (a restart, a lap broken off): the nearest
      // obstacle on its own floor, and on from there, as a player stranded up there goes on.
      if (!object && player.getLocation().getZ() > 0) {
        const here = player.getLocation();
        let best = Infinity;
        for (const other of obstacles) {
          const found = nearestObject(player, other);
          if (!found) continue;
          const away = Math.max(Math.abs(found.getLocation().getX() - here.getX()), Math.abs(found.getLocation().getY() - here.getY()));
          if (away < best) {
            best = away;
            object = found;
          }
        }
      }
      if (!object) {
        // Not in sight: the first obstacle is near the start; a later one means it fell.
        if (index !== 1) player.setAttribute?.(PROGRESS_ATTRIBUTE, null);
        if (start) navigation().requestMovement(player, start.x, start.y, { nowMs, z: start.z ?? 0, reason: "brain_agility", state: ctx.state });
        bot.clickAt = nowMs + CLICK_COOLDOWN_MS;
        return "running";
      }
      const at = object.getLocation();
      bot.clickAt = nowMs + CLICK_COOLDOWN_MS;
      player.getMovementQueue().walkToObject(object, {
        execute: () => world.emitObjectInteraction?.({
          player, object, objectId: object.getId(), clickType: 1,
          location: { x: at.getX(), y: at.getY(), z: at.getZ() },
          sourceLocation: { x: player.getLocation().getX(), y: player.getLocation().getY(), z: player.getLocation().getZ() },
          handled: false,
        }),
      });
      return "running";
    },
    stop(ctx) {
      const bot = stateFor(ctx.player);
      bot.index = null;
      bot.clickAt = 0;
    },
    describe(ctx) {
      return `runCourse ${course.key} obstacle=${stateFor(ctx.player).index}`;
    },
  };
  return action;
}

module.exports = { createRunCourseAction };
