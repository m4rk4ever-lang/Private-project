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

test("a gathering job carries one way to teleport: jewellery, else Varrock's runes, else one tablet", () => {
  const { travelKit, KIT_RUNES } = require("../plugins/bots/adventurers/Loadout.PlayerBots");
  // Other jobs: a small set, not all it owns (Markbot 18's full bag, 21-11-2026).
  const other = travelKit({ mode: "combat_training", magic: 60, hasJewellery: true, tablets: ["ARDOUGNE_TELEPORT", "WATCHTOWER_TELEPORT", "SALVE_GRAVEYARD_TELEPORT"] });
  assert.equal(other.jewellery, 2);
  assert.equal(other.runes.length, 5);
  assert.deepEqual(other.tablets, ["ARDOUGNE_TELEPORT"]);
  assert.deepEqual(travelKit({ mode: "combat_training", magic: 10, tablets: ["ARDOUGNE_TELEPORT", "WATCHTOWER_TELEPORT", "SALVE_GRAVEYARD_TELEPORT"] }).tablets, ["ARDOUGNE_TELEPORT", "WATCHTOWER_TELEPORT"]);
  assert.deepEqual(travelKit({ mode: "mining", magic: 60, hasJewellery: true, tablets: ["VARROCK_TELEPORT"] }).jewellery, 1);
  assert.deepEqual(travelKit({ mode: "mining", magic: 60, hasJewellery: true }).runes, [], "no runes beside the jewellery");
  assert.deepEqual(travelKit({ mode: "fishing", magic: 30 }).runes, [...KIT_RUNES]);
  assert.deepEqual(travelKit({ mode: "woodcutting", magic: 10, tablets: ["VARROCK_TELEPORT", "CAMELOT_TELEPORT"] }).tablets, ["VARROCK_TELEPORT"]);
  assert.equal(travelKit({ mode: "woodcutting", magic: 10 }).text, "geen");
});

test("teleport jewellery is bought with coins to spare, one of each kind, never its savings", () => {
  const Loadout = require("../plugins/bots/adventurers/Loadout.PlayerBots");
  const names = ["GAMES_NECKLACE_8_", "RING_OF_DUELING_8_", "SKILLS_NECKLACE_4_", "AMULET_OF_GLORY_4_", "RING_OF_WEALTH_5_"];
  const price = { GAMES_NECKLACE_8_: 900, RING_OF_DUELING_8_: 800, SKILLS_NECKLACE_4_: 12_000, AMULET_OF_GLORY_4_: 13_000, RING_OF_WEALTH_5_: 13_500 };
  const kindOf = (name) => name.replace(/_\d+_$/, "");
  const buys = (coins, extra = {}) => Loadout.travelBuys(names, { coins, kindOf, priceOf: (name) => price[name], ...extra });
  // Under 50k coins: nothing extra.
  assert.deepEqual(buys(40_000), []);
  // 100k: 3% is 3,000 to spend, each piece at most 2,000: the necklace and the ring of dueling.
  assert.deepEqual(buys(100_000), ["GAMES_NECKLACE_8_", "RING_OF_DUELING_8_"]);
  // 2M: all five (39k of 60k); kinds it has are skipped; never more than the bag holds.
  assert.deepEqual(buys(2_000_000), names);
  assert.deepEqual(buys(2_000_000, { have: new Set(["AMULET_OF_GLORY", "GAMES_NECKLACE"]) }), ["RING_OF_DUELING_8_", "SKILLS_NECKLACE_4_", "RING_OF_WEALTH_5_"]);
  assert.deepEqual(buys(2_000_000, { bagCoins: 2_000 }), ["GAMES_NECKLACE_8_", "RING_OF_DUELING_8_"]);
  assert.deepEqual(buys(2_000_000, { buyable: (name) => name !== "RING_OF_WEALTH_5_" }), names.slice(0, 4));
});

test("teleport tablets are bought as a stack of 5, priced as a whole, after the jewellery", () => {
  const Loadout = require("../plugins/bots/adventurers/Loadout.PlayerBots");
  const list = ["GAMES_NECKLACE_8_", { name: "SALVE_GRAVEYARD_TELEPORT", amount: 5 }, { name: "CATHERBY_TELEPORT", amount: 5 }];
  const price = { GAMES_NECKLACE_8_: 900, SALVE_GRAVEYARD_TELEPORT: 700, CATHERBY_TELEPORT: 900 };
  const kindOf = (name) => name;
  // 200k: 6k to spend, 4k a piece: the necklace (900) and Salve (3,500) fit, Catherby (4,500) is over a piece's share.
  assert.deepEqual(Loadout.travelBuys(list, { coins: 200_000, kindOf, priceOf: (name) => price[name] }),
    ["GAMES_NECKLACE_8_", { name: "SALVE_GRAVEYARD_TELEPORT", amount: 5 }]);
  // A kind it has (two or more tablets, or the spell) is skipped.
  assert.deepEqual(Loadout.travelBuys(list, { coins: 1_000_000, kindOf, priceOf: (name) => price[name], have: new Set(["SALVE_GRAVEYARD_TELEPORT"]) }),
    ["GAMES_NECKLACE_8_", { name: "CATHERBY_TELEPORT", amount: 5 }]);
});

test("food before a fight: a few pieces left are not enough for a 20-40 minute stretch; it tops up", () => {
  const { fightFoodToFetch, FIGHT_FOOD_MIN } = require("../plugins/bots/adventurers/Loadout.PlayerBots");
  // Metrics 22/23-11-2026: fights begun on 0-2 pieces ended "out of food" or "low hp, no food" in
  // 38 of 50 (Jorgbot 3, Markbot 11, Kram539 with 1 piece); the old rule fetched food only with none.
  assert.equal(fightFoodToFetch({ carried: 1, want: 14 }), 13, "one lobster left: tops up to 14");
  assert.equal(fightFoodToFetch({ carried: 0, want: 14 }), 14);
  assert.equal(fightFoodToFetch({ carried: FIGHT_FOOD_MIN - 1, want: 14 }), 14 - FIGHT_FOOD_MIN + 1);
  assert.equal(fightFoodToFetch({ carried: FIGHT_FOOD_MIN, want: 14 }), 0, "enough for 20 minutes: straight to the fight");
  assert.equal(fightFoodToFetch({ carried: 10, want: 14 }), 0);
  assert.ok(FIGHT_FOOD_MIN >= 5 && FIGHT_FOOD_MIN <= 10, `about a third of a piece a minute for 20 minutes, got ${FIGHT_FOOD_MIN}`);
  assert.equal(fightFoodToFetch({ carried: 3, want: 4 }), 1, "a small foodAmount is the bar itself");
});
