"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { walkTablets } = require("../plugins/bots/adventurers/Loadout.PlayerBots");

const landings = [
  { name: "VARROCK_TELEPORT", x: 3212, y: 3424 },
  { name: "ARDOUGNE_TELEPORT", x: 2661, y: 3300 },
  { name: "WATCHTOWER_TELEPORT", x: 2549, y: 3112 },
];
const feldip = [{ from: { x: 3164, y: 3487 }, to: { x: 2609, y: 2896 } }, { from: { x: 3222, y: 3218 }, to: { x: 2502, y: 2890 } }];

test("walk tablets: the tablet that saves most of its long walks, by the stack", () => {
  // Two walks to the Feldip Hills: Watchtower lands nearest (Ardougne saves them too, less).
  const buy = walkTablets(feldip, landings, { coins: 20_000, priceOf: (name) => (name === "WATCHTOWER_TELEPORT" ? 400 : 540) });
  assert.deepEqual(buy, [{ name: "WATCHTOWER_TELEPORT", amount: 5, walks: 2 }]);
});

test("walk tablets: not for one walk, not when it has two, not past its share of coins", () => {
  assert.deepEqual(walkTablets(feldip.slice(0, 1), landings, { coins: 20_000, priceOf: () => 400 }), []);
  assert.deepEqual(walkTablets(feldip, landings, { coins: 20_000, priceOf: () => 400, held: () => 2 }), []);
  assert.deepEqual(walkTablets(feldip, landings, { coins: 4_000, priceOf: () => 400 }), []);
  assert.deepEqual(walkTablets(feldip, landings, { coins: 10_000, priceOf: () => 400 }), []);
});
