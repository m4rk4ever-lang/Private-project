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
