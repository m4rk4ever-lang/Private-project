"use strict";

const { isHonest } = require("../Honest.PlayerBots");

const { playerState } = require("../ActionState.PlayerBots");
const { clearMovementRequest } = require("../../behaviours/navigation/Navigation.PlayerBots");

/** Steps that make something of the produce (Smith, Fletch, Cook, burn it, use it). */
const MAKING = new Set(["smith", "fletch", "cook", "lightFire", "make"]);
/** What an honest bot does with its produce: make something of it, or bank it for later. */
const PRODUCTIVE = new Set([...MAKING, "bank"]);
const MAKE_RETRY_MS = 10 * 60_000;

/**
 * Weighted choice between short action lists, re-rolled every time the action
 * starts, then run in order. Lets one activity vary what a bot does at a step,
 * e.g. on a full inventory: bank, drop, sell, or smelt then bank/sell/drop.
 *
 * JSON: { "type": "choose", "options": [ { "weight": 2, "actions": [ ... ] }, ... ] }
 */
function createChooseAction(spec, compileAction) {
  const options = (spec.options ?? [])
    .map((option) => ({
      weight: Math.max(0, Number(option.weight ?? 1)),
      actions: (option.actions ?? []).map(compileAction),
    }))
    .filter((option) => option.weight > 0 && option.actions.length > 0);
  if (!options.length) {
    throw new Error("[bot activities] choose needs options with a weight and actions");
  }
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  const stateFor = (player) => playerState(action, player, () => ({ option: null, index: 0 }));
  const current = (bot) => bot.option?.actions[bot.index] ?? null;

  /**
   * An honest bot (an adventurer, a world bot with its own account) does something useful with
   * its produce, as a player does, and not always the same: after chopping it fletches the logs,
   * burns them or banks them; after mining it smelts and smiths, or banks the ore. It never
   * drops what it could use. One that failed (no knife, too low a level) is left alone for a
   * while; with none left it sells: that is its income.
   */
  function honestChoice(bot, nowMs = Date.now()) {
    const useful = options.filter((option) => option.actions.some((step) => PRODUCTIVE.has(step.id))
      && !(option.actions.some((step) => MAKING.has(step.id)) && bot.makeFailedUntil?.get?.(option) > nowMs));
    if (useful.length > 0) {
      const total = useful.reduce((sum, option) => sum + option.weight, 0);
      let roll = Math.random() * total;
      return useful.find((option) => (roll -= option.weight) < 0) ?? useful[useful.length - 1];
    }
    return options.find((option) => option.actions.some((step) => step.id === "sellItems")) ?? null;
  }

  const action = {
    id: "choose",
    update(ctx) {
      const bot = stateFor(ctx.player);
      if (!bot.option) {
        let roll = Math.random() * totalWeight;
        bot.option = (ctx.state?.honest || isHonest(ctx.player) ? honestChoice(bot, ctx.nowMs) : null)
          ?? options.find((option) => (roll -= option.weight) < 0) ?? options[options.length - 1];
        bot.index = 0;
      }
      const step = current(bot);
      const result = step.update(ctx);
      if (result === "success") {
        step.stop?.(ctx);
        // As between brain actions: the next step must not inherit this one's walk,
        // nor an interface it left open (busy() would stall it).
        clearMovementRequest(ctx.player);
        if (Number(ctx.player.getInterfaceId?.() ?? -1) > 0) ctx.player.getPacketSender?.()?.sendInterfaceRemoval?.();
        bot.index += 1;
        if (bot.index < bot.option.actions.length) {
          return "running";
        }
        bot.option = null;
        return "success";
      }
      if (result === "failed") {
        step.stop?.(ctx);
        if (bot.option.actions.some((entry) => MAKING.has(entry.id))) {
          bot.makeFailedUntil ??= new Map();
          bot.makeFailedUntil.set(bot.option, (ctx.nowMs ?? Date.now()) + MAKE_RETRY_MS);
        }
        bot.option = null;
      }
      return result;
    },
    stop(ctx) {
      const bot = stateFor(ctx.player);
      current(bot)?.stop?.(ctx);
      bot.option = null;
    },
    madeProgress(ctx) {
      return current(stateFor(ctx.player))?.madeProgress?.(ctx) === true;
    },
    describe(ctx) {
      const step = current(stateFor(ctx.player));
      return step?.describe?.(ctx) ?? `choose -> ${step?.id ?? "next roll"}`;
    },
  };
  return action;
}

module.exports = {
  createChooseAction,
};
