// Run: node --test tests/bot-ironmen.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const Ironmen = require("../plugins/bots/brain/Ironmen.PlayerBots");
const { modeFor, announceHardcoreDeath, SHARES } = Ironmen;
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

test("a Hardcore bot never dies by chance: no forced hit, only the fight's own (owner, 22-11-2026)", () => {
  assert.equal(Ironmen.downfall, undefined);
  const submitted = [];
  Ironmen.startIronmen({ core: {}, onCustomEvent() {}, getTaskManager: () => ({ submit: (task) => submitted.push(task) }) }, {});
  assert.deepEqual(submitted, [], "no downfall task");
});
