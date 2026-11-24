"use strict";

// BarrowsRun in the tunnels, with a fake Barrows view: after a door's "crossed" the bot stands on
// the doorway tile, which roomAt still counts to the room it left. It planned the same door again
// and stepped back (Markbot 14, Markbot 18, Patrickbot 15, validatie ceefe7a, 24-11-2026). Now it
// walks the corridor to the door on the next room's wall and goes through that one.

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBarrowsRun } = require("../plugins/bots/adventurers/BarrowsRun.PlayerBots.js");

class Location {
  constructor(x, y, z = 0) { this.x = x; this.y = y; this.z = z; }
  getX() { return this.x; }
  getY() { return this.y; }
  getZ() { return this.z; }
}

const centre = (room) => ({ x: 3534 + (room % 3) * 17, y: 9712 - Math.floor(room / 3) * 17, z: 0 });
const roomAt = (x, y) => {
  for (let room = 0; room < 9; room += 1) {
    const c = centre(room);
    if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) <= 7) return room;
  }
  return -1;
};

/** A door object as the plugin's map has it, sides as doorSides gives them. */
function door(x, y, orientation, varbit, id) {
  const sides = orientation === 0 ? [[x - 1, y], [x, y]] : orientation === 2 ? [[x, y], [x + 1, y]]
    : orientation === 1 ? [[x, y], [x, y + 1]] : [[x, y - 1], [x, y]];
  return { x, y, id, varbit, orientation, sides: sides.map(([sx, sy]) => ({ x: sx, y: sy, room: roomAt(sx, sy) })) };
}

function harness({ doors, links, openDoors, start }) {
  const player = {
    at: new Location(start[0], start[1], 0),
    visited: [],
    clicks: [],
    getLocation() { return this.at; },
    getMovementQueue() {
      return {
        // A walk lands at once (the corridor is open; the test is about which tile it aims at).
        requestWalk: (to) => { player.at = new Location(to.getX(), to.getY(), 0); player.visited.push([to.getX(), to.getY()]); },
        size: () => 0,
        walkToObject: () => {},
      };
    },
    getCombat: () => ({ getAttacker: () => null }),
    getInventory: () => ({ getItems: () => [] }),
    getPrivateArea: () => null,
  };
  const objects = doors.map((entry) => ({ entry, getId: () => entry.id, getLocation: () => new Location(entry.x, entry.y, 0) }));
  const core = {
    Location,
    MapObjects: {
      getHash: (x, y, z) => `${x},${y},${z}`,
      mapObjects: { get: (hash) => objects.filter((object) => `${object.entry.x},${object.entry.y},0` === hash) },
    },
    ObjectDefinition: { forId: (id) => ({ id }) },
    World: { getNpcsNear: () => [] },
  };
  const view = () => ({
    phase: "tunnels",
    room: roomAt(player.at.x, player.at.y),
    run: { tunnel: 0, killed: [0, 1, 2, 3, 4, 5], openDoors, looted: false },
    brother: null,
    crossing: false,
    lastDoor: null,
    brothers: [],
    links,
    doors,
    ladders: [],
    chest: { x: 3551, y: 9695, id: 1 },
    roomCentre: centre,
    puzzleOpen: false,
  });
  const api = {
    emitCustomEvent: (name, request) => { if (name === "barrows:bot-view") request.view = view(); },
  };
  // The plugin's useDoor: from exactly one side tile, across to the other.
  const world = {
    emitObjectInteraction: ({ object }) => {
      const sides = object.entry.sides;
      const index = sides.findIndex((side) => side.x === player.at.x && side.y === player.at.y);
      player.clicks.push({ door: [object.entry.x, object.entry.y], from: [player.at.x, player.at.y] });
      if (index < 0) return;
      const to = sides[1 - index];
      player.at = new Location(to.x, to.y, 0);
    },
  };
  const metrics = [];
  const run = createBarrowsRun({ core, api, world, note: () => {}, metric: (line) => metrics.push(line),
    walkTo: () => true, errandBusy: () => false, castHome: () => {} });
  const entry = { name: "Testbot", player };
  run.start(entry, 0);
  entry.barrows.step = "tunnel";
  return { run, entry, player, metrics };
}

test("barrows tunnels: after crossing a door it walks the corridor to the next room, not back", () => {
  // Link 0-1 (varbit 472): door at room 0's wall at 3541,9712 (as in Markbot 18's log), and the
  // pair on room 1's wall at 3545, whose outer tile 3544 roomAt also counts to room 1.
  const doors = [
    door(3541, 9712, 0, 472, 20), door(3541, 9713, 0, 472, 21),
    door(3545, 9712, 0, 472, 22), door(3545, 9713, 0, 472, 23),
    door(3557, 9705, 3, 473, 24),
  ];
  const links = [{ varbit: 472, a: 0, b: 1 }, { varbit: 473, a: 1, b: 4 }];
  const { run, entry, player, metrics } = harness({ doors, links, openDoors: [472, 473], start: [3536, 9712] });
  let now = 0;
  let reached = false;
  for (let i = 0; i < 30 && !reached; i += 1) {
    now += 3_100;
    const result = run.tick(entry, now);
    assert.equal(result, "running", `tick ${i}: ${entry.barrows.why}`);
    reached = player.at.x === 3545 && roomAt(player.at.x, player.at.y) === 1;
  }
  assert.ok(reached, `in room 1 at last: ${JSON.stringify(player.clicks)}`);
  // Never back through room 0's door from its doorway tile (the old loop).
  assert.ok(!player.clicks.some((click) => click.door[0] === 3541 && click.from[0] === 3541), JSON.stringify(player.clicks));
  assert.deepEqual(player.clicks.map((click) => click.from[0]), [3540, 3544]);
  // From room 1 on to the chest room by the next door.
  run.tick(entry, now + 3_100);
  assert.equal(entry.barrows.step, "tunnel 1→4");
  assert.equal(entry.barrows.passage, null);
  assert.equal(metrics.length, 0);
});

test("barrows tunnels: a long corridor (0-2 by the north wall) is walked to room 2's door", () => {
  // Varbit 469 as in Markbot 14's log: door on room 2's north wall at 3568,9718 (orientation 3,
  // sides 9717/9718), and the pair on room 0's north wall at 3534,9718.
  const doors = [
    door(3534, 9718, 3, 469, 30), door(3535, 9718, 3, 469, 31),
    door(3568, 9718, 3, 469, 32), door(3569, 9718, 3, 469, 33),
  ];
  const links = [{ varbit: 469, a: 0, b: 2 }, { varbit: 475, a: 2, b: 5 }, { varbit: 478, a: 4, b: 5 }];
  const { run, entry, player } = harness({ doors: [...doors, door(3568, 9706, 1, 475, 34), door(3568, 9689, 1, 478, 35)],
    links, openDoors: [469, 475, 478], start: [3534, 9712] });
  let now = 0;
  for (let i = 0; i < 30 && !(roomAt(player.at.x, player.at.y) === 2 && player.at.y === 9717); i += 1) {
    now += 3_100;
    assert.equal(run.tick(entry, now), "running", entry.barrows.why);
  }
  assert.equal(roomAt(player.at.x, player.at.y), 2);
  assert.equal(player.at.y, 9717);
  assert.deepEqual(player.clicks.map((click) => click.from), [[3534, 9717], [3568, 9718]]);
});

test("barrows run: a failed run logs its tile as where, not as the metric's time", () => {
  const doors = [door(3541, 9712, 0, 472, 20)];
  const { run, entry, metrics } = harness({ doors, links: [{ varbit: 472, a: 0, b: 1 }], openDoors: [], start: [3536, 9712] });
  run.tick(entry, 3_100);
  const line = metrics.find((entry2) => entry2.kind === "barrows_run");
  assert.ok(line, "a failed run writes barrows_run");
  assert.equal(line.at, undefined);
  assert.deepEqual(line.where, [3536, 9712, 0]);
});
