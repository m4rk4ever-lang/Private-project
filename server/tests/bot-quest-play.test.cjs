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

test("a quest's required items it lacks are fetched before it talks (Doric's clay and ores)", () => {
  const { createQuestPlay } = require("../plugins/bots/adventurers/QuestPlay.PlayerBots");
  const fetched = [];
  const helper = {
    available: () => true, keyOf: () => "dorics_quest", status: () => null, recommended: () => [],
    current: () => ({ id: "talk-doric", kind: "npc", npc: "Doric", ids: [], needs: [], at: [2951, 3450, 0], text: "Bring Doric 6 clay, 4 copper ore and 2 iron ore." }),
    required: () => [{ ids: [434], amount: 6, name: "Clay" }, { ids: [436], amount: 4, name: "Copper ore" }],
  };
  const player = {
    getLocation: () => ({ getX: () => 2951, getY: () => 3450, getZ: () => 0 }),
    getInventory: () => ({ getAmount: () => 0, getItems: () => [] }),
    getDialogueManager: () => ({ isActive: () => false }),
    getUsername: () => "Testbot",
  };
  const play = createQuestPlay({ core: {}, world: {}, walkTo: () => true, note: () => {}, helper,
    quests: () => [{ name: "Doric's Quest", isComplete: () => false }],
    playthroughs: {}, acquire: (entry, ids, amount, name) => { fetched.push([name, amount]); return true; } });
  const entry = { player, name: "Testbot" };
  assert.equal(play.start(entry, "Doric's Quest", 0), true);
  assert.equal(play.tick(entry, 1_000), "running");
  assert.deepEqual(fetched, [["Clay", 6]]);
  // The next one a moment later, each once.
  play.tick(entry, 7_000);
  assert.deepEqual(fetched, [["Clay", 6], ["Copper ore", 4]]);
  // What it fetched for the quest is kept from sale for some hours (Jorgbot 13 sold its soft clay).
  const { QUEST_KEEP_MS } = require("../plugins/bots/adventurers/QuestPlay.PlayerBots");
  assert.ok(entry.questKeep.get(434) >= 1_000 + QUEST_KEEP_MS);
});
