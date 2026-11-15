"use strict";

/**
 * Fletches the logs it carries with its own knife, into the best thing its Fletching level
 * allows (shafts, shortbows, longbows), through the fletching plugin's bot entry point: the
 * normal make loop, levels and XP as for a player. Done when those logs are used up.
 *
 * JSON: { "type": "fletch", "itemIds": ["logs"] }
 */
const Fletching = require("../../../skills/Fletching.plugin");
const { playerState } = require("../ActionState.PlayerBots");

function createFletchAction(spec, world) {
  const knifeId = world.core.ItemIdentifiers.KNIFE;
  const materialIds = (spec.itemIds ?? []).filter(Number.isInteger);
  const stateFor = (player) => playerState(action, player, () => ({ tries: 0 }));

  const action = {
    id: "fletch",
    update(ctx) {
      const { player } = ctx;
      const bot = stateFor(player);
      if (Fletching.isBotFletching?.(player)) return "running";
      const material = materialIds.find((id) => player.getInventory().getAmount(id) > 0);
      if (material === undefined) return "success";
      if (!player.getInventory().contains(knifeId)) return "failed";
      // Nothing it can make from what is left (its level, or one log short of a bow).
      if (bot.tries >= 2) {
        bot.tries = 0;
        return "success";
      }
      bot.tries += Fletching.startBotFletching?.(player, knifeId, material) ? 0 : 1;
      return "running";
    },
    stop(ctx) {
      stateFor(ctx.player).tries = 0;
    },
    describe() {
      return `fletch items=${materialIds.join(",")}`;
    },
  };
  return action;
}

module.exports = { createFletchAction };
