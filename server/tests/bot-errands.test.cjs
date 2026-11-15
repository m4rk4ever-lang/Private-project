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
