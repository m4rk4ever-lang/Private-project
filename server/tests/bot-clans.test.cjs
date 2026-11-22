"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Clans = require("../plugins/bots/adventurers/Clans.PlayerBots");
const data = require("../plugins/bots/data/adventurers.json");

test("three clans of equal size, each with its leader as a member", () => {
  assert.equal(data.clans.length, 3);
  assert.ok(Clans.equalSizes(data));
  for (const clan of data.clans) assert.ok(clan.members.includes(clan.leader));
  const leaders = Object.fromEntries(data.clans.map((clan) => [clan.name, clan.leader]));
  assert.deepEqual(leaders, { "Jorg Clan": "Bekoek", "Patrick Clan": "Slayed Soul", "Mark Clan": "Call me Mark" });
  assert.equal(Clans.clanOf(data, "Eeshwar").name, "Patrick Clan");
  assert.equal(Clans.clanOf(data, "Kram539").name, "Mark Clan");
  const names = Clans.namesOf(data);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(name.length <= 12, name);
});

test("clanmates give only what they really have spare", () => {
  const banks = { a: 1000, b: 100 };
  const given = Clans.gift(["a", "b"], 1511, 700, {
    spare: (mate) => banks[mate] - 500,
    take: (mate, amount) => { banks[mate] -= amount; return amount; },
  });
  assert.deepEqual(given, [{ mate: "a", amount: 500 }]);
  assert.equal(banks.a, 500);
  assert.equal(banks.b, 100);
});

test("after a restart the clans log in one by one in turn, the first clan from loginFirstClan (A8, 22-11-2026)", () => {
  const Clans = require("../plugins/bots/adventurers/Clans.PlayerBots");
  const data = { loginFirstClan: "Mark Clan", clans: [
    { name: "Jorg Clan", members: ["J1", "J2", "J3"] },
    { name: "Patrick Clan", members: ["P1", "P2"] },
    { name: "Mark Clan", members: ["M1", "M2", "M3"] },
  ] };
  assert.deepEqual(Clans.loginOrder(data), ["M1", "J1", "P1", "M2", "J2", "P2", "M3", "J3"]);
  assert.deepEqual(Clans.namesOf(data), ["J1", "J2", "J3", "P1", "P2", "M1", "M2", "M3"], "namesOf unchanged");
  assert.deepEqual(Clans.loginOrder({ names: ["A", "B"] }), ["A", "B"], "no clans: as listed");
});
