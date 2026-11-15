"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Slayer = require("../plugins/bots/adventurers/Slayer.PlayerBots");

test("task targets: only on-task spawns on the surface, outside the Wilderness, no finishing item", () => {
  const spawns = [
    { id: 1, name: "Cow", x: 3255, y: 3270, z: 0 },
    { id: 1, name: "Cow", x: 3256, y: 3271, z: 0 },
    { id: 2, name: "Goblin", x: 3250, y: 3240, z: 0 },
    { id: 1, name: "Cow", x: 3100, y: 3600, z: 0 },      // Wilderness
    { id: 1, name: "Cow", x: 3100, y: 9800, z: 0 },      // dungeon
    { id: 3, name: "Lizard", x: 3400, y: 3050, z: 0 },   // needs an ice cooler
  ];
  const asked = [];
  const targets = Slayer.taskTargets(spawns, (id) => { asked.push(id); return id === 1 || id === 3; });
  assert.deepEqual(targets.map((t) => `${t.name}@${t.x}`), ["Cow@3255", "Cow@3256"]);
  assert.deepEqual(asked, [1, 2, 3]);
  const spot = Slayer.nearest(targets, (p) => Math.abs(p.x - 3260));
  assert.equal(spot.x, 3256);
  assert.deepEqual(Slayer.namesNear(targets, spot), ["Cow"]);
});

test("a task comes from the master through the Slayer plugin's events", () => {
  let task = null;
  const emit = (name, request) => {
    if (name === "slayer:assignment" && request.npcName === "Turael") task = { name: "Cows", count: 15 };
    if (name === "slayer:current-task") request.task = task;
  };
  assert.equal(Slayer.currentTask(emit, {}), null);
  const { task: got } = Slayer.askForTask(emit, {}, Slayer.MASTERS[0]);
  assert.equal(got.count, 15);
});
