// Run: node --test tests/bot-requirements.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { canExecute, remember, recall, keyOf, REMEMBER_MS } = require("../plugins/bots/adventurers/Requirements.PlayerBots");

const ctx = (over = {}) => ({
  has: () => false, obtainable: () => false, reachable: () => true, remembered: () => null,
  toolsFor: () => ({ any: [], all: [] }), placeOf: () => null, ...over,
});

test("a job whose tool it neither owns nor can get is left out (hunter without a bird snare)", () => {
  const hunter = { mode: "hunter" };
  const tools = () => ({ any: [], all: ["BIRD_SNARE"] });
  assert.deepEqual(canExecute(hunter, ctx({ toolsFor: tools })), { ok: false, why: "tool_unbuyable", detail: { tools: ["BIRD_SNARE"] } });
  assert.equal(canExecute(hunter, ctx({ toolsFor: tools, has: (n) => n === "BIRD_SNARE" })).ok, true, "owns one");
  assert.equal(canExecute(hunter, ctx({ toolsFor: tools, obtainable: () => true })).ok, true, "can buy one");
  const axes = () => ({ any: ["BRONZE_AXE", "IRON_AXE"], all: [] });
  assert.equal(canExecute({ mode: "woodcutting" }, ctx({ toolsFor: axes, obtainable: (n) => n === "IRON_AXE" })).ok, true, "any one of them will do");
  assert.equal(canExecute({ mode: "woodcutting" }, ctx({ toolsFor: axes })).why, "tool_unbuyable");
});

test("a place it cannot walk to is left out, with its floor (Wintertodt by boat, a boss's way in)", () => {
  const wintertodt = { x: 1630, y: 3974, z: 0 };
  const result = canExecute({ mode: "wintertodt" }, ctx({ placeOf: () => wintertodt, reachable: () => false }));
  assert.deepEqual(result, { ok: false, why: "place_unreachable", detail: { place: { x: 1630, y: 3974, z: 0 } } });
  const upstairs = canExecute({ mode: "x" }, ctx({ placeOf: () => ({ x: 3208, y: 3220, z: 2 }), reachable: (p) => p.z === 0 }));
  assert.equal(upstairs.detail.place.z, 2, "the floor is part of the place");
  assert.equal(canExecute({ mode: "wintertodt" }, ctx({ placeOf: () => wintertodt })).ok, true);
});

test("a failed requirement is remembered a while; a passing hitch is not", () => {
  const state = new Map();
  const hunter = { kind: "train", mode: "hunter" };
  assert.equal(remember(state, hunter, { why: "errand_refused" }, 0), false, "not a requirement");
  assert.equal(remember(state, hunter, { why: "tool_unbuyable", detail: { tools: ["BIRD_SNARE"] } }, 0), true);
  const memory = (key) => recall(state, key, 1_000);
  const result = canExecute(hunter, ctx({ remembered: memory }));
  assert.equal(result.ok, false);
  assert.equal(result.detail.remembered, true);
  assert.equal(recall(state, "hunter", REMEMBER_MS), null, "runs out");
  assert.equal(keyOf({ kind: "boss", boss: { id: "boss_giant_mole" } }), "boss:boss_giant_mole");
});

test("a job refused while errands rest is left out until the rest ends, not for half an hour", () => {
  const state = new Map();
  const slayer = { kind: "train", mode: "slayer" };
  const refused = { why: "errand_refused", detail: { why: "errands_resting", errand: "withdraw" } };
  assert.equal(remember(state, slayer, refused, 0, { restingUntil: 4 * 60_000 }), true);
  assert.equal(recall(state, "slayer", 60_000)?.why, "errands_resting");
  assert.equal(recall(state, "slayer", 4 * 60_000), null, "the rest is over: free again");
  assert.equal(remember(state, slayer, refused, 0), false, "no rest known: nothing to remember");
  assert.equal(remember(state, slayer, { why: "errand_refused", detail: { why: "busy" } }, 0, { restingUntil: 60_000 }), false, "busy is a passing hitch");
});

test("Sailing is never a job yet; the planner says the first missing step (Fase 6, Sailing stap 1)", () => {
  const { sailingReadiness } = require("../plugins/bots/adventurers/Requirements.PlayerBots");
  // Every adventurer in the bot-logs of 23-11-2026 (ceefe7a16): Sailing 1-99, no boat, Pandemonium not done.
  assert.deepEqual(sailingReadiness({ level: 1, boats: [], pandemonium: { stage: 0, complete: false, playthrough: false } }),
    { ok: false, why: "no_quest_playthrough", detail: { quest: "Pandemonium", stage: 0, level: 1 } });
  assert.equal(sailingReadiness({ pandemonium: { stage: 12, playthrough: true } }).why, "quest_missing");
  // grantedQuests sets the stage only: complete, but Junior Jim never handed over the raft.
  assert.deepEqual(sailingReadiness({ level: 40, boats: [], pandemonium: { complete: true, granted: true } }),
    { ok: false, why: "no_boat", detail: { quest: "Pandemonium", granted: true, level: 40 } });
  const raft = sailingReadiness({ level: 40, boats: [{ type: "raft", dock: "the_pandemonium" }], pandemonium: { complete: true } });
  assert.deepEqual(raft, { ok: false, why: "no_sailing_brain", detail: { boats: ["raft@the_pandemonium"], level: 40 } });
  assert.equal(sailingReadiness().ok, false, "no facts: not ok");
});

test("Pandemonium's raft comes only from Junior Jim's dialogue, not from the quest stage (why grantedQuests gives no boat)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "../plugins/quests/quests/Pandemonium.Quest.js"), "utf8");
  // One giveBoat, inside grantRaft; grantRaft called once (Jim's cup line, stage 28). A login or
  // stage hook that grants the raft would change sailingReadiness's `no_boat`: update both.
  assert.equal(source.match(/Sailing\.giveBoat\(/g)?.length, 1);
  assert.match(source, /function grantRaft\(player\) \{[\s\S]{0,200}Sailing\.giveBoat\(player, "raft"/);
  assert.equal(source.match(/\bgrantRaft\(player\);/g)?.length, 1);
});
