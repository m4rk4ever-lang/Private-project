"use strict";

/**
 * Makes things from its materials the way a player does: a tool on a material (a needle on
 * leather, a chisel on a gem, a herb on a vial of water, a pipe on molten glass), and in the menu
 * that opens the best product its level allows, "All". Through the skill's own code, so levels,
 * materials, XP and timing are the game's. Covers Crafting, Herblore and Fletching alike.
 *
 * Which product: the menu's last entry first (menus run from the lowest level up); if nothing
 * starts within a few seconds (its level is too low), the one before, and so on.
 * Done when the material is used up, or nothing in the menu can be made.
 *
 * JSON: { "type": "make", "tool": "needle", "materials": ["leather"] }
 *       { "type": "make", "pairs": [["guam_potion_unf_", "eye_of_newt"]] } (one on the other)
 */
const { playerState } = require("../ActionState.PlayerBots");

/** How long it waits for a choice to start making something. */
const START_MS = 4000;
/** No material used for this long: the batch is done. */
const IDLE_MS = 6000;

function createMakeAction(spec, world) {
  const toolId = Number.isInteger(spec.tool) ? spec.tool : null;
  // `pairs`: [material, other] used one on the other (an unfinished potion on its secondary).
  const pairs = (spec.pairs ?? []).filter((pair) => Array.isArray(pair) && pair.every(Number.isInteger));
  const materialIds = pairs.length > 0 ? [...new Set(pairs.map((pair) => pair[0]))] : (spec.materials ?? []).filter(Number.isInteger);
  const stateFor = (player) => playerState(action, player, () => ({ choice: null, choices: null, since: 0, count: null, lastChange: 0 }));

  function slotOf(player, itemId) {
    return player.getInventory().getItems().findIndex((item) => item?.getId?.() === itemId);
  }

  function carried(player) {
    return materialIds.reduce((sum, id) => sum + player.getInventory().getAmount(id), 0);
  }

  /** Uses the tool (or the first material) on the material, as a click does. */
  function use(player) {
    const pair = pairs.find(([a, b]) => slotOf(player, a) >= 0 && slotOf(player, b) >= 0);
    const [first, second] = pair ?? (toolId !== null ? [toolId, materialIds.find((id) => slotOf(player, id) >= 0)] : materialIds);
    const used = slotOf(player, first);
    const on = slotOf(player, second);
    if (used < 0 || on < 0) return false;
    const inventory = player.getInventory().getItems();
    player.setCreationMenu?.(null);
    world.emitItemOnItem?.({
      player, usedItem: inventory[used], usedItemId: first, usedItemSlot: used,
      usedWithItem: inventory[on], usedWithItemId: second, usedWithItemSlot: on, handled: false,
    });
    return true;
  }

  const action = {
    id: "make",
    update(ctx) {
      const { player, nowMs } = ctx;
      const bot = stateFor(player);
      const count = carried(player);
      if (count <= 0) return "success";
      if (toolId !== null && slotOf(player, toolId) < 0) return "failed";
      // Material going down: something is being made.
      if (bot.count !== null && count < bot.count) {
        bot.count = count;
        bot.lastChange = nowMs;
        bot.making = true;
        return "running";
      }
      bot.count = count;
      if (bot.making) {
        if (nowMs - bot.lastChange < IDLE_MS) return "running";
        // It stopped with material left: try again (the menu may offer something else now).
        bot.making = false;
        bot.choices = null;
      }
      if (bot.choices && nowMs - bot.since < START_MS) return "running";
      if (!bot.choices) {
        if (!use(player)) return "failed";
        const menu = player.getCreationMenu?.();
        bot.choices = menu ? [...menu.getItems()] : [];
        bot.menu = menu ?? null;
        bot.since = nowMs;
        // No menu: the click itself started the work (a single product).
        if (!menu) return "running";
      }
      const next = bot.choices.pop();
      if (next === undefined) {
        bot.choices = null;
        return "success";
      }
      bot.menu?.execute?.(next, 28);
      bot.since = nowMs;
      return "running";
    },
    stop(ctx) {
      const bot = stateFor(ctx.player);
      bot.choices = null;
      bot.menu = null;
      bot.making = false;
      bot.count = null;
    },
    describe() {
      return `make tool=${toolId} materials=${materialIds.join(",")}`;
    },
  };
  return action;
}

module.exports = { createMakeAction };
