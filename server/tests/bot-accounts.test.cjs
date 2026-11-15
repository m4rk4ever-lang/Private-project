// Run: node --test tests/bot-accounts.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { generateAccount } = require("../plugins/bots/brain/Accounts.PlayerBots");
const { createUpkeep } = require("../plugins/bots/brain/Upkeep.PlayerBots");

/** Errands that arrive at once (the walking itself is the brain's navigation). */
function instantErrands() {
  const going = new Map();
  return {
    going,
    go: (entry, to, { arrive }) => { going.set(entry.player, { entry, to, arrive }); if (entry.brain) entry.brain.paused = true; return true; },
    busy: (player) => going.has(player),
    arriveAll: () => { for (const [player, errand] of [...going]) { going.delete(player); if (errand.entry.brain) errand.entry.brain.paused = false; errand.arrive(player); } },
  };
}

const IDS = { COINS: 995, BRONZE_AXE: 1351, IRON_AXE: 1349, STEEL_AXE: 1353, MITHRIL_AXE: 1355, ADAMANT_AXE: 1357, RUNE_AXE: 1359, DRAGON_AXE: 6739,
  BRONZE_PICKAXE: 1265, IRON_PICKAXE: 1267, STEEL_PICKAXE: 1269, MITHRIL_PICKAXE: 1273, ADAMANT_PICKAXE: 1271, RUNE_PICKAXE: 1275, DRAGON_PICKAXE: 11920,
  TINDERBOX: 590, SMALL_FISHING_NET: 303, FLY_FISHING_ROD: 309, FEATHER: 314, LOBSTER_POT: 301, HARPOON: 311, YEW_LOGS: 1515, LOGS: 1511, MAGIC_LOGS: 1513,
  MAPLE_LOGS: 1517, WILLOW_LOGS: 1519, OAK_LOGS: 1521, TROUT: 333, SHRIMPS: 315, LOBSTER: 379, TUNA: 361, SHARK: 385 };

function container() {
  const items = [];
  return {
    items,
    add: (item) => items.push(item),
    getItems: () => items,
    getAmount: (id) => items.filter((i) => i.getId() === id).reduce((s, i) => s + i.getAmount(), 0),
    contains: (id) => items.some((i) => i.getId() === id),
    getFreeSlots: () => 28 - items.length,
  };
}

function bot(levels) {
  const inventory = container();
  const bank = container();
  return {
    inventory, bank,
    getInventory: () => inventory,
    getBank: () => bank,
    getEquipment: () => ({ getItems: () => [] }),
    getSkillManager: () => ({ getMaxLevel: (skill) => levels[skill] ?? 1, getTotalLevel: () => 700 }),
  };
}

const core = {
  ItemIdentifiers: IDS,
  Skill: new Proxy({}, { get: (_, name) => name }),
  Item: class { constructor(id, amount) { this.id = id; this.amount = amount; } getId() { return this.id; } getAmount() { return this.amount; } },
};

test("a generated account owns tools for its levels, coins (mostly banked) and some produce, and turns honest", () => {
  const b = bot({ WOODCUTTING: 61, MINING: 41, FISHING: 1 });
  const state = {};
  const got = generateAccount(b, state, { core, mode: "woodcutting", random: () => 0.5 });
  assert.equal(state.honest, true);
  assert.ok(b.inventory.contains(IDS.RUNE_AXE), "rune axe at 61 Woodcutting");
  assert.ok(b.inventory.contains(IDS.RUNE_PICKAXE), "rune pickaxe at 41 Mining");
  assert.ok(b.inventory.getAmount(995) > 0 && b.bank.getAmount(995) > b.inventory.getAmount(995));
  assert.equal(got.coins, b.inventory.getAmount(995) + b.bank.getAmount(995));
  assert.ok(b.bank.contains(IDS.YEW_LOGS), "yew logs at 61 Woodcutting");
});

test("a fighter gets its gear and food from the combat kit once, before turning honest", () => {
  const b = bot({ ATTACK: 40 });
  const state = {};
  let equipped = 0;
  generateAccount(b, state, { core, mode: "combat_training", random: () => 0.1, equipCombatGear: (player, s) => { equipped += 1; assert.equal(s.honest, undefined); } });
  assert.equal(equipped, 1);
  assert.equal(state.honest, true);
});

test("upkeep sends a hurt fighter without food to the exchange, and leaves adventurers alone", () => {
  const events = [];
  const fighter = bot({ HITPOINTS: 50 });
  fighter.getLocation = () => ({ getX: () => 3200, getY: () => 3200, getZ: () => 0 });
  fighter.moveTo = (to) => events.push(["moved", to]);
  fighter.getUsername = () => "fighter";
  fighter.getHitpoints = () => 50;
  fighter.getCombat = () => ({ getAttacker: () => null });
  fighter.inventory.add(new core.Item(995, 500));
  const brain = { paused: false, currentRoot: () => ({ mode: "combat_training" }) };
  const adventurer = { ...bot({}), getUsername: () => "Eeshwar" };
  const runtime = { entriesByUsername: new Map([["fighter", { player: fighter, state: { honest: true }, brain }],
    ["Eeshwar", { player: adventurer, state: { honest: true, adventurer: true }, brain: { currentRoot: () => ({ mode: "combat_training" }) } }]]) };
  const emitted = [];
  const emit = (name, payload) => {
    emitted.push(name);
    if (name === "ge:place-offer") payload.placed = true;
    if (name === "ge:collect") payload.finished = 0;
  };
  let clock = 0;
  const errands = instantErrands();
  const upkeep = createUpkeep({ errands, core: { ...core, Location: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }, ItemDefinition: { forId: () => ({ getGrandExchangeValue: () => 100, isTradeable: () => true, unNote: () => 1 }) },
    CacheDefinitions: { hasItem: () => true, getItem: () => ({}) } }, runtime, emit, isFood: (id) => [333, 315, 379, 361, 385].includes(id), now: () => clock });
  upkeep.check(clock);
  assert.equal(errands.going.size, 1, "only the world bot goes");
  assert.equal(brain.paused, true, "its brain waits while it walks");
  errands.arriveAll();
  assert.ok(emitted.includes("ge:place-offer"), "it buys food");
  assert.equal(errands.going.size, 0);
  assert.equal(brain.paused, false, "and goes back to work");
});

test("a bot that changes jobs sells the last job's things first", () => {
  const miner = bot({});
  miner.getLocation = () => ({ getX: () => 3200, getY: () => 3200, getZ: () => 0 });
  miner.moveTo = () => {};
  miner.getUsername = () => "miner";
  miner.getHitpoints = () => 10;
  miner.getCombat = () => ({ getAttacker: () => null });
  miner.inventory.add(new core.Item(440, 5));
  miner.inventory.add(new core.Item(IDS.BRONZE_PICKAXE, 1));
  miner.inventory.add(new core.Item(IDS.BRONZE_AXE, 1));
  let mode = "mining";
  const brain = { paused: false, currentRoot: () => ({ mode }) };
  const runtime = { entriesByUsername: new Map([["miner", { player: miner, state: { honest: true }, brain }]]) };
  const emit = (name, payload) => { if (name === "ge:collect") payload.finished = 0; if (name === "ge:place-offer") payload.placed = true; };
  const errands = instantErrands();
  const upkeep = createUpkeep({ errands, core: { ...core, Location: class {}, ItemDefinition: { forId: () => ({ getGrandExchangeValue: () => 10, isTradeable: () => true, unNote: () => 1 }) },
    CacheDefinitions: { hasItem: () => true, getItem: () => ({}) } }, runtime, emit, isFood: () => false, now: () => 0 });
  upkeep.check(0);
  assert.equal(errands.going.size, 0, "five ores in a half-empty bag: it keeps mining");
  mode = "woodcutting";
  upkeep.check(0);
  assert.equal(errands.going.size, 1, "new job: the ores go first");
});

test("outfits skip honest bots", () => {
  const { markHonest, isHonest } = require("../plugins/bots/brain/Honest.PlayerBots");
  const player = {};
  assert.equal(isHonest(player), false);
  markHonest(player);
  assert.equal(isHonest(player), true);
  const src = require("node:fs").readFileSync(require.resolve("../plugins/bots/brain/SiteSpawner.PlayerBots.js"), "utf8");
  assert.match(src, /function applyOutfit[\s\S]{0,200}isHonest\(bot\)/);
  assert.match(src, /function wearItems[\s\S]{0,200}isHonest\(bot\)/);
});
