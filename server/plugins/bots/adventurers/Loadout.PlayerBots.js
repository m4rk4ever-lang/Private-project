"use strict";

/**
 * What a job carries (AI_Constitution §19, Phase 4b): the rest goes into the bank at the bank
 * visit it makes anyway, so the bag has room for what the job gathers.
 *
 * Why: during woodcutting, mining and fishing about 10 of 28 slots held things the job does not
 * use (metrics 20-11-2026, 278 bot lines): food 3.7, travel things 2.8, other things 1.7 (a bucket,
 * a pot, silk, spare weapons, a spade), coins 0.9, tools 0.8. 160 of 206 of those jobs ended on a
 * full bag: a smaller bag is more bank trips.
 *
 * First step: gathering jobs only. Food by the place (foodFor): none where it is safe for its
 * combat level, a little where it is not, more when the bank is far. Other things out. Travel
 * things (runes, tablets, jewellery) stay: the errands teleport with them.
 *
 * Plain logic, no game core: each item's kind comes in through `kindOf(itemId)`:
 *   "keep"  stays (the job's tools, coins, runes and teleports, quest items, kit, materials)
 *   "food"  stays up to `foodKeep` pieces
 *   anything else goes in the bank.
 */
const GATHERING = new Set(["woodcutting", "mining", "fishing"]);
/** Food a gathering job keeps when its place is not known yet (the old, careful default). */
const GATHERING_FOOD = 2;
/** A bank this close to the place: little food is enough, it restocks on the way to bank anyway. */
const NEAR_BANK_TILES = 30;
/** Food at a dangerous place: enough to walk away, more when the bank is far. */
const DANGER_FOOD_NEAR = 2;
const DANGER_FOOD_FAR = 5;

/**
 * How much food a gathering job carries, and why in words (the log, ::volg): none at a place that
 * is safe for its combat level, a little at a dangerous one, more when the bank is far.
 * `danger`: null (safe), { text } (why it is not), or undefined (place not known: the old default).
 */
function foodFor({ danger, bankTiles = Infinity, combat = null } = {}) {
  const bank = Number.isFinite(bankTiles) ? `bank op ${Math.round(bankTiles)} tegels` : "geen bank in de buurt";
  if (danger === undefined) return { food: GATHERING_FOOD, reason: "plek nog onbekend" };
  if (!danger) return { food: 0, reason: `veilige plek${combat ? ` voor combat ${combat}` : ""}, ${bank}` };
  const near = bankTiles <= NEAR_BANK_TILES;
  return { food: near ? DANGER_FOOD_NEAR : DANGER_FOOD_FAR, reason: `${danger.text}, ${bank}` };
}

/** The goods to bank for this job: [{ itemId, amount }]. Empty for jobs without a loadout yet. */
function offLoadout(items, { mode, kindOf, foodKeep = GATHERING_FOOD } = {}) {
  if (!GATHERING.has(mode) || typeof kindOf !== "function") return [];
  const out = new Map();
  let food = foodKeep;
  for (const item of items ?? []) {
    if (!item || !(item.itemId > 0) || !(item.amount > 0)) continue;
    const kind = kindOf(item.itemId);
    if (kind === "keep") continue;
    if (kind === "food") {
      const kept = Math.min(item.amount, food);
      food -= kept;
      if (item.amount > kept) out.set(item.itemId, (out.get(item.itemId) ?? 0) + item.amount - kept);
      continue;
    }
    out.set(item.itemId, (out.get(item.itemId) ?? 0) + item.amount);
  }
  return [...out].map(([itemId, amount]) => ({ itemId, amount }));
}

module.exports = { offLoadout, foodFor, GATHERING, GATHERING_FOOD, NEAR_BANK_TILES };
