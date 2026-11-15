// Run: node --test tests/bot-adventurers.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { chooseNext, missing, bestActivity } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const definitions = require("../data/definitions/bot-activities.json");
const data = require("../plugins/bots/data/adventurers.json");

function adventurer(levels = {}, extra = {}) {
  return { levels: { WOODCUTTING: 1, MINING: 1, FISHING: 1, THIEVING: 1, FIREMAKING: 1, ...levels }, combat: 3, questPoints: 0, done: new Set(), ...extra };
}

test("the quest path names real requirements, five adventurers with valid names", () => {
  assert.equal(data.names.length, 5);
  for (const name of data.names) assert.match(name, /^[A-Za-z0-9 ]{1,12}$/, name);
  const names = new Set(data.quests.map((quest) => quest.name));
  for (const quest of data.quests) {
    for (const skill of Object.keys(quest.skills ?? {})) assert.match(skill, /^[A-Z]+$/, quest.name);
    for (const needed of quest.quests ?? []) assert.ok(names.has(needed), `${quest.name} needs ${needed}`);
  }
});

test("a new adventurer starts with a ready quest when it rolls one, else trains its lowest skills", () => {
  const quest = chooseNext(adventurer(), data.quests, { random: () => 0 });
  assert.equal(quest.kind, "quest");
  assert.equal(quest.quest.name, data.quests[0].name);
  const train = chooseNext(adventurer({}, { done: new Set(data.quests.filter((q) => !q.skills && !q.combat && !q.quests && !q.questPoints).map((q) => q.name)) }), data.quests, { random: () => 0.99 });
  assert.equal(train.kind, "train");
});

test("it trains what the next quest still needs", () => {
  const knight = data.quests.find((quest) => quest.name === "The Knight's Sword");
  const before = data.quests.slice(0, data.quests.indexOf(knight));
  const a = adventurer({}, { done: new Set(before.map((quest) => quest.name)) });
  assert.deepEqual(missing(knight, a).skills, { MINING: 10 });
  const plan = chooseNext(a, data.quests, { random: () => 0.99 });
  assert.equal(plan.kind, "train");
  assert.equal(plan.mode, "mining");
  assert.match(plan.reason, /Knight's Sword/);
});

test("combat goals train combat, and Firemaking 50 opens Wintertodt", () => {
  const a = adventurer({ MINING: 99 }, { done: new Set(data.quests.slice(0, 16).map((quest) => quest.name)) });
  const plan = chooseNext(a, data.quests, { random: () => 0.99 });
  assert.equal(plan.mode, "combat_training");
  const firemaker = adventurer({ WOODCUTTING: 99, MINING: 99, FISHING: 99, THIEVING: 99, FIREMAKING: 50 }, { combat: 126, questPoints: 200, done: new Set(data.quests.map((q) => q.name)) });
  const choices = new Set();
  for (let i = 0; i < 10; i++) choices.add(chooseNext(firemaker, data.quests, { random: () => i / 10 }).mode);
  assert.ok(choices.has("wintertodt"), [...choices].join(","));
});

test("the best activity fits the level", () => {
  assert.equal(bestActivity("woodcutting", 1, definitions), "normal_trees");
  assert.equal(bestActivity("woodcutting", 99, definitions), "redwood_trees");
  assert.equal(bestActivity("mining", 1, definitions), "copper_tin_rocks");
  assert.equal(bestActivity("thieving", 4, definitions), "pickpocket_men");
  assert.equal(bestActivity("thieving", 30, definitions), "silk_stalls");
  assert.equal(bestActivity("thieving", 60, definitions), "pickpocket_knights");
  assert.equal(bestActivity("combat_training", 3, definitions), "combat_training");
});

test("from a boss's combat level an adventurer sometimes goes bossing", () => {
  const strong = adventurer({}, { combat: 80 });
  const plan = chooseNext(strong, data.quests, { bosses: data.bosses, bossChance: 1, random: () => 0 });
  assert.equal(plan.kind, "boss");
  assert.ok(data.bosses.some((boss) => boss.id === plan.boss.id));
  const weak = chooseNext(adventurer({}, { combat: 30 }), data.quests, { bosses: data.bosses, bossChance: 1, random: () => 0 });
  assert.notEqual(weak.kind, "boss");
  const ids = require("../data/definitions/bot-activities.json").activities.map((activity) => activity.id);
  for (const boss of data.bosses) assert.ok(ids.includes(boss.id), boss.id);
});

test("every quest on the server is on the list, the path first, requirements from the cache", () => {
  const { buildQuestList } = require("../plugins/bots/adventurers/Quests.PlayerBots");
  const skill = (name, id) => ({ getName: () => name, getClientId: () => id });
  const Skill = { values: () => [skill("Attack", 0), skill("Mining", 14)] };
  const rows = new Map([
    ["cooksassistant", { rowId: 1, displayname: ["Cook's Assistant"], difficulty: [0], length: [0] }],
    ["theknightssword", { rowId: 2, displayname: ["The Knight's Sword"], requirement_stats: [14, 10], difficulty: [1], length: [1] }],
    ["dragonslayeri", { rowId: 3, displayname: ["Dragon Slayer I"], requirement_questpoints: [32], recommended_combat: [45], requirement_quests: [2], difficulty: [2], length: [2] }],
    ["sheepshearer", { rowId: 4, displayname: ["Sheep Shearer"], difficulty: [0], length: [0] }],
  ]);
  const registered = ["Dragon Slayer I", "Sheep Shearer", "The Knight's Sword", "Cook's Assistant"].map((name) => ({ name }));
  const list = buildQuestList([{ name: "The Knight's Sword" }], registered, rows, Skill);
  assert.deepEqual(list.map((quest) => quest.name), ["The Knight's Sword", "Cook's Assistant", "Sheep Shearer", "Dragon Slayer I"]);
  assert.deepEqual(list[0].skills, { MINING: 10 });
  const dragon = list.find((quest) => quest.name === "Dragon Slayer I");
  assert.equal(dragon.questPoints, 32);
  assert.equal(dragon.combat, 45);
  assert.deepEqual(dragon.quests, ["The Knight's Sword"]);
  assert.equal(list.every((quest) => quest.playthrough !== true), true);
});

test("nothing is simulated: without a bot playthrough no quest is chosen", () => {
  const plan = chooseNext(adventurer(), data.quests, { available: new Set(), questChance: 1, random: () => 0 });
  assert.equal(plan.kind, "train");
});

function tradeFixture(inventoryItems, equipped = []) {
  const Shopping = require("../plugins/bots/adventurers/Shopping.PlayerBots");
  const ids = { COINS: 995, BRONZE_SCIMITAR: 1321, IRON_SCIMITAR: 1323, MITHRIL_SCIMITAR: 1329, RUNE_SCIMITAR: 1333, BONES: 526, SHRIMPS: 315, BRONZE_AXE: 1351, TINDERBOX: 590 };
  const item = (id, amount = 1) => ({ getId: () => id, getAmount: () => amount });
  let inventory = inventoryItems.map(([name, amount]) => item(ids[name], amount));
  let worn = equipped.map((name) => item(ids[name]));
  const player = {
    getInventory: () => ({
      getItems: () => inventory,
      contains: (id) => inventory.some((held) => held.getId() === id),
      getAmount: (id) => inventory.filter((held) => held.getId() === id).reduce((sum, held) => sum + held.getAmount(), 0),
    }),
    getEquipment: () => ({ getItems: () => worn }),
  };
  const core = {
    ItemIdentifiers: ids,
    ItemDefinition: { forId: (id) => ({ isTradeable: () => true, unNote: () => id, getGrandExchangeValue: () => (id === 995 ? 1 : 100), isNoted: () => false }) },
    CacheDefinitions: { hasItem: () => true, getItem: () => ({ tradeable: true }) },
  };
  const wearCalls = [];
  const originalWear = Shopping.wear;
  Shopping.wear = (p, c, id) => {
    wearCalls.push(id);
    inventory = inventory.filter((held) => held.getId() !== id);
    worn = [item(id)];
    return true;
  };
  return { player, core, ids, wearCalls, restore: () => { Shopping.wear = originalWear; } };
}

test("found gear it may wear goes on; it keeps coins, food and tools and sells the rest", () => {
  const Trade = require("../plugins/bots/adventurers/Trade.PlayerBots");
  const f = tradeFixture([["COINS", 50], ["MITHRIL_SCIMITAR", 1], ["RUNE_SCIMITAR", 1], ["BONES", 3], ["SHRIMPS", 2], ["BRONZE_AXE", 1], ["TINDERBOX", 1], ["IRON_SCIMITAR", 1]], ["BRONZE_SCIMITAR"]);
  try {
    const rules = { levelOf: (skill) => (skill === "ATTACK" ? 25 : 1), questDone: () => false };
    assert.deepEqual(Trade.wearBest(f.player, f.core, rules), ["MITHRIL_SCIMITAR"]);
    const keep = Trade.keepIds(f.player, f.core, { isFood: (id) => id === f.ids.SHRIMPS });
    const goods = Trade.goodsToSell(f.player, f.core, keep).map((good) => good.itemId).sort();
    // The rune scimitar beats what it wears (kept for later); the iron one is worse (sold).
    assert.deepEqual(goods, [f.ids.BONES, f.ids.IRON_SCIMITAR].sort());
  } finally {
    f.restore();
  }
});

test("selling goes through the exchange's own events; coins only arrive from collected sales", () => {
  const Trade = require("../plugins/bots/adventurers/Trade.PlayerBots");
  const f = tradeFixture([["BONES", 3]]);
  const events = [];
  const emit = (name, payload) => {
    events.push(name);
    if (name === "ge:place-offer") payload.placed = true;
    if (name === "ge:collect") payload.finished = 0;
  };
  try {
    const result = Trade.sellAtExchange(f.player, f.core, emit, [{ itemId: f.ids.BONES, amount: 3, value: 300 }]);
    assert.deepEqual(events, ["ge:collect", "ge:place-offer"]);
    assert.equal(result.offered.length, 1);
    assert.equal(result.collectedCoins, 0);
  } finally {
    f.restore();
  }
});
