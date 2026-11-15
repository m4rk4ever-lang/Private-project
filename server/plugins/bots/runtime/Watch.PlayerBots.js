"use strict";

/**
 * Watching a bot live: `::volg <naam>` puts the camera on a bot and keeps it there while the bot
 * walks, teleports and fights. The watcher is hidden, cannot be attacked and cannot walk; they
 * are moved along whenever the bot gets out of view. Their inventory, equipment and stats tabs
 * show the bot's, kept up to date; their own come back after. `::volg` without a name (or logging out)
 * stops it and puts the watcher back where they stood.
 *
 * Built like Clan Wars' viewing orb (minigames/clanwars/Viewing.ClanWars.js): hidden appearance,
 * a fixed view distance, cam_target on the followed player and the old camera restored after.
 */

/** Inventory.INTERFACE_ID: where the game's own inventory refresh sends to. */
const INVENTORY_INTERFACE_ID = 3214;
/** The worn-equipment inventory the equipment tab reads (cache inventory 94). */
const WORN_INVENTORY_ID = 94;
/** Tiles the bot may get away before the watcher is moved to it. */
const KEEP_WITHIN = 6;

/** watcher -> { target, location, camera, hidden, blocked, untargetable, fixedDistance, pendingCamera } */
const watching = new Map();

function nameOf(player) {
  return String(player.getDisplayName?.() || player.getUsername?.() || "");
}

/** A player online by display name or username, case and spaces ignored. */
function findPlayer(core, name) {
  const wanted = name.toLowerCase().replace(/[\s_]+/g, " ").trim();
  if (!wanted) return null;
  const plain = (text) => String(text ?? "").toLowerCase().replace(/[\s_]+/g, " ").trim();
  return core.World.players.search((p) => p && (plain(p.getDisplayName?.()) === wanted || plain(p.getUsername?.()) === wanted))
    ?? null;
}

/** What the watcher's inventory and stats tabs last showed of the bot, to send only changes. */
function inventoryKey(player) {
  return (player.getInventory().getItems() ?? []).map((item) => (item ? `${item.getId()}x${item.getAmount()}` : "-")).join(",");
}

function equipmentKey(player) {
  return (player.getEquipment().getItems() ?? []).map((item) => (item ? `${item.getId()}x${item.getAmount()}` : "-")).join(",");
}

function skillsKey(player) {
  const manager = player.getSkillManager();
  return `${manager.getTotalLevel?.()}:${Math.floor(manager.getTotalExp?.() ?? 0)}:${player.getHitpoints?.()}`;
}

/** The bot's inventory and stats in the watcher's tabs, when they changed. */
function mirror(player, state) {
  const target = state.target;
  const sender = player.getPacketSender();
  const items = inventoryKey(target);
  if (items !== state.shownItems) {
    sender.sendItemContainer?.(target.getInventory(), INVENTORY_INTERFACE_ID);
    state.shownItems = items;
  }
  // Its worn gear in the watcher's equipment tab (inventory 94, by the same slots).
  const worn = equipmentKey(target);
  // Also every few seconds: the watcher's own appearance update would put its own gear back.
  const now = Date.now();
  if (worn !== state.shownWorn || now - (state.wornAt ?? 0) > 3000) {
    state.wornAt = now;
    const items = (target.getEquipment().getItems() ?? []).map((item) => (item && item.getId() > 0 ? { id: item.getId(), amount: item.getAmount() } : null));
    sender.sendInventory?.(WORN_INVENTORY_ID, Math.max(14, items.length), items);
    state.shownWorn = worn;
  }
  const skills = skillsKey(target);
  if (skills !== state.shownSkills) {
    sender.sendSkillsSnapshotOf?.(target);
    state.shownSkills = skills;
  }
}

function far(a, b) {
  return a.getZ() !== b.getZ()
    || Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY())) > KEEP_WITHIN;
}

function start(player, target) {
  // Switching from one bot to another keeps what the watcher had before the first ::volg:
  // its own place and camera, not the camera on the bot it watched last.
  const previous = watching.get(player);
  stop(player, false);
  const sender = player.getPacketSender();
  const state = {
    target,
    location: previous?.location ?? player.getLocation().clone(),
    camera: previous?.camera ?? ownCamera(sender.getCameraState()),
    hidden: previous?.hidden ?? player.isAppearanceHidden(),
    blocked: previous?.blocked ?? player.getMovementQueue().isMovementBlocked(),
    untargetable: previous?.untargetable ?? player.isUntargetable(),
    fixedDistance: previous?.fixedDistance ?? player.getFixedViewDistance(),
    pendingCamera: true,
  };
  watching.set(player, state);
  player.getMovementQueue().reset().setBlockMovement(true);
  player.setUntargetable(true);
  player.setAppearanceHidden(true);
  player.setFixedViewDistance(32);
  player.moveTo(target.getLocation().clone());
  player.sendMessage(`Je volgt ${nameOf(target)}. Typ ::volg om te stoppen.`);
}

/** A camera left on another player (an earlier ::volg) is not the watcher's own: back to follow. */
function ownCamera(camera) {
  return camera?.mode === "target" && camera.target && "player" in camera.target ? { mode: "follow" } : camera;
}

function stop(player, restore = true) {
  const state = watching.get(player);
  if (!state) return false;
  watching.delete(player);
  player.setAppearanceHidden(state.hidden);
  player.setFixedViewDistance(state.fixedDistance);
  player.getMovementQueue().setBlockMovement(state.blocked);
  player.setUntargetable(state.untargetable);
  // Their own inventory and stats again.
  player.getInventory?.()?.refreshItems?.();
  player.getPacketSender().sendSkillsSnapshot?.();
  const ownWorn = (player.getEquipment?.()?.getItems?.() ?? []).map((item) => (item && item.getId() > 0 ? { id: item.getId(), amount: item.getAmount() } : null));
  player.getPacketSender().sendInventory?.(WORN_INVENTORY_ID, Math.max(14, ownWorn.length), ownWorn);
  if (restore) {
    player.moveTo(state.location);
    const camera = state.camera?.mode === "controlled" ? { mode: "follow" } : state.camera;
    player.getPacketSender().restoreCameraState(camera);
    player.sendMessage(`Je volgt ${nameOf(state.target)} niet meer.`);
  }
  return true;
}

/** Every tick, for watchers only: keep up with the bot and keep the camera on it. */
function tick() {
  for (const [player, state] of [...watching]) {
    if (!player.isRegistered?.()) { watching.delete(player); continue; }
    const target = state.target;
    if (!target.isRegistered?.()) {
      player.sendMessage(`${nameOf(target)} is offline.`);
      stop(player);
      continue;
    }
    if (far(player.getLocation(), target.getLocation())) {
      player.moveTo(target.getLocation().clone());
      state.pendingCamera = true;
    }
    mirror(player, state);
    if (state.pendingCamera && !player.isNeedsPlacement?.()) {
      player.getPacketSender().sendCameraTarget({ player: target.getIndex() });
      state.pendingCamera = false;
    }
  }
}

function follow(core, { player, parts }) {
  const name = parts.slice(1).join(" ");
  if (!name.trim()) {
    if (!stop(player)) player.sendMessage("Gebruik: ::volg <naam>, bijvoorbeeld ::volg Eeshwar.");
    return true;
  }
  const target = findPlayer(core, name);
  if (!target || target === player) {
    player.sendMessage(`Niemand online met de naam "${name}".`);
    return true;
  }
  start(player, target);
  return true;
}

function startWatching(api) {
  const { Task, PlayerRights } = api.core;
  api.registerCommand("volg", (event) => follow(api.core, event), PlayerRights.OWNER,
    "Follow a player or bot with the camera: ::volg <name>; ::volg alone stops");
  api.onPlayerLogout(({ player }) => stop(player, false));
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(1, "bot-watch", false); }
    execute() { if (watching.size > 0) tick(); }
  })());
}

module.exports = { startWatching, findPlayer, watching, tick, start, stop, KEEP_WITHIN };
