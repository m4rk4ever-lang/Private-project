"use strict";

// HuntBirds checks its own snares, resets a missed one, and lays no more than its level allows.
// Bots clicked the first caught snare near them (often another bot's: "This isn't your trap.") and
// kept laying past the limit, counting the refusal against the tile and walking off their own
// snare: 525 bot-minutes for 23 OSRS-XP an hour on the crimson swift beach (bot-logs 23-11-2026).

const test = require("node:test");
const assert = require("node:assert/strict");
const { H } = require("../plugins/skills/hunter/Context.Hunter");
const { createHuntBirdsAction } = require("../plugins/bots/brain/actions/HuntBirds.PlayerBots");

class Location {
  constructor(x, y, z = 0) { this.x = x; this.y = y; this.z = z; }
  getX() { return this.x; } getY() { return this.y; } getZ() { return this.z; }
}
const SNARE = 10006;
const OPTIONS = { 9373: ["Check", "Reset"], 9344: ["Dismantle", "Reset"], 9345: ["Dismantle", "Investigate"] };
const object = (id, x, y) => ({ getId: () => id, getLocation: () => new Location(x, y) });

function setup({ snares = 2, level = 1 } = {}) {
  const clicks = [];
  const laid = [];
  const inventory = { getAmount: (id) => (id === SNARE ? snares : 0), getFreeSlots: () => 20, getItems: () => [{ getId: () => SNARE }] };
  const player = {
    at: new Location(2608, 2926),
    getLocation() { return this.at; },
    busy: () => false,
    getInventory: () => inventory,
    getMovementQueue: () => ({ size: () => 0, walkToObject: (target, { execute }) => { clicks.push(target); execute(); } }),
    getSkillManager: () => ({ getCurrentLevel: () => level }),
    getWildernessLevel: () => 0,
  };
  const core = {
    ItemIdentifiers: { BIRD_SNARE: SNARE, SMALL_FISHING_NET: 303, ROPE: 954 },
    ObjectDefinition: { forId: (id) => ({ getName: () => "Bird snare", getInteractions: () => OPTIONS[id] ?? [] }) },
    MapObjects: { getHash: () => 0, mapObjects: { get: () => [] } },
    World: { getNpcsNear: () => [] },
    GroundItemManager: null,
    Location,
  };
  const world = { core, emitObjectInteraction: (event) => clicks.push(event), useItem: (_p, _slot, option) => { laid.push(option); return true; } };
  const action = createHuntBirdsAction({ site: [2609, 2926], radius: 8 }, world);
  return { action, player, clicks, laid, state: {} };
}

test("hunter: checks its own caught snare, not another bot's", (t) => {
  const { action, player, clicks, state } = setup();
  const other = { player: {}, state: "caught", location: new Location(2607, 2926), objects: [object(9373, 2607, 2926)] };
  const mine = { player, state: "caught", location: new Location(2610, 2926), objects: [object(9373, 2610, 2926)] };
  H.traps.clear(); H.traps.add(other); H.traps.add(mine);
  t.after(() => H.traps.clear());
  action.update({ player, state, nowMs: 10_000 });
  const event = clicks.find((entry) => entry.clickType);
  assert.ok(event, "a trap was clicked");
  assert.equal(event.object.getLocation().getX(), 2610, "its own snare");
  assert.equal(event.clickType, 1, "Check");
});

test("hunter: a missed snare is reset at once", (t) => {
  const { action, player, clicks, state } = setup();
  H.traps.clear(); H.traps.add({ player, state: "failed", location: new Location(2610, 2926), objects: [object(9344, 2610, 2926)] });
  t.after(() => H.traps.clear());
  action.update({ player, state, nowMs: 10_000 });
  const event = clicks.find((entry) => entry.clickType);
  assert.equal(event?.clickType, 2, "Reset (the second option)");
});

test("hunter: at its trap limit it lays no more and does not refuse the tile", (t) => {
  const { action, player, laid, state } = setup({ snares: 2, level: 1 });
  H.traps.clear();
  H.data ??= { traps: { bird: {} } };
  H.traps.add({ player, kind: "bird", state: "idle", location: new Location(2609, 2926), objects: [object(9345, 2609, 2926)] });
  H.traps.add({ player, kind: "bird", state: "idle", location: new Location(2607, 2926), objects: [object(9345, 2607, 2926)] });
  t.after(() => H.traps.clear());
  for (let now = 10_000; now < 40_000; now += 2_000) action.update({ player, state, nowMs: now });
  assert.deepEqual(laid, [], "no Lay past the limit (2 from level 1)");
  assert.equal(state.huntBirds.refused?.size ?? 0, 0);
  assert.match(action.describe({ player, state }), /own=idle\/idle limit=2/);
});
