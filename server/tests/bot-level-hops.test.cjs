"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { offSurface, chooseLevelHop, levelHopsFrom } = require("../plugins/bots/behaviours/navigation/LevelHops.PlayerBots");
const transports = require("../plugins/agent/data/transports.json");

const hops = levelHopsFrom(transports.transports.transports);
const tile = (x, y, z = 0) => ({ x, y, z });
// The Mole's lair (x 1728-1791, y 5120-5247): its own tiles walkable, the cave beside it not.
const inLair = (_from, at) => at.x >= 1728 && at.x <= 1791 && at.y >= 5120 && at.y <= 5247;

test("level hops: the Giant Mole's lair and a quest island count as off the surface", () => {
  assert.equal(offSurface(5216), true);
  assert.equal(offSurface(4802), true);
  assert.equal(offSurface(9776), true);
  assert.equal(offSurface(3487), false);
  // Wintertodt and the north of the map stay on the surface.
  assert.equal(offSurface(4000), false);
});

test("level hops: out of the Mole's lair by its rope, also to a goal far from where it lands", () => {
  const rope = chooseLevelHop(hops, tile(1758, 5216), tile(2821, 3486), () => 99, inLair);
  assert.equal(rope?.menu, "Climb Rope");
  assert.deepEqual(rope.from, tile(1752, 5137));
  // Toward the GE the Stronghold of Security's ladder is nearer, but in another cave.
  const toExchange = chooseLevelHop(hops, tile(1752, 5237), tile(3164, 3487), () => 99, inLair);
  assert.equal(toExchange?.menu, "Climb Rope");
});

test("level hops: no way out it can walk to gives none (a quest island left by boat)", () => {
  assert.equal(chooseLevelHop(hops, tile(1637, 4802), tile(2662, 3305), () => 99, () => false), null);
});

test("level hops: the way down still lands near the goal", () => {
  const down = chooseLevelHop(hops, tile(2965, 3380), tile(3045, 9780));
  assert.ok(down);
  assert.ok(Math.max(Math.abs(down.to.x - 3045), Math.abs(down.to.y - 9780)) <= 120);
});

test("quest notes: an item's count is said once", () => {
  const { countedName } = require("../plugins/bots/adventurers/QuestPlay.PlayerBots");
  assert.equal(countedName({ amount: 20, name: "20 x Balls of wool" }), "20 x Balls of wool");
  assert.equal(countedName({ amount: 1, name: "1 x Egg" }), "Egg");
  assert.equal(countedName({ amount: 3, name: "Logs" }), "3 x Logs");
});
