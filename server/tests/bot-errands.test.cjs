// Run: node --test tests/bot-errands.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createErrands, bestTeleport } = require("../plugins/bots/brain/Errands.PlayerBots");

const loc = (x, y, z = 0) => ({ getX: () => x, getY: () => y, getZ: () => z });

function walker(x, y, items = {}, magic = 1) {
  const p = {
    at: loc(x, y),
    getLocation: () => p.at, getUsername: () => "walker", isRegistered: () => true, getHitpoints: () => 10,
    getSpellbook: () => "NORMAL",
    getSkillManager: () => ({ getCurrentLevel: () => magic }),
    getInventory: () => ({ getAmount: (id) => items[id] ?? 0 }),
  };
  return p;
}

test("an errand walks, waits for the bot's legs, and runs its business on arrival", () => {
  let clock = 0;
  const moves = [];
  const errands = createErrands({ now: () => clock, move: (player, x, y) => moves.push([x, y]), clear: () => {} });
  const player = walker(3200, 3200);
  const brain = { paused: false, dispatchMovement: () => {} };
  let arrived = false;
  assert.equal(errands.go({ player, brain }, { x: 3164, y: 3487, z: 0 }, { arrive: () => { arrived = true; } }), true);
  assert.equal(brain.paused, true);
  assert.deepEqual(moves[0], [3164, 3487]);
  assert.equal(errands.go({ player, brain }, { x: 1, y: 1 }), false, "one errand at a time");
  clock += 1000;
  player.at = loc(3165, 3486);
  errands.tick();
  assert.equal(arrived, true);
  assert.equal(brain.paused, false);
});

test("a blocked walk gives up after a minute without getting closer", () => {
  let clock = 0;
  const errands = createErrands({ now: () => clock, move: () => {}, clear: () => {} });
  const player = walker(3200, 3200);
  const brain = { paused: false, dispatchMovement: () => {} };
  let failed = false;
  errands.go({ player, brain }, { x: 3164, y: 3487 }, { fail: () => { failed = true; } });
  errands.tick();
  clock += 61_000;
  errands.tick();
  assert.equal(failed, true);
  assert.equal(brain.paused, false);
});

test("an errand tells how it ended: how long, why it gave up, tiles left (the errand metric)", () => {
  let clock = 0;
  const errands = createErrands({ now: () => clock, move: () => {}, clear: () => {} });
  const brain = { paused: false, dispatchMovement: () => {} };
  // Stands still 10 tiles short of the bank, as a bot behind its wall does.
  const stuck = walker(3100, 3100);
  let failed = null;
  errands.go({ player: stuck, brain }, { x: 3090, y: 3100 }, { fail: (_, outcome) => { failed = outcome; } });
  errands.tick();
  clock += 46_000;
  errands.tick();
  assert.deepEqual(failed, { ms: 46_000, why: "stuck", tilesLeft: 10, teleport: null });
  // Arrives.
  const walking = walker(3200, 3200);
  let arrived = null;
  errands.go({ player: walking, brain }, { x: 3164, y: 3487 }, { arrive: (_, outcome) => { arrived = outcome; } });
  clock += 30_000;
  walking.at = loc(3165, 3486);
  errands.tick();
  assert.deepEqual(arrived, { ms: 30_000, why: null, tilesLeft: 1, teleport: null });
});

test("a teleport is cast only with the level, the runes and a long walk saved", () => {
  const rune = (id, amount) => ({ getId: () => id, getAmount: () => amount });
  const core = {
    Skill: { MAGIC: "MAGIC" },
    SpellTeleports: { getTeleportDestinations: () => [
      { name: "varrock teleport", spellbook: "NORMAL", level: 25, runes: [rune(563, 1), rune(556, 3), rune(554, 1)], destination: loc(3213, 3424) },
      { name: "ardougne teleport", spellbook: "NORMAL", level: 51, runes: [rune(563, 2), rune(555, 2)], destination: loc(2661, 3302) },
    ] },
  };
  const ge = { x: 3164, y: 3487 };
  const runes = { 563: 5, 556: 10, 554: 5, 555: 10 };
  assert.equal(bestTeleport(core, walker(2800, 3200, runes, 30), ge)?.name, "varrock teleport");
  assert.equal(bestTeleport(core, walker(2800, 3200, runes, 20), ge), null, "Magic too low");
  assert.equal(bestTeleport(core, walker(2800, 3200, { 563: 1 }, 30), ge), null, "no runes");
  assert.equal(bestTeleport(core, walker(3200, 3420, runes, 99), ge), null, "already near: walk");
  assert.equal(bestTeleport(core, walker(2400, 3300, runes, 99), { x: 2660, y: 3300 }), null, "ardougne is behind a quest: never for an errand");
});

test("a ring of wealth takes it to the Grand Exchange (Rub 1), not to quest-locked places", () => {
  const ROW_3 = 11984;
  const core = { Skill: { MAGIC: "MAGIC" }, ItemIdentifiers: { RING_OF_WEALTH_3_: ROW_3 } };
  const wealthData = [
    { label: "Grand Exchange", tile: [3163, 3478, 0] },
    { label: "Miscellania", tile: [2534, 3862, 0], quest: { key: "throne_of_miscellania", name: "Throne of Miscellania" } },
    { label: "Falador Park", tile: [2995, 3375, 0] },
  ];
  const holder = (x, y, ids) => ({ ...walker(x, y), getInventory: () => ({ getAmount: () => 0, getItems: () => ids.map((id) => ({ getId: () => id })) }) });
  const ge = { x: 3164, y: 3487 };
  const viaRing = bestTeleport(core, holder(3222, 3218, [ROW_3]), ge, { wealthData });
  assert.deepEqual([viaRing?.kind, viaRing?.index, viaRing?.name], ["jewellery", 1, "Grand Exchange"]);
  // Falador Park is sub-option 3; Miscellania (a quest) is never picked.
  assert.equal(bestTeleport(core, holder(3222, 3218, [ROW_3]), { x: 2990, y: 3380 }, { wealthData })?.index, 3);
  assert.notEqual(bestTeleport(core, holder(3222, 3218, [ROW_3]), { x: 2534, y: 3862 }, { wealthData })?.name, "Miscellania");
  assert.equal(bestTeleport(core, holder(3222, 3218, []), ge, { wealthData }), null, "no ring");
});

test("any tablet with a spell destination is broken for an errand (Salve Graveyard), none into the Wilderness", () => {
  const SALVE = 19619;
  const CEMETERY = 19621;
  const core = {
    Skill: { MAGIC: "MAGIC" }, ItemIdentifiers: {},
    ItemDefinition: { forId: (id) => ({ getName: () => ({ [SALVE]: "Salve graveyard teleport", [CEMETERY]: "Cemetery teleport" })[id] ?? "item" }) },
    ArceuusSpells: { getTeleportDestinations: () => [
      { name: "salve graveyard teleport", destination: loc(3432, 3460) },
      { name: "cemetery teleport", destination: loc(2978, 3763) },
    ] },
  };
  const holder = (ids) => ({ ...walker(3165, 3487), getInventory: () => ({ getAmount: () => 0, getItems: () => ids.map((id) => ({ getId: () => id })) }) });
  const tablet = bestTeleport(core, holder([SALVE]), { x: 3428, y: 3537 });
  assert.deepEqual([tablet?.kind, tablet?.name], ["tablet", "salve graveyard teleport"]);
  assert.equal(bestTeleport(core, holder([CEMETERY]), { x: 2970, y: 3760 }), null, "Wilderness");
});

test("a drop for an empty slot is picked up and worn, whatever it is worth", () => {
  const Loot = require("../plugins/bots/brain/Loot.PlayerBots");
  const HAT = 579;
  const equipped = [];
  const inventory = [];
  const equipment = Array(14).fill(null);
  const player = {
    getUsername: () => "bot", getPrivateArea: () => null, getLocation: () => loc(10, 10),
    getInventory: () => ({ getItems: () => inventory, getAmount: (id) => inventory.filter((i) => i.getId() === id).length }),
    getEquipment: () => ({ getItems: () => equipment }),
  };
  const ground = {
    getPosition: () => loc(11, 10), getPrivateArea: () => null, isPendingRemoval: () => false,
    getItem: () => ({ getId: () => HAT, getAmount: () => 1 }),
  };
  const core = {
    Equipment: { AMMUNITION_SLOT: 13 },
    Inventory: { INTERFACE_ID: 3214 },
    ItemDefinition: { forId: () => ({ getEquipmentType: () => ({ getSlot: () => 0 }) }) },
    EquipPacketListener: { equip: (p, id) => equipped.push(id) },
    ItemOnGroundManager: {
      ownedBy: () => [ground], inventoryCapacity: () => 1, exists: () => true,
      pickup: () => inventory.push({ getId: () => HAT, getAmount: () => 1 }),
    },
  };
  assert.equal(Loot.lootNear(core, player, { valueOf: () => 2 }), ground, "worth 2 gp, but the head is bare");
  assert.equal(Loot.takeStep(core, player, ground, {}), "taken");
  assert.deepEqual(equipped, [HAT]);
  equipment[0] = { getId: () => 1153 };
  assert.equal(Loot.lootNear(core, player, { valueOf: () => 2 }), null, "with a helm on, a cheap hat stays");
});

test("charged jewellery and tablets teleport only to their own places, and only when it saves a walk", () => {
  const GLORY_4 = 1712;
  const VARROCK_TAB = 8007;
  const core = {
    Skill: { MAGIC: "MAGIC" },
    ItemIdentifiers: { VARROCK_TELEPORT: VARROCK_TAB, LUMBRIDGE_TELEPORT: 8008, FALADOR_TELEPORT: 8009, CAMELOT_TELEPORT: 8010 },
    SpellTeleports: { getTeleportDestinations: () => [
      { name: "varrock teleport", spellbook: "NORMAL", level: 25, runes: [], destination: loc(3213, 3424) },
    ] },
  };
  const bag = (ids) => ids.map((id) => ({ getId: () => id, getAmount: () => 1 }));
  const player = (x, y, ids) => ({
    getLocation: () => loc(x, y), getSpellbook: () => "ANCIENT",
    getSkillManager: () => ({ getCurrentLevel: () => 1 }),
    getInventory: () => ({ getItems: () => bag(ids), getAmount: () => 0 }),
  });
  const jewelleryData = [
    { key: "glory", charged: [[GLORY_4, 4]], spent: 1704, destinations: [
      { label: "Edgeville", tile: [3087, 3496, 0] }, { label: "Karamja", tile: [2918, 3176, 0] },
      { label: "Draynor Village", tile: [3105, 3251, 0] }, { label: "Al Kharid", tile: [3293, 3163, 0] }] },
    { key: "slayer", charged: [[11866, 8]], destinations: [{ label: "Slayer Tower", tile: [3429, 3538, 0], quest: { key: "priest_in_peril" } }] },
  ];
  // Far south in the desert, to Draynor bank: the glory's Draynor Village (its third, Rub submenu 3).
  const glory = bestTeleport(core, player(3300, 2800, [GLORY_4]), { x: 3092, y: 3245 }, { jewelleryData });
  assert.equal(glory?.kind, "jewellery");
  assert.equal(glory?.name, "Draynor Village");
  assert.equal(glory?.slot, 0);
  assert.equal(glory?.index, 3);
  assert.equal(bestTeleport(core, player(3300, 2800, [11866]), { x: 3429, y: 3530 }, { jewelleryData }), null, "a quest-locked destination is never used");
  // To the Grand Exchange: a Varrock tablet (the spell is on another book here).
  const tab = bestTeleport(core, player(2800, 3200, [VARROCK_TAB]), { x: 3164, y: 3487 });
  assert.equal(tab?.kind, "tablet");
  // An uncharged glory takes it nowhere.
  assert.equal(bestTeleport(core, player(3300, 2800, [1704]), { x: 3092, y: 3245 }, { jewelleryData }), null);
});

test("make: a tool on a material, the best menu entry that starts, until the material is gone", () => {
  const { createMakeAction } = require("../plugins/bots/brain/actions/Make.PlayerBots");
  const NEEDLE = 1733, LEATHER = 1741, GLOVES = 1059, BOOTS = 1061, BODY = 1129;
  let leather = 3;
  const items = () => [{ getId: () => NEEDLE, getAmount: () => 1 }, ...(leather > 0 ? [{ getId: () => LEATHER, getAmount: () => leather }] : [])];
  let menu = null;
  const tried = [];
  const player = {
    getInventory: () => ({ getItems: items, getAmount: (id) => (id === LEATHER ? leather : id === NEEDLE ? 1 : 0) }),
    setCreationMenu: (value) => { menu = value; },
    getCreationMenu: () => menu,
  };
  const world = {
    emitItemOnItem: () => {
      menu = { getItems: () => [GLOVES, BOOTS, BODY], execute: (id) => { tried.push(id); if (id === BOOTS) leather -= 1; } };
    },
  };
  const action = createMakeAction({ tool: NEEDLE, materials: [LEATHER] }, world);
  let clock = 0;
  const ctx = () => ({ player, nowMs: clock });
  action.update(ctx());
  assert.deepEqual(tried, [BODY], "the top entry first");
  clock += 5000;
  action.update(ctx());
  assert.deepEqual(tried, [BODY, BOOTS], "level too low for a body: boots");
  clock += 1000;
  assert.equal(action.update(ctx()), "running", "making");
  leather = 0;
  assert.equal(action.update(ctx()), "success", "all leather used");
});

test("a Kourend teleport (Wintertodt Camp) is used only after a first visit to Great Kourend", () => {
  const NECKLACE = 3853;
  const pieces = [{ key: "games", charged: [[NECKLACE, 8]], destinations: [
    { label: "Burthorpe", tile: [2898, 3553, 0] },
    { label: "Wintertodt Camp", tile: [1627, 3941, 0], kourend: true },
  ] }];
  const player = {
    getLocation: () => loc(3222, 3218), getSpellbook: () => "NORMAL", getSkillManager: () => ({ getCurrentLevel: () => 1 }),
    getInventory: () => ({ getAmount: () => 0, getItems: () => [{ getId: () => NECKLACE }] }),
  };
  const wintertodt = { x: 1630, y: 3974 };
  const core = { Skill: { MAGIC: "MAGIC" } };
  assert.equal(bestTeleport(core, player, wintertodt, { jewelleryData: pieces, visitedKourend: () => true })?.name, "Wintertodt Camp");
  const before = bestTeleport(core, player, wintertodt, { jewelleryData: pieces, visitedKourend: () => false });
  assert.notEqual(before?.name, "Wintertodt Camp", "not before the ship has been taken once");
});
