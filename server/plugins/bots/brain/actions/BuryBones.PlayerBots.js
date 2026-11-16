"use strict";

/**
 * Prayer as a player trains it without an altar: the bones in the bag buried one by one, each
 * by its own Bury option (the Prayer plugin gives the XP and plays the animation). Done when no
 * bones are left; the adventurer's planner fetches or buys the next load (buyToTrain PRAYER).
 *
 * spec: { bones: [item keys], everyMs }.
 */
const DEFAULT_BONES = ["BONES", "BIG_BONES", "BAT_BONES", "WOLF_BONES", "BABYDRAGON_BONES", "DRAGON_BONES"];
// A Bury click is 1.2 s apart in the game (2 ticks); a little more, as a player clicks.
const BURY_EVERY_MS = 1400;

function createBuryBonesAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] buryBones requires api.core");
  const ids = new Set((spec.bones ?? DEFAULT_BONES).map((key) => core.ItemIdentifiers[String(key).toUpperCase()]).filter(Number.isInteger));
  const everyMs = Math.max(600, Number(spec.everyMs ?? BURY_EVERY_MS));
  const nextAt = new WeakMap();

  return {
    id: "buryBones",
    update(ctx) {
      const { player, nowMs } = ctx;
      if (!player || !world.useItem) return "failed";
      const items = player.getInventory().getItems() ?? [];
      const slot = items.findIndex((item) => item && ids.has(item.getId()));
      if (slot < 0) return "success";
      if (nowMs < (nextAt.get(player) ?? 0)) return "running";
      nextAt.set(player, nowMs + everyMs);
      world.useItem(player, slot, "Bury");
      ctx.frame && (ctx.frame.lastProgressAt = nowMs);
      return "running";
    },
  };
}

module.exports = { createBuryBonesAction };
