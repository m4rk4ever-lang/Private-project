"use strict";

/**
 * Construction in its own house, as a player trains it: in building mode, Build on an empty
 * hotspot, the best piece the furniture list offers that its level and the materials in the bag
 * allow, then Remove it ("Really remove it?" Yes) and build again, until the planks run out; then
 * out through the house's exit portal. The Construction plugin owns every rule (level, materials,
 * nails, XP); this only clicks, and reads and picks the furniture list through the plugin's own
 * events ("construction:furniture-menu", "construction:choose-furniture"), as it cannot click
 * an interface.
 *
 * The adventurer (Adventurers.PlayerBots.js, mode "construction") buys the house, the hammer, the
 * saw and the planks, and takes it in through the Rimmington portal's Build mode first.
 *
 * spec: { planks: [names], radius }.
 */
const STEP_MS = 1_800;
/** After a Build or a pick: the list opens, the nails go in (a tick each). */
const BUILD_MS = 3_600;

function seenOf(core, object, player) {
  try {
    return core.ObjectDefinition.forPlayer?.(object.getId(), player) ?? core.ObjectDefinition.forId(object.getId());
  } catch {
    return core.ObjectDefinition.forId(object.getId());
  }
}

/** Tiles from `at` to the object's footprint (its south-west tile and its size, turned by its face). */
function tilesTo(object, definition, at) {
  const loc = object.getLocation();
  const turned = (Number(object.getFace?.() ?? 0) & 1) === 1;
  const sizeX = Math.max(1, Number((turned ? definition?.getSizeY?.() : definition?.getSizeX?.()) ?? 1) || 1);
  const sizeY = Math.max(1, Number((turned ? definition?.getSizeX?.() : definition?.getSizeY?.()) ?? 1) || 1);
  const off = (from, start, size) => Math.max(0, start - from, from - (start + size - 1));
  return Math.max(off(at.getX(), loc.getX(), sizeX), off(at.getY(), loc.getY(), sizeY));
}

/**
 * Objects of the player's own area around it with `option` (Build, Remove, Enter, Build mode),
 * within `radius` tiles of their footprint, nearest first, as { object, definition, clickType, away }.
 * A big object stands on its south-west tile: the Rimmington house portal (5x2, turned) at 2951,3222 was
 * "not found" from 2956,3225, a step from its edge (validation ceefe7a, 23-11-2026).
 */
function objectsNear(core, player, option, name = null, radius = 8) {
  const here = player.getLocation();
  const area = player.getPrivateArea?.() ?? null;
  const reach = radius + 4; // the largest footprints reach this far back from their south-west tile
  const found = [];
  for (let dx = -reach; dx <= radius; dx += 1) {
    for (let dy = -reach; dy <= radius; dy += 1) {
      for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(here.getX() + dx, here.getY() + dy, here.getZ())) ?? []) {
        if ((object.getPrivateArea?.() ?? null) !== area) continue;
        const definition = seenOf(core, object, player);
        if (name && !name.test(String(definition?.getName?.() ?? ""))) continue;
        const index = (definition?.getInteractions?.() ?? []).findIndex((entry) => String(entry ?? "").toLowerCase() === option);
        if (index < 0) continue;
        const away = tilesTo(object, definition, here);
        if (away > radius) continue;
        found.push({ object, definition, clickType: index + 1, away });
      }
    }
  }
  return found.sort((a, b) => a.away - b.away);
}

function createConstructAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] construct requires api.core");
  const planks = (spec.planks ?? ["PLANK", "OAK_PLANK", "TEAK_PLANK", "MAHOGANY_PLANK"])
    .map((name) => core.ItemIdentifiers[name]).filter(Number.isInteger);
  const radius = Math.max(8, Number(spec.radius ?? 24));
  const emit = (name, payload) => { world.emit?.(name, payload); return payload; };

  const objectsWith = (player, option, name = null) => objectsNear(core, player, option, name, radius);

  function click(player, { object, definition, clickType }) {
    const at = object.getLocation();
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, definition, objectId: object.getId(), clickType,
        location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      }),
    });
  }

  /** "Really remove it?": Yes, as the remove asks (the plugin's multi-chatbox prompt). */
  function answerRemove(player) {
    const prompt = core.MultiChatboxPrompt?.getPending?.(player);
    if (!prompt) return false;
    const index = (prompt.options ?? []).findIndex((option) => /^yes$/i.test(String(option).trim()));
    if (index < 0) return false;
    core.MultiChatboxPrompt.handleInterfaceActionClick({ player, buttonId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID,
      groupId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID >>> 16, slot: index + 1, action: index + 1 });
    return true;
  }

  const hasPlanks = (player) => planks.some((id) => player.getInventory().getAmount(id) > 0);

  return {
    id: "construct",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.construct ??= { at: 0, skip: new Set(), built: new Set(), left: false, since: nowMs });
      if (nowMs < bot.at || player.getMovementQueue().size() > 0) return "running";
      // Not in its house yet (the portal's loading screen, a few ticks): a little patience.
      if (!player.getPrivateArea?.() && !bot.left) return nowMs - bot.since < 20_000 ? "running" : "failed";
      bot.at = nowMs + STEP_MS;
      if (bot.left) return "success";
      if (answerRemove(player)) return "running";
      // The furniture list is open: the best piece it can build now, by experience.
      const menu = emit("construction:furniture-menu", { player, choices: null });
      if (Array.isArray(menu.choices)) {
        const best = menu.choices.filter((choice) => choice.ready).sort((a, b) => b.experience - a.experience)[0];
        if (best) {
          const pick = emit("construction:choose-furniture", { player, index: best.index, built: false });
          if (pick.built && bot.hotspot) bot.built.add(bot.hotspot);
          bot.at = nowMs + BUILD_MS;
        } else {
          // Nothing it can build here (its level, its materials): this hotspot is out for this stay.
          player.getPacketSender?.()?.sendInterfaceRemoval?.();
          if (bot.hotspot) bot.skip.add(bot.hotspot);
        }
        bot.hotspot = null;
        return "running";
      }
      // Out of planks: out through the exit portal; the adventurer banks and buys more.
      if (!hasPlanks(player)) {
        const portal = objectsWith(player, "enter", /portal/i)[0];
        if (!portal) return "success";
        click(player, portal);
        bot.left = true;
        bot.at = nowMs + BUILD_MS;
        return "running";
      }
      const key = (spot) => `${spot.object.getLocation().getX()},${spot.object.getLocation().getY()}`;
      // A piece it built this stay: off again, so the hotspot can be built on once more (not what
      // stood there before it came, nor the exit portal).
      const built = objectsWith(player, "remove").find((spot) => bot.built.has(key(spot)));
      if (built) {
        bot.built.delete(key(built));
        click(player, built);
        bot.at = nowMs + STEP_MS;
        return "running";
      }
      const hotspot = objectsWith(player, "build").find((spot) => !bot.skip.has(key(spot)));
      if (!hotspot) return bot.skip.size > 0 ? "success" : "failed";
      bot.hotspot = key(hotspot);
      click(player, hotspot);
      bot.at = nowMs + BUILD_MS;
      return "running";
    },
    describe(ctx) {
      const bot = ctx?.state?.construct;
      return `construct house=${Boolean(ctx?.player?.getPrivateArea?.())} hotspot=${bot?.hotspot ?? "-"} built=${bot?.built?.size ?? 0} skip=${bot?.skip?.size ?? 0} left=${bot?.left ?? false}`;
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.construct = null;
    },
  };
}

module.exports = { createConstructAction, objectsNear };
