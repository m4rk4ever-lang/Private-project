// Run: node --test tests/diary-complete-all.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const Progress = require("../plugins/achievements/diaries/Progress.AchievementDiaries");
const { TIERS, DIARIES } = require("../plugins/achievements/diaries/Data.AchievementDiaries");

const events = [];
Progress({
  core: {},
  persistAttribute() {},
  onPlayerLogin() {},
  emitCustomEvent: (name, payload) => events.push(name),
});

function fakePlayer() {
  const attributes = new Map();
  const varbits = new Map();
  const messages = [];
  return {
    attributes, varbits, messages,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getPacketSender: () => ({ sendVarbit: (id, value) => varbits.set(id, value) }),
    sendMessage: (text) => messages.push(text),
    isRegistered: () => true,
  };
}

test("completeAll finishes every tier of every diary quietly, rewards unclaimed", () => {
  const player = fakePlayer();
  const tiers = Progress.completeAll(player);
  assert.equal(tiers, DIARIES.length * TIERS.length);
  for (const diary of DIARIES) {
    for (const tier of TIERS) {
      assert.ok(Progress.isTierComplete(player, diary, tier), `${diary.key} ${tier}`);
      assert.equal(player.varbits.get(diary.tiers[tier].completeVarbit), diary.tiers[tier].completeValue ?? 1);
      assert.equal(player.varbits.get(diary.tiers[tier].rewardVarbit), 0);
    }
    assert.equal(Progress.claimedTiers(player, diary).size, 0);
  }
  assert.equal(player.messages.length, 0);
  assert.ok(!events.includes("diary:tier-complete"));
  assert.equal(Progress.completeAll(player), 0, "a second run has nothing left");
});
