// Within a mode, the tier its clan measured best, not always the highest its level allows
// (skill-progressie analyse 22-11-2026, S2/S5: yews 22.7k OSRS XP/h but 29 of 50 jobs stuck,
// willows 19.6k; sharks 55k gp/h for a money stretch but 25 of 36 stuck).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pickTier, activitiesFor } = require("../plugins/bots/adventurers/Planner.PlayerBots");
const { createKnowledge, xpTier } = require("../plugins/bots/adventurers/Knowledge.PlayerBots");
const { upgradeFor } = require("../plugins/bots/brain/Progression.PlayerBots");
const definitions = require("../data/definitions/bot-activities.json");

function statsFrom(table) {
  return (id) => table[id] ?? { jobs: 0, n: 0, nXp: 0 };
}

test("woodcutting 65: willows when yews are measured but mostly stuck", () => {
  const options = activitiesFor("woodcutting", 65, definitions);
  assert.equal(options[0].id, "yew_trees");
  const stats = statsFrom({
    yew_trees: { osrsXpPerHour: 22_700, gpPerHour: 200, stuckRate: 0.58, n: 20, nXp: 20, jobs: 50 },
    willow_trees: { osrsXpPerHour: 19_600, gpPerHour: 5_600, stuckRate: 0.05, n: 20, nXp: 20, jobs: 25 },
  });
  const tier = pickTier(options, stats);
  assert.equal(tier.id, "willow_trees");
  assert.match(tier.reason, /^willow trees: 19\.600 OSRS-XP\/u gemeten, yew trees 22\.700 maar 58% vast$/);
});

test("without measurements (or too few) the highest tier stays, as before", () => {
  const options = activitiesFor("woodcutting", 65, definitions);
  assert.deepEqual(pickTier(options, statsFrom({})), { id: "yew_trees", reason: null });
  const few = statsFrom({
    yew_trees: { osrsXpPerHour: 1_000, stuckRate: 0.5, n: 2, nXp: 2, jobs: 3 },
    willow_trees: { osrsXpPerHour: 19_600, stuckRate: 0, n: 20, nXp: 20, jobs: 20 },
  });
  assert.equal(pickTier(options, few).id, "yew_trees", "the best tier gets its chance first");
  // A lower tier only a little better: no switch (margin).
  const close = statsFrom({
    yew_trees: { osrsXpPerHour: 20_000, stuckRate: 0, n: 10, nXp: 10, jobs: 10 },
    willow_trees: { osrsXpPerHour: 21_000, stuckRate: 0, n: 10, nXp: 10, jobs: 10 },
  });
  assert.equal(pickTier(options, close).id, "yew_trees");
});

test("a money stretch weighs coins, training weighs OSRS XP", () => {
  const options = activitiesFor("fishing", 80, definitions);
  assert.equal(options[0].id, "shark_fishing");
  const stats = statsFrom({
    shark_fishing: { osrsXpPerHour: 10_500, gpPerHour: 55_000, stuckRate: 0.69, n: 11, nXp: 11, jobs: 36 },
    harpoon_fishing: { osrsXpPerHour: 20_900, gpPerHour: 24_800, stuckRate: 0.1, n: 20, nXp: 20, jobs: 20 },
    lobster_fishing: { osrsXpPerHour: 11_900, gpPerHour: 15_400, stuckRate: 0, n: 20, nXp: 20, jobs: 20 },
  });
  const training = pickTier(options, stats);
  assert.equal(training.id, "harpoon_fishing");
  const money = pickTier(options, stats, { money: true });
  assert.equal(money.id, "harpoon_fishing", "55k at 69% stuck is 17k; harpoon 24.8k at 10% is 22k");
  assert.match(money.reason, /gp\/u gemeten/);
  // Sharks rarely stuck: they make the money.
  const calm = statsFrom({ shark_fishing: { gpPerHour: 55_000, stuckRate: 0.05, n: 20, nXp: 20, jobs: 20 }, harpoon_fishing: { gpPerHour: 24_800, n: 20, jobs: 20 } });
  assert.equal(pickTier(options, calm, { money: true }).id, "shark_fishing");
});

test("the clan keeps OSRS XP per hour (raw XP over the level's rate), comparable between tiers", () => {
  assert.deepEqual([xpTier(45), xpTier(65), xpTier(85), xpTier(95)], [25, 15, 10, 5]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-tier-"));
  const knowledge = createKnowledge({ file: path.join(dir, "k.json"), write: () => {} });
  for (let index = 0; index < 5; index += 1) knowledge.record("Mark Clan", ["activity:willow_trees"], { xpPerHour: 490_000, osrsXpPerHour: 19_600 });
  // A job saved before OSRS XP was kept: counted in raw XP, not in OSRS XP.
  knowledge.record("Mark Clan", ["activity:willow_trees"], { xpPerHour: 300_000 });
  const stats = knowledge.stats("Mark Clan", "activity:willow_trees");
  assert.equal(stats.osrsXpPerHour, 19_600);
  assert.equal(stats.nXp, 5);
  assert.equal(stats.jobs, 6);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Progression.upgradeFor follows the same rule when it has a clan's numbers", () => {
  const stats = statsFrom({
    yew_trees: { osrsXpPerHour: 22_700, stuckRate: 0.58, n: 20, nXp: 20, jobs: 50 },
    willow_trees: { osrsXpPerHour: 19_600, stuckRate: 0.05, n: 20, nXp: 20, jobs: 25 },
  });
  assert.equal(upgradeFor({ id: "willow_trees", mode: "woodcutting" }, 60), "yew_trees", "without numbers: up");
  assert.equal(upgradeFor({ id: "willow_trees", mode: "woodcutting" }, 60, { statsOf: stats }), null, "measured worse: stays");
  assert.equal(upgradeFor({ id: "oak_trees", mode: "woodcutting" }, 60, { statsOf: stats }), "willow_trees");
});
