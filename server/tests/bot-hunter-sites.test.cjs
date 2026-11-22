"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { activitiesFor, leastBusy } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const definitions = require("../data/definitions/bot-activities.json");
const gear = require("../plugins/bots/data/adventurer-gear.json");
// The spots as built, without the temporary holds (wagtail and salamanders: 0 XP, 22-11-2026).
const built = JSON.parse(JSON.stringify(definitions));
for (const activity of built.activities ?? built) delete activity.hold;

test("hunter: several Feldip spots per tier, each with its snare", () => {
  const low = activitiesFor("hunter", 5, built).map((option) => option.id);
  assert.deepEqual(low, ["hunter_crimson_swift"]);
  const high = activitiesFor("hunter", 30, built);
  assert.equal(high[0].level, 19);
  for (const { id } of high) assert.deepEqual(gear.fishingTools?.[id] ?? Object.values(gear).find((v) => v && v[id])?.[id], ["BIRD_SNARE"], id);
});

test("hunter: a spot with room, the emptiest of the best tier, none when all are full", () => {
  // Fifteen bots stood on one beach (21-11-2026): two at most to a spot.
  const options = activitiesFor("hunter", 30, built);
  assert.equal(leastBusy(options, () => 0, 3), "hunter_tropical_wagtail");
  const wagtailFull = (id) => (id.startsWith("hunter_tropical") ? 3 : 1);
  assert.equal(leastBusy(options, wagtailFull, 3), "hunter_crimson_swift");
  assert.equal(leastBusy(options, () => 3, 3), null);
});

test("hunter: red salamanders by net trap at Ourania from Hunter 59, on foot", () => {
  const TravelHubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
  const options = activitiesFor("hunter", 70, built);
  assert.deepEqual(options.slice(0, 2).map((option) => option.id), ["hunter_red_salamander", "hunter_red_salamander_2"]);
  const list = Array.isArray(built) ? built : built.activities;
  for (const { id } of options.slice(0, 2)) {
    const action = list.find((activity) => activity.id === id).actions[0];
    assert.equal(action.trap, "net");
    assert.deepEqual(gear.fishingTools[id], ["SMALL_FISHING_NET", "ROPE"]);
    assert.equal(TravelHubs.onFoot({ x: action.site[0], y: action.site[1], z: 0 }), true, id);
  }
  // Below 59 the wagtails stay the best.
  assert.equal(activitiesFor("hunter", 58, built)[0].level, 19);
});

test("held hunter activities are not chosen: wagtail and salamanders gave 0 XP (22-11-2026)", () => {
  const ids = activitiesFor("hunter", 99, definitions).map((option) => option.id);
  assert.deepEqual(ids, ["hunter_crimson_swift"]);
});
