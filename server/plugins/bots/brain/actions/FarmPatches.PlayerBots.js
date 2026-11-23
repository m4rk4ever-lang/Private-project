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
/**
 * The same option clicked this often on a patch without its options changing: that patch is left
 * for this visit, with the reason in describe. 6 of 6 stuck at Falador clicked "rake" every turn
 * and nothing happened (validation #61, 23-11-2026).
 */
const SAME_CLICK_LIMIT = 4;
/** Beside a patch (a large object): its option sent at once, as at the ruins (walkToObject's execute did not come). */
const DIRECT_TILES = 4;

function createFarmPatchesAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] farmPatches requires api.core");
  const ids = (names) => (names ?? []).map((name) => core.ItemIdentifiers[name]).filter(Number.isInteger);
  const seeds = { herb: ids(spec.seeds?.herb), allotment: ids(spec.seeds?.allotment) };
  const perPatch = { herb: 1, allotment: 3 };
  const weeds = core.ItemIdentifiers.WEEDS;
  const spade = core.ItemIdentifiers.SPADE;
  const rake = core.ItemIdentifiers.RAKE;

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
    const send = () => world.emitObjectInteraction?.({
      player, object: patch.object, definition: patch.definition, objectId: patch.object.getId(),
      clickType: patch.options.indexOf(option) + 1, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
    });
    const here = player.getLocation();
    if (Math.max(Math.abs(here.getX() - at.getX()), Math.abs(here.getY() - at.getY())) <= DIRECT_TILES) send();
    else player.getMovementQueue().walkToObject(patch.object, { execute: send });
  }

  function useOn(player, patch, itemId) {
    const items = player.getInventory().getItems() ?? [];
    const slot = items.findIndex((item) => item?.getId?.() === itemId);
    if (slot < 0) return false;
    const at = patch.object.getLocation();
    const use = () => world.emitItemOnObject?.({
      player, object: patch.object, objectId: patch.object.getId(), itemId, item: items[slot], itemSlot: slot, interfaceType: 0,
      location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
    });
    // Beside the patch (an allotment is a large object): the seed on it at once, as at the
    // runecrafting ruins, where the walk to the object never got to its "execute" (21-11-2026).
    const here = player.getLocation();
    if (Math.max(Math.abs(here.getX() - at.getX()), Math.abs(here.getY() - at.getY())) <= 4) use();
    else player.getMovementQueue().walkToObject(patch.object, { execute: use });
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
      // (As DropItems does: the item's Drop option is not a plugin action; Patrickbot 7 kept raking
      // with a bag of weeds that never went and stood stuck at Falador, 21-11-2026.)
      if (player.getInventory().getAmount(weeds) > 0) {
        player.getInventory().deleteNumber?.(weeds, player.getInventory().getAmount(weeds));
        player.getInventory().refreshItems?.();
      }
      if (player.getInventory().getFreeSlots() <= 0) return "success";
      const here = patches(player);
      if (here.length === 0) return "failed";
      bot.same ??= new Map();
      bot.left ??= new Map();
      // One click more of the same option on the same patch, its options unchanged since: counted.
      // At the limit the patch is left for this visit, with why (describe: left=).
      const clickOnce = (patch, option, why) => {
        const id = key(patch);
        const state = `${option}|${patch.options.join("/")}`;
        const last = bot.same.get(id);
        const count = last?.state === state ? last.count + 1 : 1;
        bot.same.set(id, { state, count });
        if (count > SAME_CLICK_LIMIT) {
          bot.left.set(id, why ?? `${option} x${SAME_CLICK_LIMIT} zonder effect`);
          return false;
        }
        click(player, patch, option);
        return true;
      };
      bot.seen = here.map((one) => `${one.kind}:${one.options.join("/")}`).join(" ");
      for (const patch of here) {
        if (bot.left.has(key(patch))) continue;
        const can = (option) => patch.options.includes(option);
        if (can("rake")) {
          // Raking takes a rake, as for a player ("Farming Supplies had geen rake").
          if (!(player.getInventory().getAmount(rake) > 0)) { bot.left.set(key(patch), "geen rake"); continue; }
          if (clickOnce(patch, "rake")) return "running";
          continue;
        }
        const pick = ["harvest", "pick"].find(can);
        if (pick) { if (clickOnce(patch, pick)) return "running"; continue; }
        // Dead (Clear) or diseased (Cure: it has no cure with it): dug up with the spade.
        if (can("clear") || can("dig")) { if (clickOnce(patch, can("clear") ? "clear" : "dig")) return "running"; continue; }
        if (can("cure") && player.getInventory().getAmount(spade) > 0 && useOn(player, patch, spade)) return "running";
      }
      // Planting: each patch once, then once more (one growing already refuses the seed).
      const order = [...here].filter((patch) => !bot.left.has(key(patch))).sort((a, b) => (bot.tries.get(key(a)) ?? 0) - (bot.tries.get(key(b)) ?? 0));
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
    describe(ctx) {
      const bot = ctx?.state?.farmPatches;
      return `farmPatches seen=[${bot?.seen ?? "-"}] tries=${bot ? JSON.stringify([...bot.tries.values()]) : "-"}` +
        ` left=${bot?.left?.size ? JSON.stringify(Object.fromEntries(bot.left)) : "-"} rake=${ctx?.player?.getInventory?.().getAmount?.(rake) ?? "?"}`;
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.farmPatches = null;
    },
  };
}

module.exports = { createFarmPatchesAction };
