"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAchievements } = require("../plugins/bots/adventurers/Achievements.PlayerBots");

const adventurer = (name, clan, level, total, extra = {}) => ({
  name, clan, total, combat: level, quests: [], questPoints: 0, wealth: { total: 0 }, journal: [],
  skills: { attack: { level }, woodcutting: { level: 1 } }, ...extra,
});

function fresh(generation = 1) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "achievements-")), "a.json");
  return { file, achievements: createAchievements({ file, generation, now: () => 1000 }) };
}

test("a first goes to whoever reaches it, once", () => {
  const { achievements } = fresh();
  const first = achievements.update([adventurer("A", "Jorg", 12, 100), adventurer("B", "Mark", 8, 90)]);
  assert.equal(first.find((win) => win.id === "skill:attack:10").name, "A");
  // B reaching it later does not take it over.
  const later = achievements.update([adventurer("A", "Jorg", 12, 100), adventurer("B", "Mark", 15, 120)]);
  assert.equal(later.some((win) => win.id === "skill:attack:10"), false);
  assert.equal(achievements.view().won.find((win) => win.id === "skill:attack:10").name, "A");
});

test("a clan first needs every member", () => {
  const { achievements } = fresh();
  achievements.update([adventurer("A", "Jorg", 25, 100), adventurer("C", "Jorg", 10, 50), adventurer("B", "Mark", 21, 90), adventurer("D", "Mark", 22, 90)]);
  const win = achievements.view().won.find((entry) => entry.id === "clan-combat:20");
  assert.equal(win.clan, "Mark");
  assert.equal(win.name, null);
});

test("the race is kept across restarts and starts over with a new generation", () => {
  const { file, achievements } = fresh(3);
  achievements.update([adventurer("A", "Jorg", 12, 100)]);
  assert.ok(createAchievements({ file, generation: 3 }).view().won.length > 0);
  assert.equal(createAchievements({ file, generation: 4 }).view().won.length, 0);
});
