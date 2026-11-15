// Run: node --test tests/bot-bankstand.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createBankStandAction, chooseCraft, DEFAULT_CRAFTS } = require("../plugins/bots/brain/actions/BankStand.PlayerBots");

const core = {
  Skill: { FLETCHING: "fletching", HERBLORE: "herblore", CRAFTING: "crafting" },
  CacheDefinitions: { getSeqId: (name) => ({ human_fletching: 1248, human_herbing_vial: 363 })[name] ?? 885 },
  Animation: class { constructor(id) { this.id = id; } },
};

function bot(levels) {
  const animations = [];
  return {
    animations,
    getSkillManager: () => ({ getMaxLevel: (skill) => levels[skill] ?? 1 }),
    getLocation: () => ({ getX: () => 3164, getY: () => 3486, getZ: () => 0 }),
    getMovementQueue: () => ({ size: () => 0 }),
    performAnimation: (animation) => animations.push(animation.id),
  };
}

test("a bot works on the bank skill it is best at, mostly", () => {
  const fletcher = bot({ fletching: 99, herblore: 1, crafting: 1 });
  let fletching = 0;
  for (let i = 0; i < 100; i++) if (chooseCraft(fletcher, DEFAULT_CRAFTS, core, () => i / 100).skill === "FLETCHING") fletching++;
  assert.ok(fletching >= 95, String(fletching));
});

test("bank standing plays the craft's animation again and again, with pauses", () => {
  const player = bot({ herblore: 99 });
  const action = createBankStandAction({ crafts: [{ skill: "HERBLORE", animation: "human_herbing_vial" }] }, { core, random: () => 0.5, requestMovement: () => true });
  const state = { home: { x: 3164, y: 3486, z: 0 } };
  let now = 0;
  assert.equal(action.update({ player, state, nowMs: now }), "running");
  for (let i = 0; i < 40; i++) {
    now += 1800;
    assert.equal(action.update({ player, state, nowMs: now }), "running");
  }
  assert.ok(player.animations.length >= 20 && player.animations.length < 40, String(player.animations.length));
  assert.ok(player.animations.every((id) => id === 363));
  assert.ok(Math.abs(state.bankStand.spot.x - 3164) <= 4);
  action.stop({ state });
  assert.equal(state.bankStand, null);
});

test("a trader stands still and only now and then moves to another spot", () => {
  const player = bot({});
  const walks = [];
  const action = createBankStandAction({ trade: true, radius: 6 }, { core, random: () => 0.5, requestMovement: (p, x, y) => walks.push({ x, y }) });
  const state = { home: { x: 3164, y: 3486, z: 0 } };
  let now = 0;
  for (let i = 0; i < 100; i++) {
    action.update({ player, state, nowMs: now });
    now += 1800;
  }
  // 180 seconds: the first spot, then one or two moves; never an animation.
  assert.ok(walks.length >= 2 && walks.length <= 4, String(walks.length));
  assert.equal(player.animations.length, 0);
});
