// Run: node --test tests/bot-progression.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { upgradeFor, levelOf } = require("../plugins/bots/brain/Progression.PlayerBots");

test("a level-up that opens a better tier moves the bot on", () => {
  assert.equal(upgradeFor({ id: "willow_trees", mode: "woodcutting" }, 60), "yew_trees");
  assert.equal(upgradeFor({ id: "willow_trees", mode: "woodcutting" }, 45), null, "nothing better yet");
  assert.equal(upgradeFor({ id: "copper_tin_rocks", mode: "mining" }, 15), "iron_rocks");
  assert.equal(upgradeFor({ id: "silk_stalls", mode: "thieving" }, 40), "pickpocket_guards");
  assert.equal(upgradeFor({ id: "combat_training", mode: "combat_training" }, 99), null, "combat picks its own monsters");
  assert.equal(upgradeFor({ id: "yew_trees", mode: "woodcutting" }, 60), null, "already the best");
  assert.ok(levelOf("magic_trees") > levelOf("yew_trees"));
});
