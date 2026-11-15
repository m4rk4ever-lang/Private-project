// Run after `yarn build`: node --test tests/bot-outfits.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { ItemIdentifiers } = require("../dist/util/ItemIdentifiers");
const { rollOutfit, outfitTier } = require("../plugins/bots/brain/SiteSpawner.PlayerBots");

/** A seeded generator, so the counts below are the same every run. */
function seeded(seed) {
  let h = seed >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crowd(tier, options, count = 500) {
  const random = seeded(42);
  return Array.from({ length: count }, () => rollOutfit(tier, { ...options, random }));
}

test("every item a bot can wear is a cache item", () => {
  for (const tier of ["novice", "mid", "advanced", "elite", "master"]) {
    for (const mode of ["woodcutting", "mining", "fishing", "combat_training"]) {
      for (const outfit of crowd(tier, { mode, skillLevel: 99 }, 200)) {
        for (const name of Object.values(outfit)) assert.ok(Number.isInteger(ItemIdentifiers[name]), `${tier}: ${name}`);
      }
    }
  }
});

test("a crowd varies: most outfits are unique, many go without a cape, no cape dominates", () => {
  const outfits = crowd("novice", { mode: "mining" });
  const unique = new Set(outfits.map((outfit) => JSON.stringify(outfit)));
  assert.ok(unique.size > outfits.length * 0.9, `${unique.size} unique of ${outfits.length}`);
  const capes = outfits.map((outfit) => outfit.cape).filter(Boolean);
  assert.ok(capes.length < outfits.length * 0.5, "most beginners wear no cape");
  const counts = new Map();
  for (const cape of capes) counts.set(cape, (counts.get(cape) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) < outfits.length * 0.05, "no single cape is common");
});

test("skill outfits from the advanced tier up, skill capes only at 99, nothing of either for beginners", () => {
  const has = (outfits, prefix) => outfits.filter((outfit) => Object.values(outfit).some((name) => name.startsWith(prefix))).length;
  assert.equal(has(crowd("novice", { mode: "fishing" }), "ANGLER"), 0);
  assert.ok(has(crowd("master", { mode: "fishing" }), "ANGLER") > 100);
  assert.equal(crowd("master", { mode: "mining", skillLevel: 98 }).filter((outfit) => outfit.cape === "MINING_CAPE").length, 0);
  assert.ok(crowd("master", { mode: "mining", skillLevel: 99 }).filter((outfit) => outfit.cape === "MINING_CAPE").length > 250);
});

test("the outfit tier follows the level, with masters from 80", () => {
  assert.equal(outfitTier(79), "elite");
  assert.equal(outfitTier(80), "master");
  assert.equal(outfitTier({ all: [90, 99] }), "master");
});
