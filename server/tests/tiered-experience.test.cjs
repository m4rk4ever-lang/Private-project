// Run: node --test tests/tiered-experience.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const TieredExperience = require("../plugins/skills/TieredExperience.plugin");

const { applyTier, rateForLevel, init } = TieredExperience._test;

function withConfig(value) {
  init({ getPluginConfig: (_key, fallback) => (value === undefined ? fallback : value) });
}

function gain(level, multiplier = 1) {
  const event = {
    player: { getSkillManager: () => ({ getMaxLevel: () => level }) },
    skill: {}, experience: 10, allow: null, multiplier,
  };
  applyTier(event);
  return event.multiplier;
}

test("default tiers: x25 below 50, x15 to 79, x10 to 89, x5 from 90", () => {
  withConfig(undefined);
  assert.equal(gain(1), 25);
  assert.equal(gain(49), 25);
  assert.equal(gain(50), 15);
  assert.equal(gain(79), 15);
  assert.equal(gain(80), 10);
  assert.equal(gain(89), 10);
  assert.equal(gain(90), 5);
  assert.equal(gain(99), 5);
});

test("the tier comes on top of another multiplier (a league profile's rate)", () => {
  withConfig(undefined);
  assert.equal(gain(60, 2), 30);
});

test("tiers from the world config replace the defaults, in any order", () => {
  withConfig([{ fromLevel: 70, rate: 2 }, { fromLevel: 1, rate: 10 }]);
  assert.equal(gain(69), 10);
  assert.equal(gain(70), 2);
});

test("an invalid config falls back to the defaults", () => {
  withConfig([{ fromLevel: 0, rate: 5 }, { fromLevel: 10, rate: -1 }, "x"]);
  assert.equal(rateForLevel(1), 25);
});

test("a gain another hook refused is left alone", () => {
  withConfig(undefined);
  const event = { player: { getSkillManager: () => ({ getMaxLevel: () => 1 }) }, skill: {}, allow: false, multiplier: 1 };
  applyTier(event);
  assert.equal(event.multiplier, 1);
});
