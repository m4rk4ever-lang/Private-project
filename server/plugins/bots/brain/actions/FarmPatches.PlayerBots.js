"use strict";

/**
 * A farm run at one farming spot (a herb patch and two allotments by a tool leprechaun), as a
 * player does it: rake the weeds (and drop them), pick what has grown, clear what died (spade),
 * and plant the best seed it carries for each patch (a herb seed, three allotment seeds) with the
 * seed dibber. Then on: the crops grow while it does other things, and the adventurer comes back
 * when they are due. The Farming plugin owns every rule (levels, growth, disease, XP); this only
 * clicks the patch's own options and uses the seed on it.
 *
 * spec: { site: [x, y], patches: [{ id, x, y, kind: "herb" | "allotment" }], seeds: { herb: [names, best first], allotment: [...] } }.
 */
const STEP_MS = 2_400;
/** A patch planted, or one it tried to plant twice: done for this visit. */
const PLANT_TRIES = 2;

function createFarmPatchesAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] farmPatches requires api.core");
  const ids = (names) => (names ?? []).map((name) => core.ItemIdentifiers[name]).filter(Number.isInteger);
  const seeds = { herb: ids(spec.seeds?.herb), allotment: ids(spec.seeds?.allotment) };
  const perPatch = { herb: 1, allotment: 3 };
  const weeds = core.ItemIdentifiers.WEEDS;
  const spade = core.ItemIdentifiers.SPADE;

  const seenOf = (object, player) => {
    try {
      return core.ObjectDefinition.forPlayer?.(object.getId(), player) ?? core.ObjectDefinition.forId(object.getId());
    } catch {
      return core.ObjectDefinition.forId(object.getId());
    }
  };

  /**
   * The spot's patches as this player sees them: { object, definition, options, kind }. By the
   * patch's own id and tile (farming-data.json): a patch is a varbit object whose base name says
   * nothing, and its options change with its state (Rake, Inspect, Guide, Pick, Clear, Cure).
   */
  const spots = (spec.patches ?? []).filter((patch) => Number.isInteger(patch.id) && perPatch[patch.kind]);
  function patches(player) {
    const found = [];
    for (const spot of spots) {
      const object = (core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(spot.x, spot.y, 0)) ?? [])
        .find((candidate) => candidate.getId() === spot.id);
      if (!object) continue;
      const definition = seenOf(object, player);
      const options = (definition?.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
      found.push({ object, definition, options, kind: spot.kind });
    }
    return found;
  }

  function click(player, patch, option) {
    const at = patch.object.getLocation();
    player.getMovementQueue().walkToObject(patch.object, {
      execute: () => world.emitObjectInteraction?.({
        player, object: patch.object, definition: patch.definition, objectId: patch.object.getId(),
        clickType: patch.options.indexOf(option) + 1, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      }),
    });
  }

  function useOn(player, patch, itemId) {
    const items = player.getInventory().getItems() ?? [];
    const slot = items.findIndex((item) => item?.getId?.() === itemId);
    if (slot < 0) return false;
    const at = patch.object.getLocation();
    player.getMovementQueue().walkToObject(patch.object, {
      execute: () => world.emitItemOnObject?.({
        player, object: patch.object, objectId: patch.object.getId(), itemId, item: items[slot], itemSlot: slot, interfaceType: 0,
        location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      }),
    });
    return true;
  }

  const key = (patch) => `${patch.object.getLocation().getX()},${patch.object.getLocation().getY()}`;

  return {
    id: "farmPatches",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.farmPatches ??= { at: 0, tries: new Map() });
      if (nowMs < bot.at || player.busy?.() || player.getMovementQueue().size() > 0) return "running";
      bot.at = nowMs + STEP_MS;
      // The weeds a rake brings up: dropped, as a player does.
      const weedSlot = (player.getInventory().getItems() ?? []).findIndex((item) => item?.getId?.() === weeds);
      if (weedSlot >= 0 && world.useItem?.(player, weedSlot, "Drop")) return "running";
      if (player.getInventory().getFreeSlots() <= 0) return "success";
      const here = patches(player);
      if (here.length === 0) return "failed";
      for (const patch of here) {
        const can = (option) => patch.options.includes(option);
        if (can("rake")) { click(player, patch, "rake"); return "running"; }
        const pick = ["harvest", "pick"].find(can);
        if (pick) { click(player, patch, pick); return "running"; }
        // Dead (Clear) or diseased (Cure: it has no cure with it): dug up with the spade.
        if (can("clear") || can("dig")) { click(player, patch, can("clear") ? "clear" : "dig"); return "running"; }
        if (can("cure") && player.getInventory().getAmount(spade) > 0 && useOn(player, patch, spade)) return "running";
      }
      // Planting: each patch once, then once more (one growing already refuses the seed).
      const order = [...here].sort((a, b) => (bot.tries.get(key(a)) ?? 0) - (bot.tries.get(key(b)) ?? 0));
      for (const patch of order) {
        const tries = bot.tries.get(key(patch)) ?? 0;
        if (tries >= PLANT_TRIES) continue;
        const seed = seeds[patch.kind].find((id) => player.getInventory().getAmount(id) >= perPatch[patch.kind]);
        bot.tries.set(key(patch), PLANT_TRIES);
        if (seed === undefined) continue;
        bot.tries.set(key(patch), tries + 1);
        if (useOn(player, patch, seed)) return "running";
      }
      return "success";
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.farmPatches = null;
    },
  };
}

module.exports = { createFarmPatchesAction };
