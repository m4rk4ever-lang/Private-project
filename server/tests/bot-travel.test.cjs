// Run: node --test tests/bot-travel.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createTravel, destinationsFor, hangoutsFor, hubsFor, hubFor, MIN_TRAVEL_TILES, data } = require("../plugins/bots/brain/Travel.PlayerBots");

class Location {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  getX() { return this.x; }
  getY() { return this.y; }
  getZ() { return this.z; }
}

function harness({ level = 99, combat = 126, at = { x: 3222, y: 3218, z: 0 }, wilderness = false, fighting = false, name = "bot" } = {}) {
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
    getUsername: () => name,
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
  const travel = createTravel({ core, random: () => 0, chance: 1, hangoutChance: 0, minigameChance: 0 });
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
    createTravel({ core, random: () => 0.5, chance, hangoutChance: 0 })(player, {}, activity, 0);
    return teleports.length;
  };
  assert.equal(stay({}, { mode: "pvp" }), 0);
  assert.equal(stay({ fighting: true }), 0);
  assert.equal(stay({ wilderness: true }), 0);
  assert.equal(stay({}, { mode: "fishing" }, 0.4), 0);
  assert.equal(stay({}), 1);
});

const MODES = ["woodcutting", "mining", "fishing", "combat_training", "thieving"];
const inWilderness = (place) => place.x >= 2944 && place.x <= 3391 && place.y >= 3520 && place.y < 4000;

test("every hangout is valid: unique, weighted, outside the Wilderness, hubs name real modes", () => {
  const ids = new Set();
  for (const place of data.hangouts) {
    assert.ok(!ids.has(place.id), place.id);
    ids.add(place.id);
    assert.ok(Number.isInteger(place.x) && Number.isInteger(place.y), place.id);
    assert.ok((place.weight ?? 1) > 0, place.id);
    assert.ok(!inWilderness(place), `${place.id} is in the Wilderness`);
    for (const mode of place.hubFor ?? []) assert.ok(MODES.includes(mode), `${place.id}: ${mode}`);
    if (place.combatGear) assert.ok(place.minCombat >= 70, `${place.id} is a lobby for high-level bots`);
  }
  for (const key of ["chance", "hangoutChance", "ownHubChance"]) {
    assert.ok(data[key] >= 0 && data[key] <= 1, key);
  }
});

test("every mode has a hub at every level; Lumbridge only for beginners, Prifddinas from combat 90", () => {
  for (const mode of MODES) {
    for (const [level, combat] of [[1, 3], [50, 60], [99, 126]]) {
      assert.ok(hubsFor(mode, level, combat).length > 0, `${mode} ${level}`);
    }
  }
  assert.ok(hubsFor("fishing", 10, 20).some((hub) => hub.id === "lumbridge_castle"));
  assert.ok(!hubsFor("fishing", 70, 90).some((hub) => hub.id === "lumbridge_castle"));
  assert.ok(!hubsFor("mining", 99, 80).some((hub) => hub.id === "prifddinas"));
  assert.ok(hubsFor("mining", 99, 100).some((hub) => hub.id === "prifddinas"));
  // A hub fits the job: no miner lives at the Catherby fishing bank.
  assert.ok(!hubsFor("mining", 50, 60).some((hub) => hub.id === "catherby_bank"));
  // Boss and raid lobbies are no one's home.
  assert.ok(!hubsFor("combat_training", 99, 126).some((hub) => hub.combatGear));
});

test("a bot keeps its hubs, and bots spread over different hubs", () => {
  assert.equal(hubFor("Zezima", "fishing", 80, 100).id, hubFor("Zezima", "fishing", 80, 100).id);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(hubFor(`bot${i}`, "fishing", 80, 100).id);
  assert.ok(seen.size >= 3, [...seen].join(","));
});

test("at a hangout a bot goes to its own hub, roams there, and a lobby puts on combat gear", () => {
  const { core, player, teleports } = harness({ level: 80, combat: 100, name: "Zezima" });
  const geared = [];
  const travel = createTravel({ core, random: () => 0, chance: 1, hangoutChance: 1, ownHubChance: 1, minigameChance: 0,
    bankstandChance: 0, equipCombatGear: (bot) => geared.push(bot) });
  const state = { roaming: {} };
  const place = travel(player, state, { mode: "fishing" }, 0);
  assert.equal(place.hangout, true);
  assert.equal(place.activity, "roam");
  assert.equal(place.id, hubFor("Zezima", "fishing", 80, 100).id);
  assert.equal(teleports.length, 1);
  assert.deepEqual(state.home, { x: place.x, y: place.y, z: place.z ?? 0 });
  assert.equal(state.roaming.roamBounds, null, "a hub has no bounds");
  assert.equal(geared.length, 0);

  // With the highest roll the weighted pick lands on the last fitting hangout; make it a lobby.
  const lobbies = data.hangouts.filter((hangout) => hangout.combatGear);
  const pick = createTravel({ core, random: () => 0.999, chance: 1, hangoutChance: 1, ownHubChance: 0, minigameChance: 0,
    equipCombatGear: (bot) => geared.push(bot) });
  const original = data.hangouts.slice();
  data.hangouts.splice(0, data.hangouts.length, ...lobbies);
  try {
    const lobbyPlace = pick(player, {}, { mode: "combat_training" }, 0);
    assert.ok(lobbyPlace.combatGear);
    assert.equal(geared.length, 1);
  } finally {
    data.hangouts.splice(0, data.hangouts.length, ...original);
  }
});

test("at a busy bank a bot may stand and craft instead of walking around", () => {
  const { core, player } = harness({ name: "Banker" });
  const travel = createTravel({ core, random: () => 0, chance: 1, hangoutChance: 1, ownHubChance: 1, minigameChance: 0, bankstandChance: 1 });
  const place = travel(player, {}, { mode: "woodcutting" }, 0);
  assert.equal(place.hangout, true);
  assert.equal(place.activity, place.bankstand ? "bankstand" : "roam");
  assert.ok(data.hangouts.some((hangout) => hangout.bankstand && hangout.id === "grand_exchange"));
});

test("every minigame lobby is valid: requirements, bounds around the arrival tile, no Wilderness", () => {
  const ids = new Set();
  for (const game of data.minigames) {
    assert.ok(!ids.has(game.id), game.id);
    ids.add(game.id);
    const [minX, minY, maxX, maxY] = game.bounds;
    assert.ok(minX <= game.x && game.x <= maxX && minY <= game.y && game.y <= maxY, `${game.id} arrives inside its bounds`);
    assert.ok(maxX - minX <= 20 && maxY - minY <= 20, `${game.id} keeps its group together`);
    assert.ok(!inWilderness(game), game.id);
    assert.ok(game.maxGroup >= 4, game.id);
    assert.ok(game.minCombat || Object.keys(game.requires ?? {}).length > 0, `${game.id} has a requirement`);
    for (const skill of Object.keys(game.requires ?? {})) assert.match(skill, /^[A-Z]+$/, game.id);
  }
  assert.ok(ids.has("wintertodt") && ids.has("castle_wars") && ids.has("soul_wars"));
});

test("bots gather at a minigame in groups, dressed for it and kept inside the lobby", () => {
  const worn = [];
  const levels = { FIREMAKING: 99, RUNECRAFTING: 1, FISHING: 1, SMITHING: 1, FARMING: 1, MAGIC: 1 };
  const makeBot = (name) => {
    const h = harness({ name, combat: 30 });
    h.core.Skill = { ...h.core.Skill, FIREMAKING: "FIREMAKING", RUNECRAFTING: "RUNECRAFTING", SMITHING: "SMITHING", FARMING: "FARMING", MAGIC: "MAGIC" };
    h.player.getSkillManager = () => ({ getMaxLevel: (skill) => levels[skill] ?? 99, getCombatLevel: () => 30 });
    return h;
  };
  const { core } = makeBot("x");
  const travel = createTravel({ core, random: () => 0, chance: 1, minigameChance: 1, wear: (bot, items) => worn.push(items) });
  for (let i = 0; i < 3; i++) {
    const { player } = makeBot(`Firemaker${i}`);
    const state = { roaming: {} };
    const place = travel(player, state, { mode: "woodcutting" }, 0);
    // Combat 30 and only Firemaking: Wintertodt is the one game it may join.
    assert.equal(place.minigame, "wintertodt");
    assert.equal(state.roaming.roamBounds.minX, place.bounds[0]);
  }
  assert.equal(travel.attendance.get("wintertodt").size, 3);
  assert.equal(worn.length, 3);
  assert.equal(worn[0].body, "PYROMANCER_GARB");
  // The next switch ends the stay.
  const { player } = makeBot("Firemaker0");
  travel(player, { roaming: {} }, { mode: "pvp" }, 0);
  assert.equal(travel.attendance.get("wintertodt").size, 2);
});

test("company draws company, and a full lobby takes no more", () => {
  const { minigamesFor } = require("../plugins/bots/brain/Travel.PlayerBots");
  const { core, player } = harness({ combat: 126 });
  core.Skill = new Proxy({}, { get: (_, key) => key });
  const empty = minigamesFor(player, core, 126, new Map());
  const castle = (entries) => entries.find((entry) => entry.game.id === "castle_wars");
  const busy = minigamesFor(player, core, 126, new Map([["castle_wars", new Set(["a", "b", "c"])]]));
  assert.ok(castle(busy).weight > castle(empty).weight);
  const max = data.minigames.find((game) => game.id === "castle_wars").maxGroup;
  const full = minigamesFor(player, core, 126, new Map([["castle_wars", new Set(Array.from({ length: max }, (_, i) => `b${i}`))]]));
  assert.equal(castle(full), undefined);
});

test("a low-level bot never ends up in a raid or boss lobby", () => {
  for (const place of hangoutsFor(40, null)) assert.ok(!place.combatGear, place.id);
});
