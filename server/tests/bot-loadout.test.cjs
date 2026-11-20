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
