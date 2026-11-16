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

/**
 * The followed player's quests (and below, its diary tasks): { open: ["Rune Mysteries (stage 3)"], done, total }. The quest tab
 * itself is not mirrored: its varps are the watcher's own quest state on the server too.
 */
function questsOf(target) {
  let quests = [];
  try {
    quests = require("../../quests/QuestRuntime").getRegisteredQuests();
  } catch {
    return null;
  }
  const open = [];
  let done = 0;
  for (const quest of quests) {
    if (quest.isComplete?.(target)) done += 1;
    else if (quest.isStarted?.(target)) open.push(`${quest.name} (stage ${quest.getStage(target)})`);
  }
  return { open, done, total: quests.length };
}

let coreRef = null;

/** Each quest's own variable (varbit or varp), as the quest tab reads it. */
function questVars() {
  try {
    return require("../../quests/QuestRuntime").getRegisteredQuests()
      .map((quest) => (quest.varbitId !== undefined ? { quest, kind: "varbit", id: quest.varbitId } : quest.varpId !== undefined ? { quest, kind: "varp", id: quest.varpId } : null))
      .filter((entry) => entry && Number.isInteger(entry.id));
  } catch {
    return [];
  }
}

const readVar = (sender, entry) => (entry.kind === "varbit" ? sender.getVarbit?.(entry.id) : sender.getVarp?.(entry.id));
const sendVar = (sender, entry, value) => (entry.kind === "varbit" ? sender.sendVarbit?.(entry.id, value) : sender.sendConfig?.(entry.id, value));

/**
 * The bot's quest tab and combat tab in the watcher's client: its quests' variables (the tab is
 * drawn from them) and its weapon's kind. Only what the watcher's client shows: the watcher's own
 * values are kept (state.ownVars) and sent back when it stops.
 */
function mirrorTabs(player, state) {
  const own = player.getPacketSender();
  const theirs = state.target.getPacketSender?.();
  if (!theirs) return;
  state.vars ??= questVars();
  state.ownVars ??= new Map(state.vars.map((entry) => [`${entry.kind}:${entry.id}`, readVar(own, entry) ?? 0]));
  for (const entry of state.vars) {
    // The value its quest tab would show: from the bot's saved stage (a bot's client is not real).
    let value = null;
    try {
      const stage = entry.quest.getStage(state.target);
      value = entry.kind === "varbit" ? entry.quest.varbitValue?.(stage, state.target) : entry.quest.varpValue?.(stage, state.target);
    } catch {
      value = readVar(theirs, entry);
    }
    if (Number.isInteger(value) && value !== readVar(own, entry)) sendVar(own, entry, value);
  }
  const category = state.target.getWeapon?.()?.getCategory?.();
  const varbit = coreRef?.WeaponInterfaceManager?.WEAPON_CATEGORY_VARBIT;
  if (Number.isInteger(category) && Number.isInteger(varbit) && state.shownCategory !== category) {
    own.sendVarbit?.(varbit, category);
    state.shownCategory = category;
  }
}

function restoreTabs(player, state) {
  const own = player.getPacketSender();
  for (const entry of state.vars ?? []) {
    const value = state.ownVars?.get(`${entry.kind}:${entry.id}`);
    if (Number.isInteger(value)) sendVar(own, entry, value);
  }
  try {
    coreRef?.WeaponInterfaceManager?.assign?.(player);
  } catch {
    // Its own combat tab comes back with its next weapon change otherwise.
  }
}

/** The quests in the watcher's chat: when it starts following, and when they change. */
function showQuests(player, state) {
  const quests = questsOf(state.target);
  if (!quests) return;
  // Achievement diary tasks done, per diary (achievement-diaries:tasks, the diaries' own record).
  const diaryTasks = state.target.getAttribute?.("achievement-diaries:tasks") ?? {};
  const diaries = Object.entries(diaryTasks).filter(([, tasks]) => Array.isArray(tasks) && tasks.length > 0)
    .map(([diary, tasks]) => `${diary} ${tasks.length}`);
  const key = `${quests.done}:${quests.open.join("|")}:${diaries.join("|")}`;
  if (key === state.shownQuests) return;
  state.shownQuests = key;
  player.sendMessage(`Quests van ${nameOf(state.target)}: ${quests.done}/${quests.total} voltooid. `
    + (quests.open.length > 0 ? `Bezig: ${quests.open.join(", ")}.` : "Geen quest bezig."));
  player.sendMessage(diaries.length > 0 ? `Diary-taken gedaan: ${diaries.join(", ")}.` : "Nog geen diary-taken gedaan.");
}

/**
 * What the bot does, in the watcher's chat as it happens: its journal's new lines (jobs, walks,
 * buying, selling and banking with the items and prices, level-ups, quests).
 */
function showJournal(player, state) {
  const journal = state.target.getAttribute?.("adventurers:journal");
  if (!Array.isArray(journal)) return;
  const newest = journal.reduce((at, line) => Math.max(at, Number(line?.at) || 0), 0);
  // Starting to follow: only the last line, not the whole history.
  if (state.journalAt === undefined) {
    state.journalAt = newest;
    const last = journal.find((line) => Number(line?.at) === newest);
    if (last?.text) player.sendMessage(`[${nameOf(state.target)}] ${last.text}`);
    return;
  }
  const fresh = journal.filter((line) => Number(line?.at) > state.journalAt).sort((a, b) => a.at - b.at);
  for (const line of fresh.slice(-5)) player.sendMessage(`[${nameOf(state.target)}] ${line.text}`);
  if (newest > state.journalAt) state.journalAt = newest;
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
  // Quests are looked at every few seconds (a stage changes rarely).
  if (now - (state.questsAt ?? 0) > 3000) {
    state.questsAt = now;
    showQuests(player, state);
    showJournal(player, state);
    mirrorTabs(player, state);
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
  restoreTabs(player, state);
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
  coreRef = api.core;
  api.registerCommand("volg", (event) => follow(api.core, event), PlayerRights.OWNER,
    "Follow a player or bot with the camera: ::volg <name>; ::volg alone stops");
  api.onPlayerLogout(({ player }) => stop(player, false));
  api.getTaskManager().submit(new (class extends Task {
    constructor() { super(1, "bot-watch", false); }
    execute() { if (watching.size > 0) tick(); }
  })());
}

module.exports = { startWatching, findPlayer, watching, tick, start, stop, KEEP_WITHIN };
