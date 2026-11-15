"use strict";

/**
 * A house party: one generated account with a high Construction level owns a house with a chapel
 * and a gilded altar (built for it, as part of its account, by "construction:furnished-house").
 * It stands by the altar, keeps both incense burners lit with its own marrentill, and advertises
 * its house on the board, as players do in Rimmington.
 *
 * While the party is open, honest fighters keep their bones instead of burying them. With a load
 * of bones they go: to the house portal, Friend's house ("construction:visit-house"), bones on the
 * altar (the house's own offering loop, 350% with both burners lit), out through the portal, and
 * back to work. Their brain waits meanwhile. Until bots can train Construction themselves, this is
 * how they get altar XP.
 *
 * HOUSE_PARTY=0 turns it off.
 */
const { markHonest, isHonest } = require("./Honest.PlayerBots");
// SiteSpawner and ObjectCatalog load the game core: required when a party starts, so isOpen()
// stays cheap for TrainCombat and Upkeep (and their tests).
const applyLevels = (...args) => require("./SiteSpawner.PlayerBots").applyLevels(...args);
const resolveCatalogObjectIds = (...args) => require("./ObjectCatalog.PlayerBots").resolveCatalogObjectIds(...args);

const ENABLED = (process.env.HOUSE_PARTY ?? "1") !== "0";
/** Rimmington's house portal (house-locations.json id 1, every new house's location). */
const PORTAL = Object.freeze({ x: 2954, y: 3224, z: 0 });
const HOST_ROOMS = ["PARLOUR", "KITCHEN", "DINING_ROOM", "CHAPEL"];
const HOST_LEVELS = Object.freeze({ all: [45, 80], construction: [83, 92], firemaking: [55, 85], prayer: [50, 80] });
const MARRENTILL = 251;
/** The host's own stock of marrentill (part of its account). */
const MARRENTILL_STOCK = 300;
const CHECK_TICKS = 25;
const HOST_EVERY_MS = 20_000;
const ADVERT_EVERY_MS = 25 * 60_000;
/** Bones a guest brings before it goes. */
const BONES_TO_GO = 10;
const GUEST_GIVE_UP_MS = 120_000;
const PER_CHECK = 6;

let open = false;

/** Whether a party is going on now (TrainCombat keeps bones then). */
function isOpen() {
  return open;
}

function isBone(core, itemId) {
  return /bones$/i.test(String(core.ItemDefinition.forId(itemId)?.getName?.() ?? ""));
}

function boneSlots(core, player) {
  const slots = [];
  (player.getInventory().getItems() ?? []).forEach((item, slot) => {
    if (item && item.getId() > 0 && isBone(core, item.getId())) slots.push(slot);
  });
  return slots;
}

function createHouseParty({ api, runtime, world, now = () => Date.now(), catalog = resolveCatalogObjectIds, levels = applyLevels }) {
  const core = api.core;
  const emit = (name, payload) => { api.emitCustomEvent(name, payload); return payload; };
  let ids = null;
  const idsOf = (key) => (ids ??= { altar: catalog({ catalog: "houseAltar" }), burner: catalog({ catalog: "incenseBurner" }) })[key];
  let host = null;
  let hostAt = 0;
  let advertAt = -Infinity;
  const guests = new Map();
  let cursor = 0;

  function nearest(player, ids) {
    const at = player.getLocation();
    const found = world.objectSearch?.findCandidatesByIds?.(player, ids, {
      regionRadius: 2, z: at.getZ(), privateArea: player.getPrivateArea?.() ?? null,
    }) ?? [];
    return found
      .map((object) => ({ object, distance: Math.max(Math.abs(object.getLocation().getX() - at.getX()), Math.abs(object.getLocation().getY() - at.getY())) }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.object);
  }

  function interact(player, object, option) {
    const at = object.getLocation();
    world.emitObjectInteraction?.({
      player, object, objectId: object.getId(), clickType: 1, option,
      location: { x: at.getX(), y: at.getY(), z: at.getZ() },
      sourceLocation: { x: player.getLocation().getX(), y: player.getLocation().getY(), z: player.getLocation().getZ() },
      handled: false,
    });
  }

  function entryOf(player) {
    return runtime.entriesByUsername?.get?.(player.getUsername?.());
  }

  /** The host: an account with a house of its own, at the Rimmington portal. */
  function spawnHost() {
    const bot = runtime.spawnPvpBot(new core.Location(PORTAL.x, PORTAL.y, PORTAL.z), { mode: "roaming", activity: "world" });
    if (!bot) return null;
    levels(bot, HOST_LEVELS);
    markHonest(bot);
    const entry = entryOf(bot);
    if (entry?.state) entry.state.honest = true;
    if (entry?.brain) entry.brain.paused = true;
    bot.getInventory().add(new core.Item(core.ItemIdentifiers.TINDERBOX, 1), false);
    bot.getInventory().add(new core.Item(MARRENTILL, MARRENTILL_STOCK), false);
    bot.getInventory().refreshItems?.();
    const built = emit("construction:furnished-house", { player: bot, rooms: HOST_ROOMS, handled: false });
    if (!built.handled) {
      world.log?.("house_party_no_house", { username: bot.getUsername?.() });
      return bot;
    }
    world.log?.("house_party_host", { username: bot.getUsername?.(), name: bot.getDisplayName?.() });
    return bot;
  }

  /** The host's round: in its house, by the altar, burners lit, the advert up. */
  function keepHost(nowMs) {
    if (!host || host.isRegistered?.() === false) {
      host = spawnHost();
      open = false;
      return;
    }
    if (nowMs - hostAt < HOST_EVERY_MS) return;
    hostAt = nowMs;
    if (!(host.getPrivateArea?.() && host.getPrivateArea().constructor?.name === "PlayerHouseInstance")) {
      emit("construction:visit-house", { player: host, owner: host.getUsername() });
      open = false;
      return;
    }
    const altar = nearest(host, idsOf("altar"))[0];
    if (!altar) {
      open = false;
      return;
    }
    const at = altar.getLocation();
    if (Math.max(Math.abs(at.getX() - host.getLocation().getX()), Math.abs(at.getY() - host.getLocation().getY())) > 3) {
      host.getMovementQueue().walkToObject?.(altar, { execute: () => {} });
    }
    if (host.getInventory().getAmount(MARRENTILL) > 0) {
      for (const burner of nearest(host, idsOf("burner")).slice(0, 2)) interact(host, burner, "Light");
    }
    if (nowMs - advertAt >= ADVERT_EVERY_MS) {
      advertAt = nowMs;
      emit("construction:advertise-house", { player: host });
    }
    open = true;
  }

  function startGuest(entry, nowMs) {
    const player = entry.player;
    const at = player.getLocation();
    guests.set(player, { entry, stage: "travelling", at: nowMs + 3600, since: nowMs, back: { x: at.getX(), y: at.getY(), z: at.getZ() } });
    if (entry.brain) entry.brain.paused = true;
    core.TeleportHandler?.teleport
      ? core.TeleportHandler.teleport(player, new core.Location(PORTAL.x, PORTAL.y, PORTAL.z), core.TeleportType.NORMAL, false)
      : player.moveTo(new core.Location(PORTAL.x, PORTAL.y, PORTAL.z));
  }

  function finishGuest(player, guest) {
    guests.delete(player);
    if (player.getPrivateArea?.()?.constructor?.name === "PlayerHouseInstance") {
      emit("construction:exit-house", { player, to: new core.Location(PORTAL.x, PORTAL.y, PORTAL.z) });
    }
    if (guest.entry.brain) guest.entry.brain.paused = false;
    const back = new core.Location(guest.back.x, guest.back.y, guest.back.z);
    core.TeleportHandler?.teleport ? core.TeleportHandler.teleport(player, back, core.TeleportType.NORMAL, false) : player.moveTo(back);
  }

  function advanceGuests(nowMs) {
    for (const [player, guest] of [...guests]) {
      if (player.isRegistered?.() === false) { guests.delete(player); continue; }
      if (nowMs < guest.at) continue;
      if (!open || nowMs - guest.since > GUEST_GIVE_UP_MS || boneSlots(core, player).length === 0) {
        finishGuest(player, guest);
        continue;
      }
      if (guest.stage === "travelling") {
        emit("construction:visit-house", { player, owner: host.getUsername() });
        guest.stage = "offering";
        guest.at = nowMs + 2400;
        continue;
      }
      // Bones on the altar: the house's offering loop takes the rest of that kind.
      const altar = nearest(player, idsOf("altar"))[0];
      const slot = boneSlots(core, player)[0];
      if (altar && slot !== undefined) {
        const item = player.getInventory().getItems()[slot];
        const at = altar.getLocation();
        player.getMovementQueue().walkToObject?.(altar, {
          execute: () => world.emitItemOnObject?.({
            player, object: altar, objectId: altar.getId(), item, itemId: item.getId(), itemSlot: slot,
            interfaceType: core.Inventory.INTERFACE_ID, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
          }),
        });
      }
      guest.at = nowMs + 6000;
    }
  }

  function inviteGuests(nowMs) {
    if (!open) return;
    const entries = [...(runtime.entriesByUsername?.values?.() ?? [])];
    for (let looked = 0; looked < Math.min(PER_CHECK, entries.length); looked += 1) {
      const entry = entries[cursor++ % entries.length];
      const player = entry?.player;
      if (!player || player === host || !(entry.state?.honest || isHonest(player)) || guests.has(player) || entry.brain?.paused) continue;
      if (player.getCombat?.()?.getAttacker?.()) continue;
      if (boneSlots(core, player).length >= BONES_TO_GO) startGuest(entry, nowMs);
    }
  }

  let ticks = 0;
  function tick() {
    const nowMs = now();
    advanceGuests(nowMs);
    if (++ticks % CHECK_TICKS !== 0) return;
    keepHost(nowMs);
    inviteGuests(nowMs);
  }

  return { tick, guests, get host() { return host; }, keepHost, inviteGuests, advanceGuests };
}

function startHouseParty(api, runtime, world) {
  if (!ENABLED) return null;
  const party = createHouseParty({ api, runtime, world });
  const { Task } = api.core;
  // A little after the world's own bots have spawned.
  api.onServerStartup?.(() => setTimeout(() => api.getTaskManager().submit(new (class extends Task {
    constructor() { super(1, "bot-house-party", false); }
    execute() { party.tick(); }
  })()), 20_000));
  return party;
}

module.exports = { createHouseParty, startHouseParty, isOpen, BONES_TO_GO };
