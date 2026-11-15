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

test("a bank stander stands by one of the nearest booths, not on it", () => {
  const player = bot({ fletching: 50 });
  const booth = { getLocation: () => ({ getX: () => 3170, getY: () => 3490 }) };
  const walks = [];
  const action = createBankStandAction({}, {
    core, random: Math.random, bankBoothIds: new Set([1]),
    objectSearch: { findCandidatesByIds: () => [booth] },
    requestMovement: (p, x, y) => walks.push({ x, y }),
  });
  for (let i = 0; i < 20; i++) {
    const state = { home: { x: 3164, y: 3486, z: 0 } };
    action.update({ player, state, nowMs: 0 });
  }
  assert.equal(walks.length, 20);
  for (const spot of walks) {
    assert.ok(Math.abs(spot.x - 3170) <= 2 && Math.abs(spot.y - 3490) <= 2, JSON.stringify(spot));
    assert.ok(!(spot.x === 3170 && spot.y === 3490));
  }
});

test("an honest bank stander works through its own bank: knife and logs out, bows made, bows back in", () => {
  const BankCraft = require("../plugins/bots/brain/BankCraft.PlayerBots");
  const KNIFE = 946, LOGS = 1511, OAK = 1521, BOW = 841;
  const store = (entries) => {
    const map = new Map(entries);
    return {
      map,
      getAmount: (id) => map.get(id) ?? 0,
      add: (item) => map.set(item.getId(), (map.get(item.getId()) ?? 0) + item.getAmount()),
      deleteNumber: (id, amount) => map.set(id, (map.get(id) ?? 0) - amount),
      getItems: () => [...map].filter(([, amount]) => amount > 0).map(([id, amount]) => ({ getId: () => id, getAmount: () => amount })),
      getFreeSlots: () => 28 - [...map.values()].filter((amount) => amount > 0).length,
      refreshItems() {},
    };
  };
  const bank = store([[KNIFE, 1], [LOGS, 500], [OAK, 100]]);
  const bag = store([[995, 10]]);
  const player = {
    getBanks: () => [bank], getBank: () => bank, getInventory: () => bag,
    getSkillManager: () => ({ getMaxLevel: (skill) => (skill === "FLETCHING" ? 10 : 1) }),
  };
  const core = {
    Skill: { FLETCHING: "FLETCHING", CRAFTING: "CRAFTING", HERBLORE: "HERBLORE" },
    ItemIdentifiers: { COINS: 995, KNIFE, LOGS, OAK_LOGS: OAK, CHISEL: 1755, UNCUT_OPAL: 1625 },
    Item: class { constructor(id, amount) { this.id = id; this.amount = amount; } getId() { return this.id; } getAmount() { return this.amount; } },
    Bank: { getTabForItem: () => 0 },
  };
  const jobs = BankCraft.jobsFor(player, core);
  assert.equal(jobs.length, 1, "fletching only: no chisel, no gems");
  assert.deepEqual(jobs[0].materials, [LOGS], "oak needs Fletching 15+... the best tier its level allows is plain logs");
  BankCraft.withdrawJob(player, core, jobs[0]);
  assert.equal(bag.getAmount(KNIFE), 1);
  assert.ok(bag.getAmount(LOGS) > 20);
  bag.map.set(LOGS, 0);
  bag.map.set(BOW, 27);
  BankCraft.depositAll(player, core, [KNIFE]);
  assert.equal(bank.getAmount(BOW), 27, "the products go in the bank");
  assert.equal(bag.getAmount(KNIFE), 1, "the knife stays at hand");
  assert.equal(bag.getAmount(995), 10, "and its coins");
});
