"use strict";

/**
 * Bank standing: a bot at a busy bank (the Grand Exchange, Varrock West, Seers...) stands by the
 * booths and works on a bank-standing skill as players do: fletching logs, mixing potions or
 * crafting leather, with the skill's own animation, again and again until its next activity.
 *
 * The craft is the bot's best of the listed skills (a 90 fletcher fletches), with a little
 * chance. The bot walks to a free tile within `radius` of its home first.
 *
 * This shows the activity; it does not make products or give XP yet. That comes when the bot
 * uses the skill plugins (item on item) itself.
 */
/** The bots' walking (loaded on first use, so the unit loads without the server's classes). */
function walk(player, x, y, options) {
  return require("../../behaviours/navigation/Navigation.PlayerBots").requestMovement(player, x, y, options);
}

const DEFAULT_CRAFTS = Object.freeze([
  { skill: "FLETCHING", animation: "human_fletching" },
  { skill: "HERBLORE", animation: "human_herbing_vial" },
  { skill: "CRAFTING", animation: "human_leather_crafting" },
  { skill: "CRAFTING", animation: "human_glassblowing" },
]);
const DEFAULT_RADIUS = 4;
/** An animation every few ticks, as one fletch or one potion takes (1.8 s; 3 ticks). */
const STEP_MS = 1800;
/** A short pause now and then, as a player banks between inventories. */
const BANK_PAUSE_EVERY = 14;
const BANK_PAUSE_MS = [3000, 7000];
const WALK_TIMEOUT_MS = 15_000;

function randomInt(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

/** The craft a bot works on: weighted by its level in each skill. */
function chooseCraft(player, crafts, core, random = Math.random) {
  const skills = player?.getSkillManager?.();
  const weights = crafts.map((craft) => {
    const skill = core?.Skill?.[craft.skill];
    const level = skill != null ? skills?.getMaxLevel?.(skill) ?? 1 : 1;
    return Math.max(1, level) ** 2;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  for (let i = 0; i < crafts.length; i++) {
    roll -= weights[i];
    if (roll < 0) return crafts[i];
  }
  return crafts[crafts.length - 1];
}

function createBankStandAction(spec = {}, world = {}) {
  const crafts = Array.isArray(spec.crafts) && spec.crafts.length > 0 ? spec.crafts : DEFAULT_CRAFTS;
  const radius = Number.isFinite(spec.radius) ? spec.radius : DEFAULT_RADIUS;
  const random = world.random ?? Math.random;
  const seqIds = new Map();

  function animationFor(name) {
    if (!seqIds.has(name)) seqIds.set(name, world.core?.CacheDefinitions?.getSeqId?.(name) ?? null);
    return seqIds.get(name);
  }

  function start(player, state, nowMs) {
    const home = state.home ?? (() => {
      const at = player.getLocation();
      return { x: at.getX(), y: at.getY(), z: at.getZ() };
    })();
    const spot = {
      x: home.x + randomInt(-radius, radius, random),
      y: home.y + randomInt(-radius, radius, random),
      z: home.z ?? 0,
    };
    state.bankStand = { craft: chooseCraft(player, crafts, world.core, random), spot, startedAt: nowMs, nextAt: nowMs, steps: 0 };
    (world.requestMovement ?? walk)(player, spot.x, spot.y, { reason: "brain_bankstand", basicPather: true, z: spot.z });
  }

  return {
    id: "bankStand",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      if (!state.bankStand) {
        start(player, state, nowMs);
        return "running";
      }
      const stand = state.bankStand;
      if (player.getMovementQueue?.()?.size?.() > 0 && nowMs - stand.startedAt < WALK_TIMEOUT_MS) {
        return "running";
      }
      if (nowMs < stand.nextAt) return "running";
      const id = animationFor(stand.craft.animation);
      if (Number.isInteger(id) && world.core?.Animation) player.performAnimation(new world.core.Animation(id));
      stand.steps += 1;
      stand.nextAt = nowMs + STEP_MS;
      if (stand.steps % BANK_PAUSE_EVERY === 0) {
        stand.nextAt += randomInt(BANK_PAUSE_MS[0], BANK_PAUSE_MS[1], random);
      }
      return "running";
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.bankStand = null;
    },
  };
}

module.exports = { createBankStandAction, chooseCraft, DEFAULT_CRAFTS };
