// An id first asked for after the index was set up (an agility course's obstacle) is indexed in the
// regions a search needs, not by a rescan of the whole map plus a rewrite of the dump in the bot's
// own turn: that cost 2,5 s per new id after a restart, up to 19,6 s per agility turn (21-11-2026).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");

// TraversalAssist reads live objects from core's MapObjects; the template is enough here.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (/MapObjects$/.test(request)) return { MapObjects: { mapObjects: new Map(), getHash: (x, y, z) => `${x},${y},${z}` } };
  return originalLoad.call(this, request, ...rest);
};
const { createTraversalAssist } = require("../plugins/bots/lib/TraversalAssist.PlayerBots");
Module._load = originalLoad;

const SEED = 2;
const LATE = 7;
const HERE = 50; // region (0, 50): tiles x 0-63, y 3200-3263
const FAR = (5 << 8) + 50;

function world(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-index-late-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "object-index.json");
  const reads = [];
  const chunks = { [HERE]: [[{ id: SEED, localX: 1, localY: 1, plane: 0 }, { id: LATE, localX: 10, localY: 12, plane: 0 }]], [FAR]: [[{ id: LATE, localX: 3, localY: 3, plane: 0 }]] };
  const api = {
    core: { readTemplateRegion: (regionId) => { reads.push(regionId); return chunks[regionId] ? { chunks: chunks[regionId], settings: {} } : null; } },
    getRegionManager: () => ({
      regions: new Map([[HERE, {}], [FAR, {}]]),
      getRegionid: () => ({ isLoaded: () => false }),
      regionIdForTile: () => HERE,
    }),
    log() {},
  };
  const index = createTraversalAssist(api, { objectIds: [SEED], cachePath: file });
  assert.equal(index.initializePersistentIndex({ forceRescan: true }), true, "the boot scan ran");
  const player = { getLocation: () => ({ getX: () => 5, getY: () => 3205, getZ: () => 0 }), getPrivateArea: () => null };
  return { index, file, reads, player };
}

test("a late id is found from the regions near the bot, without a full rescan or a new dump", (t) => {
  const { index, file, reads, player } = world(t);
  const dumpBefore = fs.readFileSync(file, "utf8");
  reads.length = 0;
  const found = index.findNearestIndexedLocation(player, [LATE], { regionRadius: 0 });
  assert.deepEqual(found, { x: 10, y: 3212, z: 0 }, "the late object is found");
  assert.deepEqual(reads, [HERE], "only its own region was read");
  assert.equal(fs.readFileSync(file, "utf8"), dumpBefore, "the dump was not rewritten");
  assert.match(dumpBefore, /"ids":"2"/, "the dump keeps the boot set");
  reads.length = 0;
  index.findNearestIndexedLocation(player, [LATE], { regionRadius: 0 });
  assert.deepEqual(reads, [], "a second search reads nothing");
});

test("a wide search covers at most 16 regions per call, nearest first", (t) => {
  const { index, reads, player } = world(t);
  reads.length = 0;
  index.findNearestIndexedLocation(player, [LATE], { regionRadius: 8 });
  assert.equal(reads.length, 16);
  assert.equal(reads[0], HERE, "its own region first");
});
