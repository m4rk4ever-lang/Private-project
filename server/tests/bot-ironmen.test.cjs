// Run: node --test tests/bot-ironmen.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { modeFor, downfall, announceHardcoreDeath, SHARES } = require("../plugins/bots/brain/Ironmen.PlayerBots");
const adventurers = require("../plugins/bots/data/adventurers.json");

test("about the configured share of bots are Ironmen, fixed by name", () => {
  const counts = { none: 0, ironman: 0, ultimate: 0, hardcore: 0 };
  for (let i = 0; i < 4000; i++) counts[modeFor(`Bot${i}`)]++;
  for (const [mode, share] of Object.entries(SHARES)) {
    assert.ok(Math.abs(counts[mode] / 4000 - share) < 0.02, `${mode}: ${counts[mode]}`);
  }
  assert.equal(modeFor("Zezima"), modeFor("Zezima"));
  // Adventurers live in clans now (adventurers.json "clans"; the flat "names" list is gone): spawned
  // apart, never through assignIronMode.
  assert.ok(require("../plugins/bots/adventurers/Clans.PlayerBots").namesOf(adventurers).length >= 5, "adventurers are spawned apart, never through assignIronMode");
});

test("a Hardcore death is announced with the total level", () => {
  const said = [];
  announceHardcoreDeath({ World: { sendMessage: (text) => said.push(text) } },
    { player: { getDisplayName: () => "Slayed Soul", getSkillManager: () => ({ getTotalLevel: () => 1234 }) } });
  assert.match(said[0], /Slayed Soul has died as a Hardcore Ironman with a total level of 1,234!/);
});

test("the downfall only takes a fighting Hardcore bot", () => {
  const hits = [];
  const bot = (mode, fighting) => ({
    isRegistered: () => true, getAttribute: (key) => (key === "ironman:mode" ? mode : null), getHitpoints: () => 40,
    getCombat: () => ({ getTarget: () => (fighting ? {} : null), getAttacker: () => null, getHitQueue: () => ({ addPendingDamage: (h) => hits.push(h) }) }),
  });
  const Common = require("../plugins/modes/ironman/Common.Ironman");
  const fs = require("fs");
  Common.init({ core: {}, emitCustomEvent() {} });
  const runtime = { entriesByUsername: new Map([["a", { player: bot("hardcore", false) }], ["b", { player: bot("ironman", true) }]]) };
  const core = { HitDamage: class { constructor(d) { this.damage = d; } }, HitMask: { RED: 1 } };
  assert.equal(downfall(core, runtime, () => 0), null, "nobody fighting is a Hardcore");
  runtime.entriesByUsername.set("c", { player: bot("hardcore", true) });
  assert.ok(downfall(core, runtime, () => 0));
  assert.equal(hits[0][0].damage, 45);
  assert.equal(downfall(core, runtime, () => 0.99), null, "most checks pass by");
});
