// Run: node --test tests/bot-progression.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const Progression = require("../plugins/bots/adventurers/Progression.PlayerBots");
const { chooseNext } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const unlocks = require("../plugins/bots/data/unlock-values.json");
const data = require("../plugins/bots/data/adventurers.json");

function adventurer(levels = {}, extra = {}) {
  return { levels: { WOODCUTTING: 1, MINING: 1, FISHING: 1, THIEVING: 1, FIREMAKING: 1, ...levels }, combat: 3, questPoints: 0, done: new Set(), ...extra };
}

test("every unlock names a quest on the path or a skill with a level, with a value", () => {
  const names = new Set(data.quests.map((quest) => quest.name));
  for (const unlock of unlocks.unlocks) {
    assert.ok(unlock.value > 0, unlock.id);
    if (unlock.quest) assert.ok(names.has(unlock.quest), `${unlock.id}: ${unlock.quest} is not on the quest path`);
    else assert.ok(/^[A-Z]+$/.test(unlock.skill) && unlock.level > 1, unlock.id);
  }
});

test("a quest's value: its own unlock, its Quest Cape share, and half of what it opens the way to", () => {
  const quests = [{ name: "A" }, { name: "B", quests: ["A"] }, { name: "C" }];
  const values = { questCape: 300, unlocks: [{ id: "b", quest: "B", value: 800 }] };
  const a = Progression.questValue(quests[0], { adventurer: adventurer(), quests, data: values });
  const c = Progression.questValue(quests[2], { adventurer: adventurer(), quests, data: values });
  assert.equal(c, 100, "only its cape share");
  assert.equal(a, 100 + 400, "B needs A: half of B's 800");
  assert.equal(Progression.questValue(quests[1], { adventurer: adventurer(), quests, data: values }), 900);
});

test("a near unlock beats a far one of the same worth; reached ones are not candidates", () => {
  const values = { questCape: 0, unlocks: [{ id: "near", skill: "PRAYER", level: 43, value: 700 }, { id: "far", skill: "ATTACK", level: 70, value: 700 }] };
  const list = Progression.candidates(adventurer({ PRAYER: 40, ATTACK: 20 }), [], values);
  assert.deepEqual(list.map((entry) => entry.unlock.id), ["near", "far"]);
  assert.equal(Progression.candidates(adventurer({ PRAYER: 43, ATTACK: 70 }), [], values).length, 0);
});

test("the planner picks the ready quest worth most, and trains toward the best unlock (path unlock)", () => {
  const quests = [{ name: "Plain" }, { name: "Valuable" }];
  const values = { questCape: 0, unlocks: [{ id: "v", quest: "Valuable", value: 900 }] };
  let why = null;
  const plan = chooseNext(adventurer(), quests, { random: () => 0, unlocks: values, explain: (d) => { why = d; } });
  assert.equal(plan.quest.name, "Valuable");
  assert.equal(why.value, 900);
  // Nothing ready: a skill unlock it can train (Agility 10) on the unlock path.
  const skillValues = { questCape: 0, unlocks: [{ id: "roofs", name: "rooftops", skill: "AGILITY", level: 10, value: 950 }] };
  const blocked = [{ name: "Far", skills: { MINING: 60 } }];
  // Rolls: money (no), unlock (yes).
  const random = (() => { const rolls = [0.99, 0]; return () => rolls.shift() ?? 0.99; })();
  const train = chooseNext(adventurer(), blocked, { random, unlocks: skillValues, unlockChance: 0.5, explain: (d) => { why = d; } });
  assert.equal(why.path, "unlock");
  assert.equal(train.mode, "agility");
  assert.deepEqual(train.target, { skill: "AGILITY", level: 10 });
});

test("without unlock values the planner chooses as before", () => {
  const plan = chooseNext(adventurer(), data.quests, { random: () => 0 });
  assert.equal(plan.quest.name, data.quests[0].name);
});
