"use strict";

/**
 * Bird snaring as a player does it, through the Hunter plugin: stand among the birds, lay a bird
 * snare from the bag (its item option Lay), check a snare that caught something (the trap's
 * Check: the plugin pays XP and the catch), and take back a snare that fell over. The plugin owns
 * every rule (level, how many traps, whether a bird comes); this only clicks.
 *
 * spec: { site: [x, y], radius }.
 */
const { requestMovement } = require("../../behaviours/navigation/Navigation.PlayerBots");
const Loot = require("../Loot.PlayerBots");

const CLICK_MS = 1800;
const LAY_RETRY_MS = 5000;

function createHuntBirdsAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] huntBirds requires api.core");
  const snare = core.ItemIdentifiers.BIRD_SNARE;
  const [siteX, siteY] = spec.site;
  const radius = Math.max(2, Number(spec.radius ?? 6));
  const away = (loc, x, y) => Math.max(Math.abs(loc.getX() - x), Math.abs(loc.getY() - y));

  /** A trap near it that offers Check (a bird in it), as [object, clickType], or null. */
  function caughtTrap(player) {
    const here = player.getLocation();
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const x = here.getX() + dx;
        const y = here.getY() + dy;
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, here.getZ())) ?? []) {
          const definition = core.ObjectDefinition.forId(object.getId());
          if (!/snare/i.test(String(definition?.getName?.() ?? ""))) continue;
          const options = (definition.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
          const check = options.indexOf("check");
          if (check >= 0) return [object, check + 1];
        }
      }
    }
    return null;
  }

  return {
    id: "huntBirds",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.huntBirds ??= { nextAt: 0, layAt: 0 });
      if (nowMs < bot.nextAt || player.busy?.() || player.getMovementQueue().size() > 0) return "running";
      bot.nextAt = nowMs + CLICK_MS;
      const here = player.getLocation();
      if (away(here, siteX, siteY) > radius + 4) {
        requestMovement(player, siteX, siteY, { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
        return "running";
      }
      // A bird in a snare: check it (the plugin hands over the catch and the XP).
      const trap = caughtTrap(player);
      if (trap) {
        const [object, clickType] = trap;
        const at = object.getLocation();
        player.getMovementQueue().walkToObject(object, {
          execute: () => world.emitObjectInteraction?.({
            player, object, objectId: object.getId(), clickType, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
          }),
        });
        return "running";
      }
      // A snare that fell over lies on the ground: take it back.
      const ground = Loot.lootNear(core, player, { radius, minValue: 0, valueOf: () => 1 });
      if (ground && ground.getItem?.()?.getId?.() === snare) {
        Loot.takeStep(core, player, ground, { state, nowMs });
        return "running";
      }
      // Lay one from the bag (the plugin refuses past its limit for the level).
      if (nowMs >= bot.layAt && player.getInventory().getAmount(snare) > 0) {
        bot.layAt = nowMs + LAY_RETRY_MS;
        // On a tile of its own, a step or two from the last one.
        if (bot.laidAt && bot.laidAt === `${here.getX()},${here.getY()}`) {
          requestMovement(player, siteX + Math.floor(Math.random() * 5) - 2, siteY + Math.floor(Math.random() * 5) - 2,
            { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
          return "running";
        }
        const slot = (player.getInventory().getItems() ?? []).findIndex((item) => item?.getId?.() === snare);
        if (slot >= 0 && world.useItem?.(player, slot, "Lay")) bot.laidAt = `${here.getX()},${here.getY()}`;
        return "running";
      }
      return player.getInventory().getAmount(snare) > 0 || bot.laidAt ? "running" : "failed";
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.huntBirds = null;
    },
  };
}

module.exports = { createHuntBirdsAction };
