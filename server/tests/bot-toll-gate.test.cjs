"use strict";
const test = require("node:test");
const assert = require("node:assert");
require("ts-node").register({ transpileOnly: true });
const { paysToll } = require("../plugins/bots/brain/DoorOpening.PlayerBots");
const { markHonest } = require("../plugins/bots/brain/Honest.PlayerBots");

const player = (coins) => ({ getInventory: () => ({ getAmount: (id) => (id === 995 ? coins : 0) }), getAttribute: () => undefined, setAttribute() {} });

test("an honest bot pays the toll when it carries it, as a player does (there is no way round)", () => {
  assert.equal(paysToll(player(5), "Pay-toll(10gp)"), false);
  assert.equal(paysToll(player(10), "Pay-toll(10gp)"), true);
  assert.equal(paysToll(player(1000), "Pay-toll(10gp)"), true);
  assert.equal(paysToll(player(0), "Open"), true);
  assert.equal(typeof markHonest, "function");
});
