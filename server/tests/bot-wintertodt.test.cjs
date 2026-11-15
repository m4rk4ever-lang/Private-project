// Run: node --test tests/bot-wintertodt.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createWintertodtAction, brazierStand } = require("../plugins/bots/brain/actions/Wintertodt.PlayerBots");

const ITEM = { BRUMA_ROOT: 1, BRUMA_KINDLING: 2, TINDERBOX: 3, HAMMER: 4, REJUVENATION_4: 10, REJUVENATION_3: 11, REJUVENATION_2: 12, REJUVENATION_1: 13 };
const BRAZIER = { BROKEN: 0, UNLIT: 1, LIT: 2 };

class Location {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  getX() { return this.x; } getY() { return this.y; } getZ() { return this.z; }
}

function setup({ active = true, brazier = BRAZIER.LIT, warmth = 100, hitpoints = 99 } = {}) {
  const calls = [];
  const items = new Map();
  const position = { x: 1630, y: 3980 };
  const player = {
    getLocation: () => new Location(position.x, position.y, 0),
    getMovementQueue: () => ({ size: () => 0 }),
    getHitpoints: () => hitpoints,
    getSkillManager: () => ({ getMaxLevel: () => 99 }),
    getInventory: () => ({
      contains: (id) => (items.get(id) ?? 0) > 0,
      getAmount: (id) => items.get(id) ?? 0,
      add: (item) => items.set(item.id, (items.get(item.id) ?? 0) + item.amount),
      isFull: () => [...items.values()].reduce((a, b) => a + b, 0) >= 28,
      getSlotForItemId: (id) => ((items.get(id) ?? 0) > 0 ? id : -1),
      refreshItems: () => {},
    }),
  };
  const corner = { corner: { brazier: { x: 1620, y: 3997 } }, brazier, pyromancerHealthy: true };
  const wt = {
    Shared: { ITEM, BRAZIER, POTIONS: [10, 11, 12, 13], CORNERS: [{}, {}, {}, {}], MAX_WARMTH: 100,
      OBJECT: { BRAZIER_UNLIT: 50, BRAZIER_BROKEN: 51, BRAZIER_LIT: 52 }, actionOf: () => null, stopAction: () => calls.push("stop") },
    Round: { isActive: () => active },
    Corners: { corner: () => corner },
    Braziers: { fix: () => calls.push("fix"), light: () => calls.push("light"), feed: () => calls.push("feed") },
    Supplies: { chop: () => { calls.push("chop"); items.set(ITEM.BRUMA_ROOT, (items.get(ITEM.BRUMA_ROOT) ?? 0) + 1); }, drink: () => { calls.push("drink"); warmth = 100; } },
    Warmth: { warmthOf: () => warmth },
  };
  const walks = [];
  const roots = { getLocation: () => new Location(1622, 4001, 0), getId: () => 99 };
  const world = {
    wintertodt: wt,
    random: () => 0,
    core: { Item: class { constructor(id, amount) { this.id = id; this.amount = amount; } }, Location, Skill: { HITPOINTS: "hp" } },
    objectSearch: { findCandidatesByIds: () => [roots] },
    requestMovement: (bot, x, y) => { walks.push({ x, y }); position.x = x; position.y = y; },
  };
  const action = createWintertodtAction({ rootIds: [99] }, world);
  const state = {};
  const step = (now = 0) => action.update({ player, state, nowMs: now });
  return { calls, items, walks, step, state, action, corner, setWarmth: (value) => { warmth = value; } };
}

test("a bot brings a tinderbox, hammer and potions, and waits by its brazier between rounds", () => {
  const { items, walks, step, calls } = setup({ active: false });
  step();
  assert.equal(items.get(ITEM.TINDERBOX), 1);
  assert.equal(items.get(ITEM.HAMMER), 1);
  assert.equal(items.get(ITEM.REJUVENATION_4), 2);
  assert.deepEqual(walks.at(-1), { x: brazierStand({ x: 1620, y: 3997 }).x, y: brazierStand({ x: 1620, y: 3997 }).y });
  assert.equal(calls.length, 0);
});

test("it fixes a broken brazier and lights an unlit one", () => {
  const broken = setup({ brazier: BRAZIER.BROKEN });
  broken.step(); broken.step();
  assert.ok(broken.calls.includes("fix"));
  const unlit = setup({ brazier: BRAZIER.UNLIT });
  unlit.step(); unlit.step();
  assert.ok(unlit.calls.includes("light"));
});

test("it chops a load of roots, then feeds them to its lit brazier", () => {
  const { calls, step, state } = setup();
  for (let i = 0; i < 40; i++) step(i);
  assert.ok(calls.filter((call) => call === "chop").length >= state.wintertodt.load - 1 || calls.includes("feed"));
  assert.ok(calls.includes("feed"), calls.join(","));
  assert.ok(calls.indexOf("chop") < calls.indexOf("feed"));
});

test("it drinks when cold, and steps back to safety when it cannot", () => {
  const cold = setup();
  cold.step();
  cold.setWarmth(20);
  cold.step();
  assert.ok(cold.calls.includes("drink"));
  const hurt = setup({ hitpoints: 10 });
  hurt.step(); hurt.step();
  assert.ok(!hurt.calls.includes("chop"));
  assert.ok(hurt.walks.every((tile) => tile.x === 1630 && tile.y === 3980), "it stays in the safe corridor");
});

test("stopping ends the plugin's action and forgets the corner", () => {
  const { action, step, state, calls } = setup();
  step();
  action.stop({ player: {}, state });
  assert.equal(state.wintertodt, null);
  assert.ok(calls.includes("stop"));
});
