// A clan learns what its jobs earn and how they go, over restarts (action-fit analysis A3,
// 22-11-2026: "eens proberen" was 87% of the money jobs, meant 1 in 10).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createKnowledge, KNOWN_AFTER } = require("../plugins/bots/adventurers/Knowledge.PlayerBots");
const { chooseNext } = require("../plugins/bots/adventurers/Planner.PlayerBots");

test("per clan a median of its jobs, kept over a restart, the window capped", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-knowledge-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "knowledge.json");
  let clock = 0;
  const writes = [];
  const knowledge = createKnowledge({ file, now: () => clock, write: (text) => { writes.push(text); fs.writeFileSync(file, text); } });
  for (const gp of [2000, 3000, 2800, 2500, 9000]) {
    knowledge.record("Mark Clan", ["mode:thieving", "activity:gem_stalls"], { gpPerHour: gp, xpPerHour: 20000 });
  }
  knowledge.record("Mark Clan", ["mode:thieving"], { stuck: true });
  knowledge.record("Jorg Clan", ["mode:thieving"], { gpPerHour: 50_000 });
  const mark = knowledge.stats("Mark Clan", "mode:thieving");
  assert.equal(mark.gpPerHour, 2800);
  assert.equal(mark.n, 5);
  assert.equal(mark.stuckRate, 0.17, "the short stuck job counts in Activity Health");
  assert.deepEqual(knowledge.moneyByMode("Mark Clan").thieving, { gpPerHour: 2800, n: 5, known: true });
  assert.equal(knowledge.moneyByMode("Jorg Clan").thieving.known, false, "one job: still untried for that clan");
  assert.equal(writes.length, 1, "written at most once a minute");
  clock += 61_000;
  knowledge.record("Mark Clan", ["mode:fishing"], { gpPerHour: 20_000 });
  const again = createKnowledge({ file, now: () => clock, write: () => {} });
  assert.equal(again.stats("Mark Clan", "mode:thieving").gpPerHour, 2800, "after a restart");
  for (let index = 0; index < 40; index += 1) again.record("Mark Clan", ["mode:mining"], { gpPerHour: index });
  assert.equal(again.stats("Mark Clan", "mode:mining").jobs, 25);
  assert.ok(KNOWN_AFTER >= 3);
});

test("money: its clan's measure beats a guess, and only a way nobody measured is 'eens proberen'", () => {
  const view = {
    levels: { WOODCUTTING: 30, MINING: 30, FISHING: 30, THIEVING: 30, FIREMAKING: 1 }, combat: 30, questPoints: 0, done: new Set(), earn: {},
    clanEarn: { thieving: { gpPerHour: 2800, n: 22, known: true }, fishing: { gpPerHour: 28_000, n: 34, known: true }, mining: { gpPerHour: 90_000, n: 2, known: false } },
  };
  const plan = chooseNext(view, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.9 });
  assert.equal(plan.money, true);
  assert.equal(plan.mode, "fishing", "the clan's 28k beats its 2,8k thieving and an unmeasured guess");
  assert.match(plan.reason, /28\.000 gp\/uur, clan, 34 metingen/);
  // One pick in ten tries what nobody measured (two jobs of mining are not known yet), and says so.
  const trying = chooseNext(view, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.05 });
  assert.equal(trying.reason, "geld verdienen (eens proberen)");
  assert.ok(!["thieving", "fishing"].includes(trying.mode), trying.mode);
  // Its own measure comes before the clan's.
  const own = chooseNext({ ...view, earn: { thieving: 40_000 } }, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.9 });
  assert.equal(own.mode, "thieving");
  assert.match(own.reason, /40\.000 gp\/uur\)$/);
});

test("money: nothing measured picks any way at random; an unmeasured way never beats the lowest measured (validation #57)", () => {
  const base = { levels: { WOODCUTTING: 30, MINING: 30, FISHING: 30, THIEVING: 30, FIREMAKING: 1 }, combat: 30, questPoints: 0, done: new Set(), earn: {} };
  const picks = new Set();
  for (const roll of [0.01, 0.3, 0.6, 0.95]) {
    const plan = chooseNext({ ...base, clanEarn: {} }, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => roll });
    if (plan.money) { assert.equal(plan.reason, "geld verdienen (nog niets gemeten)"); picks.add(plan.mode); }
  }
  assert.ok(picks.size > 1, `spread over ways: ${[...picks]}`);
  // Fishing measured at 2.000: thieving's guess (30.000) no longer wins.
  const plan = chooseNext({ ...base, clanEarn: { fishing: { gpPerHour: 2000, n: 6, known: true } } }, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.9 });
  assert.equal(plan.mode, "fishing");
});

test("money: a crowded way is worth less to the next bot (17 at mithril, validation 4baf1a2)", () => {
  const view = {
    levels: { WOODCUTTING: 30, MINING: 30, FISHING: 30, THIEVING: 30, FIREMAKING: 1 }, combat: 30, questPoints: 0, done: new Set(), earn: {},
    clanEarn: { mining: { gpPerHour: 32_000, n: 9, known: true }, fishing: { gpPerHour: 20_000, n: 9, known: true } },
  };
  const free = chooseNext({ ...view, crowd: { mining: 2 } }, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.9 });
  assert.equal(free.mode, "mining");
  const crowded = chooseNext({ ...view, crowd: { mining: 16 } }, [], { available: new Set(), questChance: 0, moneyChance: 1, random: () => 0.9 });
  assert.equal(crowded.mode, "fishing");
});
