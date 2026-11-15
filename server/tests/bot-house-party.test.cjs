// Run: node --test tests/bot-house-party.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const HouseParty = require("../plugins/bots/brain/HouseParty.PlayerBots");

class PlayerHouseInstance {}

function loc(x, y, z = 0) {
  return { getX: () => x, getY: () => y, getZ: () => z };
}

function actor(name, items = []) {
  const inv = items.slice();
  const p = {
    area: null, at: loc(3200, 3200),
    getUsername: () => name, getDisplayName: () => name, isRegistered: () => true,
    getLocation: () => p.at, moveTo: (to) => { p.at = to; },
    getPrivateArea: () => p.area,
    getMovementQueue: () => ({ walkToObject: (object, { execute }) => execute() }),
    getCombat: () => ({ getAttacker: () => null }),
    getInventory: () => ({ getItems: () => inv, add: (item) => inv.push(item), refreshItems() {}, getAmount: (id) => inv.filter((i) => i.getId() === id).reduce((s, i) => s + i.getAmount(), 0) }),
    inv,
  };
  return p;
}

const item = (id, amount = 1) => ({ getId: () => id, getAmount: () => amount });

test("a host builds its house, opens a party; fighters with bones visit, offer on the altar and go back", () => {
  const events = [];
  const altar = { getId: () => 13197, getLocation: () => loc(10, 10) };
  const burner = { getId: () => 13210, getLocation: () => loc(11, 10) };
  const host = actor("host", []);
  const fighter = actor("fighter", Array.from({ length: 12 }, () => item(526)));
  const hostEntry = { player: host, state: {}, brain: { paused: false } };
  const fighterEntry = { player: fighter, state: { honest: true }, brain: { paused: false } };
  const entries = new Map([["fighter", fighterEntry]]);
  const api = {
    core: {
      Location: class { constructor(x, y, z) { return loc(x, y, z); } },
      Item: class { constructor(id, amount) { return item(id, amount); } },
      ItemIdentifiers: { TINDERBOX: 590 },
      Inventory: { INTERFACE_ID: 3214 },
      ItemDefinition: { forId: (id) => ({ getName: () => (id === 526 ? "Bones" : "Thing") }) },
    },
    emitCustomEvent: (name, payload) => {
      events.push(name);
      if (name === "construction:furnished-house") { payload.handled = true; payload.player.area = new PlayerHouseInstance(); }
      if (name === "construction:visit-house") payload.player.area = new PlayerHouseInstance();
      if (name === "construction:exit-house") payload.player.area = null;
    },
  };
  const runtime = {
    entriesByUsername: entries,
    spawnPvpBot: () => { entries.set("host", hostEntry); return host; },
  };
  const world = {
    objectSearch: { findCandidatesByIds: (player, ids) => (ids === "altar" ? [altar] : [burner, burner]) },
    emitObjectInteraction: (event) => events.push(`object:${event.option}`),
    emitItemOnObject: (event) => {
      events.push("bones-on-altar");
      fighter.inv.length = 0;
    },
  };
  let clock = 0;
  const going = new Map();
  const errands = {
    go: (entry, to, { arrive }) => { going.set(entry.player, arrive); entry.brain.paused = true; return true; },
    busy: (player) => going.has(player),
  };
  const party = HouseParty.createHouseParty({ api, runtime, world, errands, now: () => clock, catalog: ({ catalog }) => (catalog === "houseAltar" ? "altar" : "burner"), levels: () => {} });
  party.keepHost(clock);
  assert.ok(events.includes("construction:furnished-house"), "the host gets its house");
  assert.equal(hostEntry.brain.paused, true, "the host stays put");
  clock += 30_000;
  party.keepHost(clock);
  assert.equal(HouseParty.isOpen(), true, "the party is on");
  assert.ok(events.includes("object:Light") && events.includes("construction:advertise-house"));
  party.inviteGuests(clock);
  assert.equal(going.size, 1, "it walks to the portal");
  assert.equal(fighterEntry.brain.paused, true);
  const arrive = going.get(fighter);
  going.delete(fighter);
  fighterEntry.brain.paused = false;
  arrive(fighter);
  assert.equal(party.guests.size, 1);
  assert.equal(fighterEntry.brain.paused, true, "it waits in the house");
  party.advanceGuests(clock);
  assert.ok(events.includes("construction:visit-house"));
  clock += 3000;
  party.advanceGuests(clock);
  assert.ok(events.includes("bones-on-altar"));
  clock += 7000;
  party.advanceGuests(clock);
  assert.equal(party.guests.size, 0, "out of bones: back to work");
  assert.ok(events.includes("construction:exit-house"));
  assert.equal(fighterEntry.brain.paused, false);
});
