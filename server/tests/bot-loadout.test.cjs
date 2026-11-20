// Run: node --test tests/bot-loadout.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { offLoadout, GATHERING_FOOD } = require("../plugins/bots/adventurers/Loadout.PlayerBots");

const AXE = 1351, TUNA = 361, LOBSTER = 379, BUCKET = 1925, SCIMITAR = 1331, LAW = 563, COINS = 995, QUEST = 4250;
const kinds = { [AXE]: "keep", [LAW]: "keep", [COINS]: "keep", [QUEST]: "keep", [TUNA]: "food", [LOBSTER]: "food" };
const kindOf = (id) => kinds[id] ?? "other";
const slot = (itemId, amount = 1) => ({ itemId, amount });

test("a gathering job keeps its tools, travel and quest things and a little food; the rest goes in the bank", () => {
  const bag = [slot(AXE), slot(LAW, 40), slot(COINS, 500), slot(QUEST), slot(BUCKET), slot(SCIMITAR),
    slot(TUNA), slot(TUNA), slot(TUNA), slot(LOBSTER), slot(LOBSTER)];
  const out = offLoadout(bag, { mode: "woodcutting", kindOf });
  const byId = Object.fromEntries(out.map((good) => [good.itemId, good.amount]));
  assert.deepEqual(byId, { [BUCKET]: 1, [SCIMITAR]: 1, [TUNA]: 3 - GATHERING_FOOD, [LOBSTER]: 2 });
});

test("jobs without a loadout yet, and a bag with nothing extra, bank nothing", () => {
  const bag = [slot(TUNA), slot(TUNA), slot(TUNA), slot(BUCKET)];
  assert.deepEqual(offLoadout(bag, { mode: "combat_training", kindOf }), [], "combat keeps its food");
  assert.deepEqual(offLoadout([slot(AXE), slot(TUNA)], { mode: "mining", kindOf }), []);
  assert.deepEqual(offLoadout(bag, { mode: "fishing" }), [], "no kinds, no guessing");
});

test("food by the place: none where it is safe for its level, a little where it is not, more far from a bank", () => {
  const { foodFor, NEAR_BANK_TILES } = require("../plugins/bots/adventurers/Loadout.PlayerBots");
  const safe = foodFor({ danger: null, bankTiles: 12, combat: 45 });
  assert.equal(safe.food, 0);
  assert.equal(safe.reason, "veilige plek voor combat 45, bank op 12 tegels");
  const scorpions = { text: "scorpion (level 14) vallen hem hier aan" };
  assert.equal(foodFor({ danger: scorpions, bankTiles: NEAR_BANK_TILES }).food, 2, "bank near: enough to walk away");
  const far = foodFor({ danger: scorpions, bankTiles: 200 });
  assert.equal(far.food, 5);
  assert.match(far.reason, /scorpion .* bank op 200 tegels/);
  assert.equal(foodFor({ danger: undefined }).food, 2, "place not known yet: the careful default");
});
