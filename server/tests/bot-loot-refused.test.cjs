// A drop next to the bot that the game will not give (bag full, a fence) used to come back as
// "walking" every turn, and a fighting bot chased it for minutes without picking a target
// (runtime analysis pakket 13, voorwerk 22-11-2026). Now it says "refused".
const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (/Navigation\.PlayerBots$/.test(request)) return { peekMovementRequest: () => null, requestMovement: () => true };
  return originalLoad.call(this, request, ...rest);
};
const Loot = require("../plugins/bots/brain/Loot.PlayerBots");

const loc = (x, y) => ({ getX: () => x, getY: () => y, getZ: () => 0 });

function world({ gives }) {
  const item = { getId: () => 526, getAmount: () => 1 };
  const ground = { getPosition: () => loc(3201, 3200), getItem: () => item };
  let carried = 0;
  const core = { ItemOnGroundManager: { exists: () => true, pickup: () => { if (gives) carried += 1; } } };
  const player = { getLocation: () => loc(3200, 3200), getInventory: () => ({ getAmount: () => carried }), getMovementQueue: () => ({ size: () => 0 }) };
  return { core, player, ground };
}

test("next to a drop the game gives: taken; one it will not give: refused, not walking", () => {
  Module._load = function (request, ...rest) {
    if (/Navigation\.PlayerBots$/.test(request)) return { peekMovementRequest: () => null, requestMovement: () => true };
    return originalLoad.call(this, request, ...rest);
  };
  try {
    const given = world({ gives: true });
    assert.equal(Loot.takeStep(given.core, given.player, given.ground, { nowMs: 0 }), "taken");
    const refused = world({ gives: false });
    assert.equal(Loot.takeStep(refused.core, refused.player, refused.ground, { nowMs: 0 }), "refused");
  } finally {
    Module._load = originalLoad;
  }
});
