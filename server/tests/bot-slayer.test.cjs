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

test("an adventurer asks the best Slayer master its levels allow and it can walk to", () => {
  const Slayer = require("../plugins/bots/adventurers/Slayer.PlayerBots");
  const Hubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
  const walkable = (questsDone) => (place) => Hubs.onFoot(place, null, () => questsDone);
  assert.deepEqual(Slayer.mastersFor({ combat: 3, slayer: 1 }, walkable(false)).map((m) => m.name).sort(), ["Spria", "Turael"]);
  // Mazchna is in Canifis: across the Salve, only after Priest in Peril.
  assert.ok(!Slayer.mastersFor({ combat: 40, slayer: 1 }, walkable(false)).some((m) => m.name === "Mazchna"));
  // On foot not even then for now: Morytania is teleport-only until the walk in is checked in
  // game (travel-hubs.json "onFoot": false; 1 of 117 walks arrived, 20-11-2026).
  assert.ok(!Slayer.mastersFor({ combat: 40, slayer: 1 }, walkable(true)).some((m) => m.name === "Mazchna"));
  // With that flag gone, Priest in Peril opens it again.
  const data = JSON.parse(JSON.stringify(require("../plugins/bots/data/travel-hubs.json")));
  for (const locked of data.lockedAreas) delete locked.onFoot;
  const opened = (place) => Hubs.onFoot(place, data, () => true);
  assert.equal(Slayer.mastersFor({ combat: 40, slayer: 1 }, opened)[0].combat, 20);
  // Nieve (the Gnome Stronghold) from combat 85, but not on foot for now (0 of 16 walks there
  // arrived, 20-11-2026): Adventurers takes a Slayer ring's teleport instead. With the flag gone
  // it is the first; Vannaka (Edgeville Dungeon) is underground either way.
  assert.ok(!Slayer.mastersFor({ combat: 90, slayer: 1 }, walkable(false)).some((m) => m.name === "Nieve"));
  const high = Slayer.mastersFor({ combat: 90, slayer: 1 }, (place) => Hubs.onFoot(place, data, () => false));
  assert.equal(high[0].combat, 85);
  assert.ok(!high.some((m) => m.name === "Vannaka"));
});
