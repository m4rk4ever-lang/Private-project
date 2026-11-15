"use strict";

/**
 * Errands on foot: a bot walks somewhere (the Grand Exchange, a bank, a shop, a house portal),
 * does its business there, and goes back to its job. Its brain waits meanwhile; this walks it,
 * a leg at a time, through the brain's own long-route navigation (LongRoutes.PlayerBots.js).
 * No free teleports: a far errand takes the time the walk takes, so bots only go when it is
 * worth it (Upkeep, Adventurers decide that). A bot that can teleport uses it when it saves a
 * long walk, through the game's own code so the costs are real:
 * - a spell: its Magic level, the runes in its bag, the standard spellbook;
 * - a tablet it carries (used up);
 * - charged jewellery it carries (a glory to Draynor, a games necklace to Burthorpe...), only to
 *   that piece's own destinations, one charge each; none behind a quest or other unlock.
 * Then it walks the rest.
 *
 * After the business the brain takes over again where the bot stands; its job walks it back.
 */
// Navigation loads the game core: required on the first walk, so tests of the planners stay light.
const navigation = () => require("../behaviours/navigation/Navigation.PlayerBots");
const requestMovement = (...args) => navigation().requestMovement(...args);
const clearMovementRequest = (...args) => navigation().clearMovementRequest(...args);

/** Close enough to do the business. */
const ARRIVE_TILES = 3;
/** A floor up or down counts as this many tiles of progress. */
const FLOOR_TILES = 20;
/** Not one step taken for this long: it is stuck (a door it cannot open, a wall). */
const STALL_MS = 30_000;
/** Standing still this long on the way: the route planner takes over from the straight walk. */
const PLAN_AFTER_MS = 6_000;
/**
 * Walking but no closer for this long: a detour round a river or through a gate may lead away
 * for a while, so only a long spell without getting nearer counts as a way that does not lead there.
 */
const NO_CLOSER_MS = 4 * 60_000;
/** No errand takes longer than this. */
const MAX_MS = 15 * 60_000;
/** A teleport is worth its runes when it saves at least this many tiles of walking. */
const TELEPORT_SAVES = 150;
/** The spells a bot may cast for an errand: none behind a quest, none into the Wilderness or a house. */
const ERRAND_SPELLS = new Set(["varrock teleport", "lumbridge teleport", "falador teleport", "camelot teleport"]);
const TELEPORT_MS = 3600;
/** The home teleport's long cast: it lands on tick 24 (HomeTeleportSequence), a little more to be sure. */
const HOME_TELEPORT_MS = 16_000;

function distance(a, b) {
  return Math.max(Math.abs(a.getX() - b.x), Math.abs(a.getY() - b.y));
}

/** Tablets by the spell they hold (they land where the spell does). */
const TABLETS = Object.freeze({
  VARROCK_TELEPORT: "varrock teleport", LUMBRIDGE_TELEPORT: "lumbridge teleport",
  FALADOR_TELEPORT: "falador teleport", CAMELOT_TELEPORT: "camelot teleport",
});

/** No teleport into the Wilderness for an errand. */
function inWilderness(x, y) {
  return x >= 2944 && x <= 3392 && y >= 3520 && y <= 3968;
}

/** Charged jewellery's errand destinations: itemId -> [{ label, tile, index }]. */
let jewellery = null;
function jewelleryDestinations(source = null) {
  if (jewellery && !source) return jewellery;
  let pieces = source ?? [];
  if (!source) {
    try {
      pieces = require("../../items/Teleports.Jewellery").JEWELLERY ?? [];
    } catch {
      pieces = [];
    }
  }
  jewellery = new Map();
  const byKey = new Map(pieces.map((piece) => [piece.key, piece]));
  for (const piece of pieces) {
    const destinations = piece.destinations ?? byKey.get(piece.destinationsFrom)?.destinations ?? [];
    const usable = destinations
      .map((destination, index) => ({ ...destination, index: index + 1 }))
      .filter((destination) => Array.isArray(destination.tile) && !destination.quest && !destination.kourend
        && !destination.colosseumRank && !destination.unlock && !destination.requires
        && !inWilderness(destination.tile[0], destination.tile[1]) && (destination.tile[2] ?? 0) === 0);
    for (const [itemId, charges] of piece.charged ?? []) {
      if (Number.isInteger(itemId) && charges > 0 && usable.length > 0) jewellery.set(itemId, usable);
    }
  }
  return jewellery;
}

/** Whether it carries every rune a spell takes. */
function carriesRunes(player, runes) {
  const inventory = player.getInventory();
  return (runes ?? []).every((rune) => inventory.getAmount(rune.getId()) >= rune.getAmount());
}

/**
 * The teleport it can use that lands nearest `to`, if it saves a long walk; else null.
 * { kind: "spell", name } | { kind: "tablet", slot } | { kind: "jewellery", slot, index, label }.
 */
function bestTeleport(core, player, to, { jewelleryData = null } = {}) {
  const spells = core?.SpellTeleports?.getTeleportDestinations?.() ?? [];
  const here = player.getLocation();
  const walk = distance(here, to);
  const magic = player.getSkillManager?.()?.getCurrentLevel?.(core.Skill?.MAGIC) ?? 1;
  let best = null;
  const consider = (option, x, y) => {
    const after = Math.max(Math.abs(x - to.x), Math.abs(y - to.y));
    if (walk - after >= TELEPORT_SAVES && (!best || after < best.after)) best = { ...option, after };
  };
  const landing = new Map(spells.map((spell) => [spell.name, spell.destination]));
  for (const spell of spells) {
    if (!ERRAND_SPELLS.has(spell.name) || spell.spellbook !== player.getSpellbook?.()) continue;
    if (magic < spell.level || !carriesRunes(player, spell.runes)) continue;
    consider({ kind: "spell", name: spell.name }, spell.destination.getX(), spell.destination.getY());
  }
  const items = player.getInventory().getItems?.() ?? [];
  items.forEach((item, slot) => {
    const id = item?.getId?.() ?? -1;
    if (!(id > 0)) return;
    for (const [key, spellName] of Object.entries(TABLETS)) {
      const land = landing.get(spellName);
      if (land && core.ItemIdentifiers?.[key] === id) consider({ kind: "tablet", slot, name: spellName }, land.getX(), land.getY());
    }
    for (const destination of (jewelleryData ? jewelleryDestinations(jewelleryData) : jewelleryDestinations()).get(id) ?? []) {
      consider({ kind: "jewellery", slot, index: destination.index, name: destination.label }, destination.tile[0], destination.tile[1]);
    }
  });
  return best;
}

function createErrands({ now = () => Date.now(), log = () => {}, core = null, move = requestMovement, clear = clearMovementRequest,
  useItem = null, emit = null, peek = (player) => navigation().peekMovementRequest(player) } = {}) {
  /**
   * The free home teleport (Lumbridge on the standard spellbook), when it saves a long walk and its
   * 30-minute cooldown has passed: cast through its plugin ("home-teleport:cast"), so the cooldown,
   * the combat check and the long animation are the game's own. False when it does not go off.
   */
  function homeTeleport(player, to) {
    if (!emit) return false;
    const check = { player, check: true, ready: false, destination: null };
    emit("home-teleport:cast", check);
    if (!check.ready || !check.destination) return false;
    const here = player.getLocation();
    if ((to.z ?? 0) !== 0 || distance(here, to) - Math.max(Math.abs(check.destination.x - to.x), Math.abs(check.destination.y - to.y)) < TELEPORT_SAVES) return false;
    const cast = { player, started: false };
    emit("home-teleport:cast", cast);
    return cast.started === true;
  }

  const errands = new Map();

  /**
   * Sends `entry`'s bot to `to` ({ x, y, z }); `arrive(player)` runs there. Returns false when it
   * is already on an errand.
   */
  function go(entry, to, { arrive = () => {}, reason = "errand", fail = () => {} } = {}) {
    const player = entry?.player;
    if (!player || errands.has(player)) return false;
    const nowMs = now();
    const errand = { entry, to, arrive, fail, reason, since: nowMs, best: Infinity, bestAt: nowMs, walkFrom: nowMs };
    errands.set(player, errand);
    if (entry.brain) entry.brain.paused = true;
    clear(player);
    const spell = core ? bestTeleport(core, player, to) : null;
    if (spell) {
      // As a player does it: the spell (level, runes, XP), a tablet broken (used up), jewellery
      // rubbed to one of its own destinations (a charge). Then it walks from where it lands.
      if (spell.kind === "spell") core.SpellTeleports.handleSelf(player, spell.name);
      else if (spell.kind === "tablet") useItem?.(player, spell.slot, "Break");
      else useItem?.(player, spell.slot, "Rub", spell.index);
      errand.walkFrom = nowMs + TELEPORT_MS;
      errand.bestAt = errand.walkFrom;
      log("bot_errand_teleport", { username: player.getUsername?.() ?? null, kind: spell.kind, to: spell.name, reason });
      errand.teleport = spell;
      return true;
    }
    if (homeTeleport(player, to)) {
      errand.walkFrom = nowMs + HOME_TELEPORT_MS;
      errand.bestAt = errand.walkFrom;
      errand.teleport = { kind: "home" };
      log("bot_errand_teleport", { username: player.getUsername?.() ?? null, kind: "home", reason });
      return true;
    }
    move(player, to.x, to.y, { nowMs, z: to.z ?? 0, reason: `brain_${reason}`, state: entry.state ?? undefined });
    return true;
  }

  function end(player, errand, ok) {
    errands.delete(player);
    clear(player);
    if (errand.entry.brain) errand.entry.brain.paused = false;
    try {
      if (ok) errand.arrive(player);
      else errand.fail(player);
    } finally {
      log("bot_errand", { username: player.getUsername?.() ?? null, reason: errand.reason, ok, ms: now() - errand.since });
    }
  }

  function tick() {
    const nowMs = now();
    for (const [player, errand] of [...errands]) {
      if (player.isRegistered?.() === false || player.getHitpoints?.() <= 0) {
        errands.delete(player);
        if (errand.entry.brain) errand.entry.brain.paused = false;
        continue;
      }
      if (nowMs < errand.walkFrom) continue;
      if (errand.walkFrom > errand.since && !errand.walking) {
        errand.walking = true;
        move(player, errand.to.x, errand.to.y, { nowMs, z: errand.to.z ?? 0, reason: `brain_${errand.reason}`, state: errand.entry.state ?? undefined });
      }
      // Progress on another floor counts too (walking to the stairs): the distance on the map plus
      // a step per floor, so a walk to Lumbridge castle's first floor is not called stuck before the
      // stairs. Arriving takes the right floor.
      const floors = Math.abs(player.getLocation().getZ() - (errand.to.z ?? 0));
      const away = distance(player.getLocation(), errand.to) + floors * FLOOR_TILES;
      if (floors === 0 && away <= ARRIVE_TILES) {
        end(player, errand, true);
        continue;
      }
      if (away < errand.best) {
        errand.best = away;
        errand.bestAt = nowMs;
      }
      const at = player.getLocation();
      const tile = `${at.getX()},${at.getY()},${at.getZ()}`;
      if (tile !== errand.tile) {
        errand.tile = tile;
        errand.movedAt = nowMs;
        errand.planned = false;
      }
      // Standing still short of the goal: the straight walk ends at a wall (the basic pather walks
      // to the nearest tile it can and calls that a route). Ask the route planner instead, once.
      const idle = nowMs - Math.max(errand.movedAt ?? errand.walkFrom, errand.walkFrom);
      if (idle > PLAN_AFTER_MS && !errand.planned) {
        let request = null;
        try {
          request = peek(player);
        } catch {
          request = null;
        }
        if (request && !request.route) {
          errand.planned = true;
          request.noPathAttempts = Math.max(1, Number(request.noPathAttempts ?? 0));
          request.fresh = true;
          log("bot_errand_replan", { username: player.getUsername?.() ?? null, at: tile, reason: errand.reason });
        }
      }
      const still = idle > STALL_MS;
      if (still || nowMs - errand.bestAt > NO_CLOSER_MS || nowMs - errand.since > MAX_MS) {
        log("bot_errand_failed", { username: player.getUsername?.() ?? null, reason: errand.reason, at: tile,
          to: `${errand.to.x},${errand.to.y},${errand.to.z ?? 0}`, why: still ? "stuck" : nowMs - errand.bestAt > NO_CLOSER_MS ? "no-closer" : "too-long" });
        end(player, errand, false);
        continue;
      }
      // The brain is paused, so its walk is driven from here, a leg at a time.
      errand.entry.brain?.dispatchMovement?.(nowMs);
    }
  }

  function busy(player) {
    return errands.has(player);
  }

  return { go, tick, busy, errands };
}

let shared = null;

/** One errand runner for every bot, ticked every tick (PlayerBots.plugin.js starts it). */
function errandsFor(api) {
  if (shared) return shared;
  shared = createErrands({
    log: (message, extra) => api?.log?.(message, extra),
    emit: api?.emitCustomEvent ? (name, payload) => api.emitCustomEvent(name, payload) : null,
    core: api?.core ?? null,
    // An inventory item's option, as a click sends it (a tablet's Break, a glory's Rub submenu).
    useItem: (player, slot, option, subOpId) => {
      const item = player.getInventory().getItems()[slot];
      if (!item || !(item.getId() > 0) || !api?.emitItemAction) return false;
      return api.emitItemAction({
        player, interfaceId: api.core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot, clickType: 1, option,
        ...(Number.isInteger(subOpId) ? { subOpId } : {}), handled: false,
      });
    },
  });
  if (api?.getTaskManager) {
    const { Task } = api.core;
    api.getTaskManager().submit(new (class extends Task {
      constructor() { super(1, "bot-errands", false); }
      execute() { shared.tick(); }
    })());
  }
  return shared;
}

module.exports = { createErrands, errandsFor, bestTeleport, ARRIVE_TILES, ERRAND_SPELLS };
