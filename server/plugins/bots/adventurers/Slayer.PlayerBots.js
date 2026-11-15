"use strict";

/**
 * Slayer for adventurers, the way a player does it: walk to a slayer master, get a task
 * through the Slayer plugin ("slayer:assignment"), then fight only the monsters that count
 * for it ("slayer:on-task") until the task is done ("slayer:current-task" empty).
 *
 * Only places it can really fight: on the surface, outside the Wilderness, and no task whose
 * monsters need a finishing item (ice coolers, rock hammer) it does not carry.
 */

const finishers = require("../../skills/data/slayer-finishers.json");

// Masters with no combat requirement, on the surface (npc-spawns.json).
const MASTERS = [
  { name: "Turael", x: 2931, y: 3536, z: 0 },
  { name: "Spria", x: 3091, y: 3266, z: 0 },
];

// Monsters that need an item to finish them off: names, lower case.
const NEEDS_FINISHER = new Set((finishers.finishers ?? []).flatMap((entry) => entry.names ?? [])
  .map((name) => String(name).toLowerCase()));

const inWilderness = (spawn) => spawn.x >= 2940 && spawn.x <= 3400 && spawn.y >= 3520 && spawn.y <= 3970;
// Dungeons and caves sit far north on the map (y >= 6400) or on other floors.
const onSurface = (spawn) => (spawn.z ?? 0) === 0 && spawn.y < 6400;

/** The current task: { master, taskId, name, count, area } or null. */
function currentTask(emit, player) {
  const request = { player, task: null, points: 0 };
  emit("slayer:current-task", request);
  return request.task && request.task.count > 0 ? request.task : null;
}

/** Asks this master for a task. The task afterwards, or null (with the master's line). */
function askForTask(emit, player, master) {
  const request = { player, npcName: master.name, master: master.name, line: null };
  emit("slayer:assignment", request);
  return { task: currentTask(emit, player), line: request.line };
}

/**
 * Where its task's monsters are: [{ name, x, y, z }] from the spawn list, only spawns it can
 * fight at (surface, no Wilderness, no finishing item needed). `onTask(npcId, spawn)` asks
 * the Slayer plugin; it is asked once per NPC id.
 */
function taskTargets(spawns, onTask) {
  const counts = new Map();
  const out = [];
  for (const spawn of spawns) {
    if (!Number.isInteger(spawn?.id) || !onSurface(spawn) || inWilderness(spawn)) continue;
    let yes = counts.get(spawn.id);
    if (yes === undefined) {
      yes = onTask(spawn.id, spawn) === true && !NEEDS_FINISHER.has(String(spawn.name ?? "").toLowerCase());
      counts.set(spawn.id, yes);
    }
    if (yes) out.push({ name: spawn.name, x: spawn.x, y: spawn.y, z: spawn.z ?? 0 });
  }
  return out;
}

/** The nearest of these by `distance(place)`, or null. */
function nearest(places, distance) {
  let best = null;
  let bestAway = Infinity;
  for (const place of places) {
    const away = distance(place);
    if (away < bestAway) {
      best = place;
      bestAway = away;
    }
  }
  return best;
}

/** The monster names to fight around this spawn: every on-task name within `radius` tiles. */
function namesNear(targets, at, radius = 40) {
  return [...new Set(targets
    .filter((target) => target.z === at.z && Math.max(Math.abs(target.x - at.x), Math.abs(target.y - at.y)) <= radius)
    .map((target) => target.name))];
}

module.exports = { MASTERS, currentTask, askForTask, taskTargets, nearest, namesNear, NEEDS_FINISHER };
