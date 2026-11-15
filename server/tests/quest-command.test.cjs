// Run after `yarn build`: node --test tests/quest-command.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const QuestRuntime = require("../plugins/quests/QuestRuntime");
const QuestCommand = require("../plugins/quests/QuestCommand.plugin");

const api = new Proxy({}, { get: () => () => {} });
const grandTree = QuestRuntime.registerQuest(api, { key: "the_grand_tree", name: "The Grand Tree", varpId: 150, completionValue: 160, questPoints: 5 });
QuestRuntime.registerQuest(api, { key: "tree_gnome_village", name: "Tree Gnome Village", varpId: 111, completionValue: 9, questPoints: 2 });

function createPlayer() {
  const attributes = new Map();
  const messages = [];
  const varps = new Map();
  const sender = new Proxy({}, {
    get: (_target, method) => (method === "sendConfig" ? (id, value) => { varps.set(id, value); return sender; } : () => sender),
  });
  return {
    messages,
    varps,
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    sendMessage: (message) => messages.push(message),
    getPacketSender: () => sender,
    getInventory: () => ({ adds() {} }),
  };
}

const run = (player, command) => QuestCommand._test.questCommand({ player, parts: command.split(" ") });

test("::quest grand tree complete completes it as the quest does, with its points", () => {
  const player = createPlayer();
  run(player, "quest grand tree complete");
  assert.ok(grandTree.isComplete(player));
  assert.equal(player.getAttribute("quest.points"), 5);
  assert.equal(player.varps.get(150), 160, "the quest's varp follows");
  assert.equal(player.messages.at(-1), "The Grand Tree: stage 160 (complete; completes at 160).");
});

test("reset and a stage number set the stage, and quest points follow completion", () => {
  const player = createPlayer();
  run(player, "quest the_grand_tree 160");
  assert.equal(player.getAttribute("quest.points"), 5);
  run(player, "quest The Grand Tree 40");
  assert.equal(grandTree.getStage(player), 40);
  assert.equal(player.getAttribute("quest.points"), 0);
  run(player, "quest grand tree reset");
  assert.equal(grandTree.getStage(player), 0);
  assert.equal(player.messages.at(-1), "The Grand Tree: stage 0 (not started; completes at 160).");
});

test("names: a partial name must match one quest", () => {
  const player = createPlayer();
  run(player, "quest tree");
  assert.equal(player.messages.at(-1), '"tree" matches 2 quests: The Grand Tree, Tree Gnome Village.');
  run(player, "quest dragon slayer ii");
  assert.equal(player.messages.at(-1), 'No quest matches "dragon slayer ii".');
  run(player, "quest");
  assert.match(player.messages.at(-1), /^Usage/);
});

test("::allquests marks every quest complete with its points, without rewards", () => {
  const player = createPlayer();
  QuestCommand._test.allQuestsCommand({ player, parts: ["allquests"] });
  for (const quest of QuestRuntime.getRegisteredQuests()) assert.ok(quest.isComplete(player), quest.name);
  assert.equal(player.getAttribute("quest.points"), 7);
  assert.equal(player.messages.at(-1), "Marked 2 quests as complete (no rewards).");
  QuestCommand._test.allQuestsCommand({ player, parts: ["allquests"] });
  assert.equal(player.messages.at(-1), "You have already completed every quest.");
});

test("::allquests marks cache-only quests and miniquests complete, with points, once", () => {
  const rows = [
    // Registered above (The Grand Tree): skipped.
    { rowId: 900, displayname: ["The Grand Tree"], release_type: [1], type: [0], endstate: [160], questpoints_override: [5] },
    // A quest no plugin implements (row 10: Black Knights' Fortress's varp 130 in the data file).
    { rowId: 10, displayname: ["Cache-only quest"], release_type: [1], type: [0], endstate: [4], questpoints_override: [3] },
    // A miniquest (row 25: a varbit in the data file): no quest points.
    { rowId: 25, displayname: ["Cache-only miniquest"], release_type: [1], type: [1], endstate: [3], questpoints_override: [0] },
    // Unreleased: skipped.
    { rowId: 17, displayname: ["Unreleased"], release_type: [0], type: [0], endstate: [2], questpoints_override: [1] },
  ];
  const cache = {
    getDbColumns: () => [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((name) => name !== "rowId"),
    getDbColumn: (_table, name) => name,
    getDbTableRows: () => rows.map((row) => ({ id: row.rowId, column: (name) => row[name] })),
  };
  const player = createPlayer();
  const varbits = new Map();
  const sender = player.getPacketSender();
  const sendVarbit = (id, value) => { varbits.set(id, value); return sender; };
  player.getPacketSender = () => new Proxy(sender, { get: (target, key) => (key === "sendVarbit" ? sendVarbit : target[key]) });
  const marked = QuestCommand._test.markUnimplementedComplete(player, cache);
  assert.equal(marked, 2);
  assert.equal(player.varps.get(130), 4, "the cache-only quest's varp at its end state");
  assert.equal(varbits.size, 1, "the miniquest's varbit");
  assert.equal(player.getAttribute("quest.points"), 3, "quest points for the quest, none for the miniquest");
  assert.deepEqual(player.getAttribute(QuestCommand._test.MARKED_COMPLETE_ATTRIBUTE).varps, { 130: 4 });
  assert.equal(QuestCommand._test.markUnimplementedComplete(player, cache), 0, "twice marks nothing new");
  assert.equal(player.getAttribute("quest.points"), 3);
});
