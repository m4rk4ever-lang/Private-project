"use strict";

/**
 * Bots talk in public chat, as players do: a line now and then that fits where they are and what
 * they do (selling at the Grand Exchange, "Light the brazier!" at Wintertodt, "Rock stolen lol"
 * in a mine), a line after their own level-up, a "Hey" back when a player greets them, and a
 * "Gz" when a player near them levels up. Lines are in data/chatter.json.
 *
 * Only bots a real player can see talk, so nobody chats to an empty world and it costs nothing
 * where no one is. Each bot keeps a quiet time between lines, and near any one player only one
 * bot speaks every few seconds. The chat goes through the normal public chat, so it shows above
 * the bot and in the chatbox.
 */
const data = require("../data/chatter.json");

function pick(lines, random) {
  return lines.length > 0 ? lines[Math.floor(random() * lines.length)] : null;
}

function isBot(player) {
  return player?.isPlayerBot?.() === true;
}

/** Where a bot is and what it does, as a chatter.json context key. */
function contextOf(activity, place) {
  const id = activity?.id ?? null;
  if (id === "bankstand") return "bankstand";
  if (id === "wintertodt") return "minigame:wintertodt";
  if (id === "roam" && place) {
    if (place.minigame) return `minigame:${place.minigame}`;
    if (place.combatGear) return "lobby";
    if (place.id === "grand_exchange") return "grand_exchange";
    return "hangout";
  }
  return activity?.mode ?? null;
}

function linesFor(context, contexts = data.contexts) {
  if (!context) return [];
  if (contexts[context]) return contexts[context];
  if (context.startsWith("minigame:")) return contexts.minigame ?? [];
  return [];
}

function skillName(skill) {
  const name = String(skill?.getName?.() ?? skill?.name ?? skill ?? "").toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function createChatter({
  runtime, core, random = Math.random, now = () => Date.now(), config = data,
} = {}) {
  const nextLineAt = new WeakMap();
  const areaQuietUntil = new WeakMap();
  const pending = [];
  const [cooldownMin, cooldownMax] = config.cooldownSeconds ?? [90, 240];

  function say(bot, text) {
    if (!bot?.isRegistered?.() || !text) return false;
    core.ChatPacketListener.handleText(bot, text);
    return true;
  }

  /** Says `text` after `delayMs`, as a player takes a moment to type. */
  function later(bot, text, delayMs) {
    pending.push({ bot, text, at: now() + delayMs });
  }

  function rested(bot, nowMs) {
    return (nextLineAt.get(bot) ?? 0) <= nowMs;
  }

  function spoke(bot, nowMs) {
    nextLineAt.set(bot, nowMs + (cooldownMin + random() * (cooldownMax - cooldownMin)) * 1000);
  }

  function activityOf(bot) {
    const entry = runtime?.entriesByUsername?.get?.(bot.getUsername?.());
    const frames = entry?.brain?.frames ?? [];
    return frames[frames.length - 1]?.behaviour ?? null;
  }

  function stateOf(bot) {
    return runtime?.botStatesByName?.get?.(bot.getUsername?.()) ?? null;
  }

  function nearbyBots(player) {
    return (player.getLocalPlayers?.() ?? []).filter((other) => isBot(other) && other.isRegistered?.() !== false);
  }

  function humans() {
    const players = core.World?.getPlayers?.() ?? [];
    const list = typeof players.toArray === "function" ? players.toArray() : [...players];
    return list.filter((player) => player && !isBot(player) && player.isRegistered?.() !== false);
  }

  /** Every few seconds: near each player, maybe one bot says something that fits. */
  function tick() {
    const nowMs = now();
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].at <= nowMs) {
        say(pending[i].bot, pending[i].text);
        pending.splice(i, 1);
      }
    }
    for (const player of humans()) {
      if ((areaQuietUntil.get(player) ?? 0) > nowMs) continue;
      const candidates = nearbyBots(player).filter((bot) => rested(bot, nowMs));
      for (const bot of candidates) {
        if (random() >= config.chancePerCheck) continue;
        const line = pick(linesFor(contextOf(activityOf(bot), stateOf(bot)?.place)), random);
        if (!line) continue;
        if (say(bot, line)) {
          spoke(bot, nowMs);
          areaQuietUntil.set(player, nowMs + config.areaGapSeconds * 1000);
        }
        break;
      }
    }
  }

  /** A bot's own level-up, and a "Gz" from a bot near a player who levels up. */
  function onLevelUp({ player, skill, newLevel }) {
    if (!player) return;
    const nowMs = now();
    if (isBot(player)) {
      if (random() >= config.levelUpChance || !rested(player, nowMs)) return;
      const seen = (player.getLocalPlayers?.() ?? []).some((other) => !isBot(other));
      if (!seen) return;
      const line = pick(config.levelUp, random)?.replace("{level}", String(newLevel)).replace("{skill}", skillName(skill));
      later(player, line, 1000 + random() * 2000);
      spoke(player, nowMs);
      return;
    }
    if (random() >= config.congratsChance) return;
    const bot = pick(nearbyBots(player).filter((other) => rested(other, nowMs)), random);
    if (!bot) return;
    later(bot, pick(config.congrats, random), 1500 + random() * 2500);
    spoke(bot, nowMs);
  }

  /** A player says "hi": one bot near them answers. */
  function onPublicChat(event) {
    const { player, packet } = event ?? {};
    if (!player || isBot(player) || packet?.type !== "public_chat") return;
    const words = String(packet.text ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
    if (!words.some((word) => config.greetings.includes(word))) return;
    if (random() >= config.replyChance) return;
    const nowMs = now();
    const bot = pick(nearbyBots(player), random);
    if (!bot) return;
    later(bot, pick(config.greetReplies, random), 1500 + random() * 2500);
    spoke(bot, nowMs);
  }

  return { tick, onLevelUp, onPublicChat, contextOf, pending };
}

const CHECK_TICKS = 5;

/** Starts the chatter for a running bot population: hooks and a check every few ticks. */
function startChatter(api, runtime) {
  const chatter = createChatter({ runtime, core: api.core });
  api.onPlayerLevelUp(chatter.onLevelUp);
  api.onSocialPacket(chatter.onPublicChat);
  const { Task } = api.core;
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(CHECK_TICKS, "bot-chatter", false); }
    execute() { chatter.tick(); }
  })());
  return chatter;
}

module.exports = { createChatter, startChatter, contextOf, linesFor, data };
