"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBuryBonesAction } = require("../plugins/bots/brain/actions/BuryBones.PlayerBots");

const BONES = 526;
const BIG_BONES = 532;

function setup(items) {
  const bag = items.map((id) => (id ? { getId: () => id } : null));
  const clicks = [];
  const world = {
    core: { ItemIdentifiers: { BONES, BIG_BONES } },
    useItem: (player, slot, option) => {
      clicks.push([slot, option]);
      bag[slot] = null;
      return true;
    },
  };
  const player = { getInventory: () => ({ getItems: () => bag }) };
  return { action: createBuryBonesAction({ bones: ["BONES", "BIG_BONES"] }, world), player, clicks };
}

test("buries each bone by its Bury option, paced, then succeeds", () => {
  const { action, player, clicks } = setup([BONES, null, BIG_BONES, 995]);
  const frame = {};
  assert.equal(action.update({ player, nowMs: 0, frame }), "running");
  assert.equal(action.update({ player, nowMs: 500, frame }), "running");
  assert.deepEqual(clicks, [[0, "Bury"]]);
  assert.equal(action.update({ player, nowMs: 1500, frame }), "running");
  assert.deepEqual(clicks, [[0, "Bury"], [2, "Bury"]]);
  assert.equal(action.update({ player, nowMs: 3000, frame }), "success");
  assert.equal(frame.lastProgressAt, 1500);
});

test("nothing to bury is done at once", () => {
  const { action, player, clicks } = setup([995]);
  assert.equal(action.update({ player, nowMs: 0 }), "success");
  assert.equal(clicks.length, 0);
});
