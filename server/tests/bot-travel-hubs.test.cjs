// Run: node --test tests/bot-travel-hubs.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const Hubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
const data = require("../plugins/bots/data/travel-hubs.json");

const map = {
  hubs: { a: [0, 0], b: [200, 0], c: [400, 0], d: [600, 0], river: [150, 150] },
  links: [["a", "b", 210], ["b", "c", 205], ["c", "d", 220]],
};

test("a short walk needs no hub, a long one goes hub to hub along checked links", () => {
  assert.equal(Hubs.nextLeg({ x: 10, y: 0 }, { x: 200, y: 0 }, null, map), null);
  assert.equal(Hubs.nextLeg({ x: 0, y: 0 }, { x: 600, y: 0 }, null, map).key, "b");
  assert.equal(Hubs.nextLeg({ x: 202, y: 1 }, { x: 600, y: 0 }, null, map).key, "c");
  assert.equal(Hubs.nextLeg({ x: 0, y: 0, z: 0 }, { x: 600, y: 0, z: 1 }, null, map), null);
});

test("a hub it could not reach is left out and another chain is tried", () => {
  const leg = Hubs.nextLeg({ x: 0, y: 0 }, { x: 600, y: 0 }, new Set(["b"]), map);
  assert.notEqual(leg?.key, "b");
});

test("the real hubs lead from Lumbridge to the Gnome Stronghold course, Seers, Yanille and Edgeville", () => {
  const graph = { hubs: data.hubs, links: data.links };
  const [lx, ly] = data.hubs.lumbridge;
  for (const goal of ["gnome_agility", "seers", "yanille", "edgeville"]) {
    const [gx, gy] = data.hubs[goal];
    let here = { x: lx, y: ly, z: 0 };
    const seen = [];
    for (let step = 0; step < 20; step += 1) {
      const leg = Hubs.nextLeg(here, { x: gx, y: gy, z: 0 }, null, graph);
      if (!leg) break;
      assert.ok(!seen.includes(leg.key), `${goal}: loops at ${leg.key} (${seen.join(" > ")})`);
      seen.push(leg.key);
      here = { x: leg.x, y: leg.y, z: 0 };
    }
    assert.ok(Math.max(Math.abs(here.x - gx), Math.abs(here.y - gy)) <= Hubs.DIRECT_TILES, `${goal}: ends at ${seen.at(-1)}`);
  }
});

test("the Gnome Stronghold and Canifis are joined to Lumbridge's network (links counted on the collision map, 20-11-2026)", () => {
  const Hubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
  const joined = Hubs.connectedTo("lumbridge");
  for (const key of ["gnome_stronghold_gate", "gnome_agility", "canifis"]) assert.ok(joined.has(key), key);
  // Canifis on foot only after Priest in Peril.
  assert.equal(Hubs.onFoot({ x: 3494, y: 3485 }, null, () => false), false);
  assert.equal(Hubs.onFoot({ x: 3494, y: 3485 }, null, () => true), true);
});

test("into Morytania only by its own hubs: not straight across the Salve from Digsite (collision-map audit, 20-11-2026)", () => {
  const Hubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
  const mortTon = { x: 3506, y: 3304, z: 0 };
  // From Digsite (146 tiles straight, across the river) it does not walk at it: the hubs lead on.
  const first = Hubs.nextLeg({ x: 3360, y: 3410, z: 0 }, mortTon);
  assert.ok(first, "a hub, not a straight walk");
  assert.notEqual(first.key, "digsite");
  // Inside Morytania a short walk goes straight.
  assert.equal(Hubs.nextLeg({ x: 3494, y: 3485, z: 0 }, { x: 3428, y: 3537, z: 0 }), null);
  assert.equal(Hubs.onFoot(mortTon, null, () => true), true);
  assert.equal(Hubs.onFoot(mortTon, null, () => false), false);
});

test("Karamja: across by boat (Port Sarim, Ardougne, Rimmington), not on foot (collision-map audit, 20-11-2026)", () => {
  const Hubs = require("../plugins/bots/behaviours/navigation/TravelHubs.PlayerBots");
  const musa = { x: 2918, y: 3176, z: 0 };
  // Reached through a boat whose dock it can walk to.
  assert.equal(Hubs.onFoot(musa, null, () => true), true);
  // Shilo Village (Duradel) only after its quest, Karamja or not.
  assert.equal(Hubs.onFoot({ x: 2869, y: 2982, z: 0 }, null, () => false), false);
  assert.equal(Hubs.onFoot({ x: 2869, y: 2982, z: 0 }, null, () => true), true);
  // The boats: from Lumbridge to Musa Point Captain Tobias, back with the customs officer,
  // Ardougne to Brimhaven with Captain Barnaby; none on the same side of the water.
  assert.deepEqual(Hubs.boatFor({ x: 3222, y: 3218, z: 0 }, musa).npcs[0], "Captain Tobias");
  assert.deepEqual(Hubs.boatFor(musa, { x: 3212, y: 3428, z: 0 }).npcs, ["Customs officer"]);
  assert.deepEqual(Hubs.boatFor({ x: 2662, y: 3305, z: 0 }, { x: 2760, y: 3178, z: 0 }).options, ["Brimhaven"]);
  assert.equal(Hubs.boatFor({ x: 3222, y: 3218, z: 0 }, { x: 3212, y: 3428, z: 0 }), null);
  assert.equal(Hubs.boatFor(musa, { x: 2869, y: 2982, z: 0 }), null);
  // The mainland beside it stays mainland: Rimmington, Port Sarim.
  assert.equal(Hubs.boatArea({ x: 2957, y: 3215, z: 0 }), null);
  assert.equal(Hubs.boatArea({ x: 3041, y: 3193, z: 0 }), null);
});
