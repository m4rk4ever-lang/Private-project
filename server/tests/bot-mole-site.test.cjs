"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The bots' Giant Mole fight reaches every spot she resurfaces at (GiantMole.plugin.js), measured
// from her lair spawn: at the default 24 tiles they lost her after a burrow and stood idle.
test("giant mole: the bots' fight reaches every resurface spot", () => {
  const root = path.join(__dirname, "..");
  const activities = JSON.parse(fs.readFileSync(path.join(root, "data/definitions/bot-activities.json"), "utf8"));
  const list = Array.isArray(activities) ? activities : activities.activities;
  const mole = list.find((activity) => activity.id === "boss_giant_mole");
  const radius = mole.actions[0].siteRadius;
  const source = fs.readFileSync(path.join(root, "plugins/bosses/GiantMole.plugin.js"), "utf8");
  const spots = [...source.matchAll(/\[(17\d\d), (5\d\d\d)\]/g)].map(([, x, y]) => [Number(x), Number(y)]);
  assert.ok(spots.length >= 10);
  const spawn = [1759, 5189];
  const far = Math.max(...spots.map(([x, y]) => Math.max(Math.abs(x - spawn[0]), Math.abs(y - spawn[1]))));
  assert.ok(radius >= far, `siteRadius ${radius} < ${far}`);
});
