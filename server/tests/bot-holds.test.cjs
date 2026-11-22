// What is switched off for now carries its reason and when it comes back (owner, 22-11-2026:
// "ik wil wel zeker weten dat het ook weer gemaakt gaat worden"). The list of holds is the work
// still to do; docs/analysis/2026-11-21-runtime-analyse.md tracks each.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const adventurers = require("../plugins/bots/data/adventurers.json");
const activities = require("../data/definitions/bot-activities.json");

test("every hold names why and when it comes back", () => {
  const holds = [
    ...adventurers.bosses.filter((boss) => boss.hold).map((boss) => [boss.id, boss.hold]),
    ...Object.entries(adventurers.buyToTrain).filter(([, recipe]) => recipe.hold).map(([skill, recipe]) => [skill, recipe.hold]),
    ...(activities.activities ?? activities).filter((activity) => activity.hold).map((activity) => [activity.id, activity.hold]),
  ];
  assert.deepEqual(holds.map(([id]) => id).sort(), ["RUNECRAFTING", "boss_giant_mole", "hunter_red_salamander", "hunter_red_salamander_2", "hunter_tropical_wagtail"]);
  for (const [id, why] of holds) {
    assert.match(why, /\d{2}-11-2026/, `${id}: since when`);
    assert.match(why, /[Ww]eer aan|uit tot/, `${id}: when it comes back`);
  }
});
