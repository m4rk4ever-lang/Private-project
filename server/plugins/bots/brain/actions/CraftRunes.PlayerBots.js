"use strict";

/**
 * Runecraft as a player does it: its essence in the bag and the talisman, walk to the altar's
 * mysterious ruins, use the talisman on them (the Runecrafting plugin takes it inside), click the
 * altar's Craft-rune, and leave by the portal. Done when the essence is used up: the adventurer's
 * planner banks or sells the runes and fetches or buys more essence (buy-to-train, a station).
 *
 * spec: { talisman, essence: [names], ruins: [x, y], inside: [x, y], altar: [x, y], portal: [x, y] }.
 */
const { requestMovement, clearMovementRequest } = require("../../behaviours/navigation/Navigation.PlayerBots");

const RETRY_MS = 3000;
const NEAR = (a, x, y, tiles) => Math.max(Math.abs(a.getX() - x), Math.abs(a.getY() - y)) <= tiles;

function objectAt(core, x, y, z, name) {
  const objects = core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, z)) ?? [];
  return objects.find((object) => String(core.ObjectDefinition?.forId?.(object.getId())?.getName?.() ?? "").toLowerCase() === name.toLowerCase()
    && object.getLocation().getX() === x && object.getLocation().getY() === y) ?? null;
}

function optionIndex(core, object, option) {
  const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((entry) => String(entry ?? "").toLowerCase());
  return options.indexOf(option.toLowerCase()) + 1;
}

function createCraftRunesAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] craftRunes requires api.core");
  const id = (name) => {
    const value = core.ItemIdentifiers[name];
    if (!Number.isInteger(value)) throw new Error(`[bot activities] unknown item '${name}'`);
    return value;
  };
  const talisman = id(spec.talisman);
  const essence = (spec.essence ?? ["PURE_ESSENCE", "RUNE_ESSENCE"]).map(id);
  const [ruinsX, ruinsY] = spec.ruins;
  const [insideX, insideY] = spec.inside;
  const [altarX, altarY] = spec.altar;
  const [portalX, portalY] = spec.portal;
  const essenceIn = (player) => essence.reduce((sum, item) => sum + player.getInventory().getAmount(item), 0);

  function click(player, x, y, name, option) {
    const object = objectAt(core, x, y, 0, name);
    const clickType = object ? optionIndex(core, object, option) : 0;
    if (!object || !clickType) return false;
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, objectId: object.getId(), clickType, location: { x, y, z: 0 }, handled: false,
      }),
    });
    return true;
  }

  return {
    id: "craftRunes",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.craftRunes ??= { nextAt: 0 });
      const here = player.getLocation();
      // Beside the ruins a walk still under way is the walk to the ruins' own tile, under the
      // object, which never ends: it kept every turn at "running" and the talisman was never
      // used (2983,3291; 113 bot-min, 0 XP; voorwerk 22-11-2026, pakket 17). Stop it and go on.
      const besideRuins = here.getZ() === 0 && NEAR(here, ruinsX, ruinsY, 3);
      if (besideRuins && (player.getMovementQueue().size() > 0 || bot.walkingToRuins)) {
        clearMovementRequest(player);
        player.getMovementQueue().reset?.();
        bot.walkingToRuins = false;
      }
      bot.queue = player.getMovementQueue().size();
      bot.busy = Boolean(player.busy?.());
      if (nowMs < bot.nextAt || bot.busy || bot.queue > 0) return "running";
      const inside = NEAR(here, insideX, insideY, 30);
      const left = essenceIn(player);
      bot.nextAt = nowMs + RETRY_MS;
      if (inside) {
        // Its essence onto the altar, then out by the portal.
        if (left > 0) return click(player, altarX, altarY, "Altar", "Craft-rune") ? "running" : "failed";
        return click(player, portalX, portalY, "Portal", "Use") ? "running" : "failed";
      }
      if (left <= 0) return "success";
      if (player.getInventory().getAmount(talisman) <= 0) return "failed";
      if (!NEAR(here, ruinsX, ruinsY, 2)) {
        requestMovement(player, ruinsX, ruinsY, { state, nowMs, z: 0, reason: "brain_runecraft", basicPather: true });
        bot.walkingToRuins = true;
        return "running";
      }
      const ruins = objectAt(core, ruinsX, ruinsY, 0, "Mysterious ruins");
      if (!ruins) { bot.step = "no ruins object"; return "failed"; }
      bot.step = `talisman on ruins ${ruins.getId()} (${(bot.tries = (bot.tries ?? 0) + 1)}x)`;
      const slot = (player.getInventory().getItems() ?? []).findIndex((item) => item?.getId?.() === talisman);
      const item = player.getInventory().getItems()[slot];
      const at = ruins.getLocation();
      const use = () => world.emitItemOnObject?.({
        player, object: ruins, objectId: ruins.getId(), item, itemId: talisman, itemSlot: slot,
        interfaceType: 0, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      });
      // Beside the ruins (they are a large object): Use the talisman on them at once. The walk to
      // the object never ended in its "execute" there, so the talisman was never used and three
      // bots stood at the Air ruins with a bag of essence (owner, 21-11-2026).
      if (NEAR(here, at.getX(), at.getY(), 3) || (bot.tries ?? 0) >= 2) use();
      else player.getMovementQueue().walkToObject(ruins, { execute: use });
      bot.nextAt = nowMs + 6000;
      return "running";
    },
    describe(ctx) {
      const bot = ctx?.state?.craftRunes;
      const at = ctx?.player?.getLocation?.();
      const near = at ? Math.max(Math.abs(at.getX() - ruinsX), Math.abs(at.getY() - ruinsY)) : "?";
      return `craftRunes ${bot?.step ?? "-"} talisman=${ctx?.player?.getInventory?.().getAmount?.(talisman) ?? "?"} essence=${ctx?.player ? essenceIn(ctx.player) : "?"} queue=${bot?.queue ?? "?"} busy=${bot?.busy ?? "?"} near=${near}`;
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.craftRunes = null;
    },
  };
}

module.exports = { createCraftRunesAction };
