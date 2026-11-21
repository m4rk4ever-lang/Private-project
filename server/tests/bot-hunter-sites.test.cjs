"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { activitiesFor, leastBusy } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const definitions = require("../data/definitions/bot-activities.json");
const gear = require("../plugins/bots/data/adventurer-gear.json");

test("hunter: several Feldip spots per tier, each with its snare", () => {
  const low = activitiesFor("hunter", 5, definitions).map((option) => option.id);
  assert.deepEqual(low, ["hunter_crimson_swift", "hunter_crimson_swift_2", "hunter_crimson_swift_3"]);
  const high = activitiesFor("hunter", 30, definitions);
  assert.equal(high[0].level, 19);
  for (const { id } of high) assert.deepEqual(gear.fishingTools?.[id] ?? Object.values(gear).find((v) => v && v[id])?.[id], ["BIRD_SNARE"], id);
});

test("hunter: a spot with room, the emptiest of the best tier, none when all are full", () => {
  // Fifteen bots stood on one beach (21-11-2026): two at most to a spot.
  const options = activitiesFor("hunter", 30, definitions);
  const counts = { hunter_tropical_wagtail: 2, hunter_tropical_wagtail_2: 1 };
  assert.equal(leastBusy(options, (id) => counts[id] ?? 0, 2), "hunter_tropical_wagtail_3");
  const wagtailsFull = (id) => (id.startsWith("hunter_tropical") ? 2 : id === "hunter_crimson_swift" ? 1 : 0);
  assert.equal(leastBusy(options, wagtailsFull, 2), "hunter_crimson_swift_2");
  assert.equal(leastBusy(options, () => 2, 2), null);
});
