// Run: node --test tests/bot-adventurers.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { chooseNext, missing, bestActivity } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const definitions = require("../data/definitions/bot-activities.json");
const data = require("../plugins/bots/data/adventurers.json");

function adventurer(levels = {}, extra = {}) {
  return { levels: { WOODCUTTING: 1, MINING: 1, FISHING: 1, THIEVING: 1, FIREMAKING: 1, ...levels }, combat: 3, questPoints: 0, done: new Set(), ...extra };
}

test("the quest path names real requirements, five adventurers with short names", () => {
  assert.equal(data.names.length, 5);
  for (const name of data.names) assert.ok(name.length <= 12, name);
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
