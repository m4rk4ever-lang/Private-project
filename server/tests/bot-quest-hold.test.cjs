"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const data = require("../plugins/bots/data/adventurers.json");
const questDir = path.join(__dirname, "..", "plugins", "quests", "quests");
const questSource = fs.readdirSync(questDir).filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(questDir, file), "utf8")).join("\n");

test("questHold: every held quest has a reason and a date, and is a real quest", () => {
  const held = data.questHold?.quests ?? [];
  assert.ok(held.length > 0);
  for (const quest of held) {
    assert.equal(typeof quest.name, "string");
    assert.ok(quest.reason && quest.reason.length > 20, `${quest.name}: a reason the next session can act on`);
    assert.match(quest.since, /^\d{2}-\d{2}-\d{4}$/, `${quest.name}: since as dd-mm-yyyy`);
    assert.ok(questSource.includes(`"${quest.name}"`), `${quest.name}: no quest plugin by that name`);
  }
});

test("questHold: A Porcine of Interest is held (Sourhog cave, 20-11-2026)", () => {
  assert.ok((data.questHold.quests).some((quest) => quest.name === "A Porcine of Interest"));
});

test("questHold: a quest is not both granted and held", () => {
  const granted = new Set(data.grantedQuests?.quests ?? []);
  for (const quest of data.questHold.quests) assert.ok(!granted.has(quest.name), quest.name);
});
