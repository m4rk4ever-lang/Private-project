"use strict";

/**
 * Watching a bot live: `::volg <naam>` puts the camera on a bot and keeps it there while the bot
 * walks, teleports and fights. The watcher is hidden, cannot be attacked and cannot walk; they
 * are moved along whenever the bot gets out of view. `::volg` without a name (or logging out)
 * stops it and puts the watcher back where they stood.
 *
 * Built like Clan Wars' viewing orb (minigames/clanwars/Viewing.ClanWars.js): hidden appearance,
 * a fixed view distance, cam_target on the followed player and the old camera restored after.
 */

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

function far(a, b) {
  return a.getZ() !== b.getZ()
    || Math.max(Math.abs(a.getX() - b.getX()), Math.abs(a.getY() - b.getY())) > KEEP_WITHIN;
}

function start(player, target) {
  stop(player, false);
  const sender = player.getPacketSender();
  const state = {
    target,
    location: player.getLocation().clone(),
    camera: sender.getCameraState(),
    hidden: player.isAppearanceHidden(),
    blocked: player.getMovementQueue().isMovementBlocked(),
    untargetable: player.isUntargetable(),
    fixedDistance: player.getFixedViewDistance(),
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

function stop(player, restore = true) {
  const state = watching.get(player);
  if (!state) return false;
  watching.delete(player);
  player.setAppearanceHidden(state.hidden);
  player.setFixedViewDistance(state.fixedDistance);
  player.getMovementQueue().setBlockMovement(state.blocked);
  player.setUntargetable(state.untargetable);
  if (restore) {
    player.moveTo(state.location);
    player.getPacketSender().restoreCameraState(state.camera);
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
