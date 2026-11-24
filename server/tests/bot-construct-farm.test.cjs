"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createConstructAction } = require("../plugins/bots/brain/actions/Construct.PlayerBots");
const { createFarmPatchesAction } = require("../plugins/bots/brain/actions/FarmPatches.PlayerBots");

/** A tiny world: objects by tile, each with a name and options as the player sees it. */
function fakeWorld(objects, { items = {}, emit = () => {} } = {}) {
  const hash = (x, y, z) => `${x},${y},${z}`;
  const map = new Map();
  const defs = new Map();
  let nextId = 1;
  for (const spec of objects) {
    const id = spec.id ?? nextId++;
    const object = { getId: () => id, getLocation: () => ({ getX: () => spec.x, getY: () => spec.y, getZ: () => 0 }), getPrivateArea: () => spec.area ?? null };
    defs.set(id, spec);
    map.set(hash(spec.x, spec.y, 0), [...(map.get(hash(spec.x, spec.y, 0)) ?? []), object]);
  }
  const definition = (id) => ({ getName: () => defs.get(id)?.name, getInteractions: () => defs.get(id)?.options ?? [] });
  const clicks = [];
  const core = {
    ItemIdentifiers: { PLANK: 960, OAK_PLANK: 8778, WEEDS: 6055, SPADE: 952, RAKE: 5341, GUAM_SEED: 5291, POTATO_SEED: 5318 },
    MapObjects: { getHash: hash, mapObjects: map },
    ObjectDefinition: { forId: definition, forPlayer: definition },
    MultiChatboxPrompt: { getPending: () => null },
  };
  const world = {
    core,
    emit,
    emitObjectInteraction: (event) => clicks.push({ kind: "object", name: defs.get(event.objectId)?.name, clickType: event.clickType }),
    emitItemOnObject: (event) => clicks.push({ kind: "item", itemId: event.itemId, name: defs.get(event.objectId)?.name }),
    useItem: () => false,
  };
  const inventory = { ...items };
  const player = {
    getLocation: () => ({ getX: () => 100, getY: () => 100, getZ: () => 0 }),
    getPrivateArea: () => "house",
    getMovementQueue: () => ({ size: () => 0, walkToObject: (object, { execute }) => execute() }),
    getInventory: () => ({
      getAmount: (id) => inventory[id] ?? 0, getFreeSlots: () => 20, deleteNumber: (id, n) => { inventory[id] = Math.max(0, (inventory[id] ?? 0) - n); },
      getItems: () => Object.entries(inventory).map(([id]) => ({ getId: () => Number(id) })),
    }),
    getPacketSender: () => ({ sendInterfaceRemoval: () => {} }),
  };
  return { world, player, clicks, inventory };
}

test("construct: picks the best piece it can build from the open list", () => {
  const chosen = [];
  const { world, player } = fakeWorld([], {
    items: { 960: 10 },
    emit: (name, payload) => {
      if (name === "construction:furniture-menu") payload.choices = [
        { index: 1, key: "CRUDE_WOODEN_CHAIR", experience: 58, ready: true },
        { index: 2, key: "WOODEN_CHAIR", experience: 87, ready: true },
        { index: 3, key: "ROCKING_CHAIR", experience: 87, ready: false },
      ];
      if (name === "construction:choose-furniture") { chosen.push(payload.index); payload.built = true; }
    },
  });
  const action = createConstructAction({ planks: ["PLANK"] }, world);
  const state = {};
  assert.equal(action.update({ player, state, nowMs: 0 }), "running");
  assert.deepEqual(chosen, [2]);
});

test("construct: builds on an empty hotspot, removes its own piece, leaves when out of planks", () => {
  const { world, player, clicks, inventory } = fakeWorld([
    { x: 101, y: 100, name: "Chair space", options: ["Build"], area: "house" },
    { x: 105, y: 100, name: "Bookcase", options: ["Remove"], area: "house" },
    { x: 110, y: 100, name: "Portal", options: ["Enter", "Lock"], area: "house" },
  ], { items: { 960: 4 } });
  const action = createConstructAction({ planks: ["PLANK"] }, world);
  const state = {};
  action.update({ player, state, nowMs: 0 });
  // Not the bookcase that stood there before it came: the empty chair space.
  assert.deepEqual(clicks.at(-1), { kind: "object", name: "Chair space", clickType: 1 });
  inventory[960] = 0;
  action.update({ player, state, nowMs: 10_000 });
  assert.deepEqual(clicks.at(-1), { kind: "object", name: "Portal", clickType: 1 });
  assert.equal(action.update({ player, state, nowMs: 20_000 }), "success");
});

test("farm patches: rake first, then plant the best seed it carries, then done", () => {
  const patches = [
    { id: 8150, x: 3058, y: 3311, name: "Herb patch", options: ["Rake", "Inspect", "Guide"] },
    { id: 8550, x: 3050, y: 3307, name: "Allotment", options: ["Inspect", "Guide"] },
  ];
  const { world, player, clicks } = fakeWorld(patches, { items: { 5291: 1, 5318: 6, 5341: 1 } });
  const action = createFarmPatchesAction({ site: [3054, 3306], patches: [
    { id: 8150, x: 3058, y: 3311, kind: "herb" }, { id: 8550, x: 3050, y: 3307, kind: "allotment" },
  ], seeds: { herb: ["GUAM_SEED"], allotment: ["POTATO_SEED"] } }, world);
  const state = {};
  action.update({ player, state, nowMs: 0 });
  assert.deepEqual(clicks.at(-1), { kind: "object", name: "Herb patch", clickType: 1 });
  patches[0].options = ["Inspect", "Guide"];
  action.update({ player, state, nowMs: 5_000 });
  assert.deepEqual(clicks.at(-1), { kind: "item", itemId: 5291, name: "Herb patch" });
  action.update({ player, state, nowMs: 10_000 });
  assert.deepEqual(clicks.at(-1), { kind: "item", itemId: 5318, name: "Allotment" });
  action.update({ player, state, nowMs: 15_000 });
  action.update({ player, state, nowMs: 20_000 });
  assert.equal(action.update({ player, state, nowMs: 25_000 }), "success");
});

test("farm patches: the spots' patch ids and tiles are the farming plugin's", () => {
  const farming = require("../plugins/skills/data/farming-data.json");
  const definitions = require("../data/definitions/bot-activities.json");
  const list = Array.isArray(definitions) ? definitions : definitions.activities;
  const spots = list.filter((activity) => activity.mode === "farming");
  assert.equal(spots.length, 3);
  for (const spot of spots) {
    for (const patch of spot.actions[0].patches) {
      assert.ok(farming.patches.some((known) => known.id === patch.id && known.x === patch.x && known.y === patch.y), JSON.stringify(patch));
    }
  }
});

test("farm patches: the weeds go from the bag, the farm run goes on", () => {
  const { world, player, clicks, inventory } = fakeWorld([{ id: 8150, x: 3058, y: 3311, name: "Herb patch", options: ["Rake", "Inspect", "Guide"] }], { items: { 6055: 6, 5341: 1 } });
  const action = createFarmPatchesAction({ site: [3058, 3311], patches: [{ id: 8150, x: 3058, y: 3311, kind: "herb" }], seeds: { herb: [], allotment: [] } }, world);
  action.update({ player, state: {}, nowMs: 0 });
  assert.equal(inventory[6055], 0);
  assert.deepEqual(clicks.at(-1), { kind: "object", name: "Herb patch", clickType: 1 });
});


test("farm patches: no rake, no raking; the same click without effect is left with why (validation #61)", () => {
  const patches = [{ id: 8150, x: 3058, y: 3311, name: "Herb patch", options: ["Rake", "Inspect", "Guide"] }];
  const spec = { site: [3058, 3311], patches: [{ id: 8150, x: 3058, y: 3311, kind: "herb" }], seeds: { herb: [], allotment: [] } };
  const without = fakeWorld(patches, { items: {} });
  const noRake = createFarmPatchesAction(spec, without.world);
  const state = {};
  assert.equal(noRake.update({ player: without.player, state, nowMs: 0 }), "success");
  assert.equal(without.clicks.length, 0, "no click without a rake");
  assert.match(noRake.describe({ state, player: without.player }), /geen rake/);
  // A rake, and a patch whose options never change: four clicks, then it is left.
  const stuck = fakeWorld(patches, { items: { 5341: 1 } });
  const raking = createFarmPatchesAction(spec, stuck.world);
  const again = {};
  for (let turn = 0; turn < 6; turn += 1) raking.update({ player: stuck.player, state: again, nowMs: turn * 5_000 });
  assert.equal(stuck.clicks.filter((click) => click.kind === "object").length, 4);
  assert.match(raking.describe({ state: again, player: stuck.player }), /rake x4 zonder effect/);
});

test("farm patches: one rake click, left alone while the weeds come, then plant (bot-logs 23-11, farming_falador 57% idle)", () => {
  // The Farming plugin restarts the raking on every click: the first weed 6 ticks (3,6 s) after
  // it, then one per 4 ticks. A click every 2,4 s never got a weed.
  const patches = [{ id: 8150, x: 3058, y: 3311, name: "Herb patch", options: ["Rake", "Inspect", "Guide"] }];
  const { world, player, clicks, inventory } = fakeWorld(patches, { items: { 5291: 1, 5341: 1 } });
  const action = createFarmPatchesAction({ site: [3058, 3311], patches: [{ id: 8150, x: 3058, y: 3311, kind: "herb" }],
    seeds: { herb: ["GUAM_SEED"], allotment: [] } }, world);
  const state = {};
  const weedAt = [3_600, 6_000, 8_400];
  for (let nowMs = 0; nowMs <= 9_600; nowMs += 2_400) {
    for (const at of weedAt) if (at <= nowMs && at > nowMs - 2_400) inventory[6055] = (inventory[6055] ?? 0) + 1;
    if (nowMs >= 8_400) patches[0].options = ["Inspect", "Guide"];
    action.update({ player, state, nowMs });
  }
  assert.equal(clicks.filter((click) => click.kind === "object").length, 1, "one rake click for the whole patch");
  for (let nowMs = 12_000; nowMs <= 16_800; nowMs += 2_400) action.update({ player, state, nowMs });
  assert.deepEqual(clicks.at(-1), { kind: "item", itemId: 5291, name: "Herb patch" });
});
