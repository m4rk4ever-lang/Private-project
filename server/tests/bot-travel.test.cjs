// Run: node --test tests/bot-travel.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createTravel, destinationsFor, MIN_TRAVEL_TILES, data } = require("../plugins/bots/brain/Travel.PlayerBots");

class Location {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  getX() { return this.x; }
  getY() { return this.y; }
  getZ() { return this.z; }
}

function harness({ level = 99, combat = 126, at = { x: 3222, y: 3218, z: 0 }, wilderness = false, fighting = false } = {}) {
  const teleports = [];
  const core = {
    Location,
    Skill: { WOODCUTTING: "wc", MINING: "mining", FISHING: "fishing" },
    Wilderness: { isIn: () => wilderness },
    TeleportType: { NORMAL: "normal" },
    TeleportHandler: { teleport: (player, target, type) => teleports.push({ target, type }) },
  };
  const player = {
    getLocation: () => new Location(at.x, at.y, at.z),
    getSkillManager: () => ({ getMaxLevel: () => level, getCombatLevel: () => combat }),
    getCombat: () => ({ getTarget: () => (fighting ? {} : null), getAttacker: () => null }),
    getUsername: () => "bot",
    moveTo: (target) => teleports.push({ target, type: "move" }),
  };
  return { core, player, teleports };
}

test("every destination is valid and none is in the Wilderness", () => {
  assert.ok(data.destinations.length >= 25);
  const ids = new Set();
  for (const place of data.destinations) {
    assert.ok(!ids.has(place.id), place.id);
    ids.add(place.id);
    assert.ok(Number.isInteger(place.x) && Number.isInteger(place.y), place.id);
    assert.ok(place.modes.length > 0, place.id);
    // The Wilderness starts at y 3520 on the surface (x 2944-3391).
    const wildernessSurface = place.x >= 2944 && place.x <= 3391 && place.y >= 3520 && place.y < 4000;
    assert.ok(!wildernessSurface, `${place.id} is in the Wilderness`);
  }
});

test("a level 1 bot only travels to beginner places; a level 99 bot can go anywhere it fits", () => {
  const low = destinationsFor("woodcutting", 1, null).map((place) => place.id);
  assert.ok(low.includes("lumbridge"));
  assert.ok(!low.includes("woodcutting_guild"));
  const high = destinationsFor("woodcutting", 99, null).map((place) => place.id);
  assert.ok(high.includes("woodcutting_guild") && high.includes("sorcerers_tower_magics"));
  assert.ok(destinationsFor("combat_training", 126, null).some((place) => place.id === "slayer_tower"));
  assert.ok(!destinationsFor("combat_training", 60, null).some((place) => place.id === "slayer_tower"));
});

test("a place right next to the bot is not worth a teleport", () => {
  const here = { x: 3222, y: 3218, z: 0 };
  const near = destinationsFor("fishing", 99, here).map((place) => place.id);
  assert.ok(!near.includes("lumbridge"));
  assert.ok(MIN_TRAVEL_TILES > 0);
});

test("a switch teleports the bot and moves its home there", () => {
  const { core, player, teleports } = harness();
  const travel = createTravel({ core, random: () => 0, chance: 1 });
  const state = { home: { x: 3222, y: 3218, z: 0 } };
  const place = travel(player, state, { mode: "mining" }, 0);
  assert.ok(place && place.modes.includes("mining"));
  assert.equal(teleports.length, 1);
  assert.equal(teleports[0].type, "normal");
  assert.deepEqual(state.home, { x: place.x, y: place.y, z: place.z ?? 0 });
});

test("no travel for PvP, in a fight, in the Wilderness, or when the roll says stay", () => {
  const stay = (options, activity = { mode: "fishing" }, chance = 1) => {
    const { core, player, teleports } = harness(options);
    createTravel({ core, random: () => 0.5, chance })(player, {}, activity, 0);
    return teleports.length;
  };
  assert.equal(stay({}, { mode: "pvp" }), 0);
  assert.equal(stay({ fighting: true }), 0);
  assert.equal(stay({ wilderness: true }), 0);
  assert.equal(stay({}, { mode: "fishing" }, 0.4), 0);
  assert.equal(stay({}), 1);
});
