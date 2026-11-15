// Run after `yarn build`: node --test tests/staff-zone.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { ItemIdentifiers } = require("../dist/util/ItemIdentifiers");
const { NpcIdentifiers } = require("../dist/util/NpcIdentifiers");
const { MAX_INSTANCE_CHUNKS } = require("../dist/game/model/areas/impl/TemplatedInstanceArea");
const StaffZone = require("../plugins/world/staffzone/StaffZone.plugin");

const { data, staffShopIds, freeInStaffShops, noSellingToStaffShops } = StaffZone._test;

test("every staff shop item is a cache item", () => {
  for (const shop of data.shops) {
    assert.ok(shop.items.length > 0, `${shop.name} has stock`);
    for (const name of shop.items) assert.ok(Number.isInteger(ItemIdentifiers[name]), `${shop.name}: ${name}`);
  }
});

test("every staff NPC is a cache NPC", () => {
  for (const spec of [data.banker, data.dummy, ...data.shops]) {
    assert.ok(Number.isInteger(NpcIdentifiers[spec.npc]), spec.npc);
  }
});

test("every placed tile is inside the copied vault, and the copy fits an instance", () => {
  const { sourceChunkX, sourceChunkY, chunks } = data.template;
  assert.ok(chunks <= MAX_INSTANCE_CHUNKS);
  const inside = ([x, y]) => x >= sourceChunkX * 8 && x < (sourceChunkX + chunks) * 8
    && y >= sourceChunkY * 8 && y < (sourceChunkY + chunks) * 8;
  for (const tile of [data.entry, data.banker.tile, data.dummy.tile, ...data.shops.map((shop) => shop.tile)]) {
    assert.ok(inside(tile), JSON.stringify(tile));
  }
});

test("staff shops are free and buy nothing back; other shops are untouched", () => {
  const [staffShop] = staffShopIds;
  const buy = { shopId: staffShop, price: 5000 };
  freeInStaffShops(buy);
  assert.equal(buy.price, 0);
  const sell = { shopId: staffShop, sellable: true };
  noSellingToStaffShops(sell);
  assert.equal(sell.sellable, false);
  const other = { shopId: 1, price: 5000, sellable: true };
  freeInStaffShops(other);
  noSellingToStaffShops(other);
  assert.deepEqual(other, { shopId: 1, price: 5000, sellable: true });
});
