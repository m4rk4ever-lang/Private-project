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
