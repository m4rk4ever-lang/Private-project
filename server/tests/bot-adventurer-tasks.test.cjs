// Run: node --test tests/bot-adventurer-tasks.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const Tasks = require("../plugins/bots/adventurers/Tasks.PlayerBots");

test("a running job is saved as one plain record with the time it has left", () => {
  const entry = { phase: "training", activity: "oak_trees", until: 10_000 + 5 * 60_000,
    plan: { kind: "train", mode: "woodcutting", skill: "WOODCUTTING", reason: "doel" } };
  const record = Tasks.taskRecord(entry, 10_000, 1_700_000_000_000);
  assert.deepEqual(record, { kind: "train", mode: "woodcutting", skill: "WOODCUTTING", reason: "doel", style: null, target: null,
    bossId: null, activity: "oak_trees", planActivity: null, remainingMs: 5 * 60_000, savedAt: 1_700_000_000_000 });
  assert.deepEqual(JSON.parse(JSON.stringify(record)), record);
  assert.equal(Tasks.taskRecord({ ...entry, phase: "errand" }, 0, 0), null);
  assert.equal(Tasks.taskRecord({ ...entry, plan: { kind: "quest", quest: {} } }, 0, 0), null);
});

test("after a restart the saved job comes back as the same plan, a boss by its id", () => {
  const wall = 1_700_000_000_000;
  const train = Tasks.freshTask({ kind: "train", mode: "combat_training", skill: "COMBAT", style: "ranged", remainingMs: 2000, savedAt: wall - 60_000 }, wall);
  assert.deepEqual(Tasks.planOf(train), { kind: "train", mode: "combat_training", skill: "COMBAT", reason: "verder", style: "ranged" });
  assert.equal(Tasks.resumeMs(train), Tasks.MIN_RESUME_MS);
  const bosses = [{ id: "boss_giant_mole", name: "Giant Mole" }];
  const boss = Tasks.freshTask({ kind: "boss", bossId: "boss_giant_mole", remainingMs: 9 * 60_000, savedAt: wall }, wall);
  assert.equal(Tasks.planOf(boss, bosses).boss, bosses[0]);
  assert.equal(Tasks.resumeMs(boss), Math.max(Tasks.MIN_RESUME_MS, 9 * 60_000));
  assert.equal(Tasks.planOf({ kind: "boss", bossId: "gone" }, bosses), null);
});

test("a stale, broken or future-dated save is ignored", () => {
  const wall = 1_700_000_000_000;
  assert.equal(Tasks.freshTask({ kind: "train", mode: "mining", savedAt: wall - Tasks.TASK_STALE_MS - 1 }, wall), null);
  assert.equal(Tasks.freshTask({ kind: "train", savedAt: wall }, wall), null);
  assert.equal(Tasks.freshTask({ kind: "quest", savedAt: wall }, wall), null);
  assert.equal(Tasks.freshTask("oops", wall), null);
  assert.equal(Tasks.freshTask({ kind: "train", mode: "mining", savedAt: wall + 3_600_000 }, wall), null);
});

test("a saved job keeps the level it was for, so a resumed stretch still stops there", () => {
  const entry = { phase: "training", until: 60_000, plan: { kind: "train", mode: "combat_training", skill: "COMBAT", reason: "The Restless Ghost (combat 10)", target: { skill: "COMBAT", level: 10 } } };
  const record = Tasks.taskRecord(entry, 0, 1000);
  assert.deepEqual(record.target, { skill: "COMBAT", level: 10 });
  assert.deepEqual(Tasks.planOf(record).target, { skill: "COMBAT", level: 10 });
});

test("an older saved job without the field gets its level from the reason", () => {
  assert.deepEqual(Tasks.planOf({ kind: "train", mode: "combat_training", skill: "COMBAT", reason: "The Restless Ghost (combat 10)" }).target, { skill: "COMBAT", level: 10 });
  assert.deepEqual(Tasks.planOf({ kind: "train", mode: "mining", skill: "MINING", reason: "The Knight's Sword (mining 10)" }).target, { skill: "MINING", level: 10 });
  assert.equal(Tasks.planOf({ kind: "train", mode: "mining", skill: "MINING", reason: "afwisseling" }).target, undefined);
});
