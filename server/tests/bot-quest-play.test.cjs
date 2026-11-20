// Run: node --test tests/bot-quest-play.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const QuestPlay = require("../plugins/bots/adventurers/QuestPlay.PlayerBots");

test("a dialogue answer: a preferred option first, else the first that is not a refusal", () => {
  assert.equal(QuestPlay.chooseOption(["Have you any quests for me?", "Where can I find money?"], ["quests for me"]), 0);
  assert.equal(QuestPlay.chooseOption(["Go ahead.", "Actually, I'm not interested."]), 0);
  assert.equal(QuestPlay.chooseOption(["No, I'm busy.", "Yes, certainly."]), 1);
  assert.equal(QuestPlay.chooseOption(["Yes please!", "I've been sent here with a package for you.", "No thank you."], ["package for you"]), 1);
});

test("a basement is reached by its ladder and left by the other", () => {
  const basement = { x: 3104, y: 9571, z: 0 };
  assert.deepEqual(QuestPlay.nextHop({ x: 3222, y: 3218, z: 0 }, basement).climb?.option, "Climb-down");
  assert.equal(QuestPlay.nextHop({ x: 3104, y: 9573, z: 0 }, basement).climb, null);
  assert.equal(QuestPlay.nextHop({ x: 3104, y: 9573, z: 0 }, { x: 3253, y: 3401, z: 0 }).climb?.option, "Climb-up");
});

test("every playthrough names its NPCs, spots and stages in order", () => {
  for (const [name, quest] of Object.entries(QuestPlay.data.quests)) {
    let last = 0;
    for (const step of quest.steps) {
      assert.ok(step.npc && Array.isArray(step.at) && step.at.length >= 2, `${name}: ${JSON.stringify(step)}`);
      if (step.until !== "complete") {
        assert.ok(step.until > last, `${name}: stages go up`);
        last = step.until;
      }
    }
    assert.equal(quest.steps.at(-1).until, "complete", `${name} ends complete`);
  }
});

test("a quest object is found by the form the helper names, also on a multi-loc's base (the mill's flour bin)", () => {
  const { matchesIds } = require("../plugins/bots/adventurers/QuestPlay.PlayerBots");
  const core = { CacheDefinitions: { getObject: (id) => (id === 1781 ? { transforms: [1781, 1782] } : { transforms: null }) } };
  assert.equal(matchesIds(core, 1782, [1782]), true);
  assert.equal(matchesIds(core, 1781, [1782]), true);
  assert.equal(matchesIds(core, 999, [1782]), false);
  assert.equal(matchesIds({}, 1781, [1782]), false);
});
