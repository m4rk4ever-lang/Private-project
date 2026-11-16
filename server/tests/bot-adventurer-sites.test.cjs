"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pickSite, sitesFor } = require("../plugins/bots/adventurers/Sites.PlayerBots");

const destinations = [
  { id: "far_men", x: 3000, y: 3000, z: 0, modes: ["thieving"], activities: ["pickpocket_men"], maxLevel: 24 },
  { id: "near_men", x: 100, y: 100, z: 0, modes: ["thieving"], activities: ["pickpocket_men"], maxLevel: 24 },
  { id: "stalls", x: 110, y: 110, z: 0, modes: ["thieving"], activities: ["bakery_stalls"], minLevel: 5 },
  { id: "locked", x: 105, y: 105, z: 0, modes: ["thieving"], activities: ["pickpocket_men"], requires: { quests: ["X"] } },
];
const core = { Skill: { THIEVING: "THIEVING" } };
const player = (level) => ({
  getLocation: () => ({ getX: () => 102, getY: () => 101, getZ: () => 0 }),
  getSkillManager: () => ({ getMaxLevel: () => level }),
});
const distance = (from, to) => Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));

test("the nearest site that fits the job, not one for another job", () => {
  const site = pickSite(player(3), { id: "pickpocket_men", mode: "thieving" }, {
    core, distance, random: () => 0, destinations, meets: (who, requires) => !requires,
  });
  assert.equal(site.id, "near_men");
});

test("a stall job goes to the stalls only, from its level", () => {
  assert.deepEqual(sitesFor({ id: "bakery_stalls", mode: "thieving" }, 5, { destinations }).map((p) => p.id), ["stalls"]);
  assert.deepEqual(sitesFor({ id: "bakery_stalls", mode: "thieving" }, 4, { destinations }), []);
});

test("no fitting site: null", () => {
  assert.equal(pickSite(player(1), { id: "chop", mode: "woodcutting" }, { core, distance, destinations, meets: () => true }), null);
});
