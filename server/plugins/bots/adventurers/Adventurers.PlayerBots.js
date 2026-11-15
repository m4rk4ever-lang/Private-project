"use strict";

/**
 * Adventurers: a few named bots that start as new accounts in Lumbridge and play the game on
 * their own, for good: they train toward the quests on their path (data/adventurers.json),
 * complete them, and keep a journal. Their progress is saved like a player's.
 *
 * Every few seconds the planner (Planner.PlayerBots.js) is asked what each adventurer does
 * next once its current stretch is over. Training runs a normal bot activity at a fitting place
 * (Travel.PlayerBots.js picks it); Firemaking from 50 is Wintertodt, played for real. A quest is
 * played where a playthrough is built; the others are simulated: the adventurer goes to the
 * quest's start point (from the cache's quest table), stays a while, and the quest completes with
 * its normal rewards. The journal says which.
 *
 * Shown live at /api/adventurers (the page client/public/adventurers.html), and in game with
 * ::adventurers (an overview) and ::adventurer <name> (go there).
 */
const definitions = require("../../../data/definitions/bot-activities.json");
const data = require("../data/adventurers.json");
const { chooseNext, bestActivity } = require("./Planner.PlayerBots");
const { createTravel } = require("../brain/Travel.PlayerBots");
const { startActivity } = require("../brain/BrainActivities.PlayerBots");
const { dressForMode } = require("../brain/SiteSpawner.PlayerBots");
const travelData = require("../data/travel-destinations.json");

const LOG_ATTRIBUTE = "adventurers:journal";
/** A companion joins a group if its own stretch ends within this. */
const GROUP_JOIN_WINDOW_MS = 4 * 60_000;
const GROUP_MAX = 5;
const Value = require("../../interface/ValueWarning");
const CHECK_TICKS = 10;
const WINTERTODT = travelData.minigames.find((game) => game.id === "wintertodt");

function normalize(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function randomBetween([min, max], random) {
  return min + random() * (max - min);
}

/** The cache's packed coordinate (level << 28 | x << 14 | y). */
function unpackCoord(coord) {
  if (!Number.isInteger(coord) || coord < 0) return null;
  return { x: (coord >> 14) & 0x3fff, y: coord & 0x3fff, z: (coord >> 28) & 0x3 };
}

function createAdventurers({ api, runtime, world, registry, random = Math.random, now = () => Date.now() }) {
  const core = api.core;
  const QuestRuntime = require("../../quests/QuestRuntime");
  const { questMetadata } = require("../../quests/QuestList.QuestRuntime");
  const travel = createTravel({
    core,
    log: world.log,
    dress: dressForMode,
    equipCombatGear: (player, state) => world.equipCombatGear?.(player, state),
    chance: 1,
    hangoutChance: 0,
    minigameChance: 0,
    random,
  });
  /** name -> { name, player, phase, until, plan, startedAt } */
  const adventurers = new Map();

  function questsByName() {
    const map = new Map();
    for (const quest of QuestRuntime.getRegisteredQuests()) map.set(normalize(quest.name), quest);
    return map;
  }

  function journal(player) {
    const entries = player.getAttribute(LOG_ATTRIBUTE);
    return Array.isArray(entries) ? entries : [];
  }

  /** A journal line of a kind: "skill", "quest", "boss", "drop" or "activity" (the page's tabs). */
  function note(player, text, type = "activity") {
    const entries = [...journal(player), { at: now(), type, text }];
    // Each kind keeps its own last `logSize` lines, so a run of level-ups never pushes out a drop.
    const kept = [];
    const counts = new Map();
    for (let i = entries.length - 1; i >= 0; i--) {
      const kind = entries[i].type ?? "activity";
      const count = counts.get(kind) ?? 0;
      if (count >= (data.logSize ?? 40)) continue;
      counts.set(kind, count + 1);
      kept.unshift(entries[i]);
    }
    player.setAttribute(LOG_ATTRIBUTE, kept);
  }

  function skillLevels(player) {
    const levels = {};
    const skills = player.getSkillManager();
    for (const skill of core.Skill.values()) levels[String(skill.getName()).toUpperCase()] = skills.getMaxLevel(skill);
    return levels;
  }

  function snapshot(player) {
    const registered = questsByName();
    const done = new Set();
    for (const quest of data.quests) {
      if (registered.get(normalize(quest.name))?.isComplete(player)) done.add(quest.name);
    }
    return {
      levels: skillLevels(player),
      combat: player.getSkillManager().getCombatLevel(),
      questPoints: Number(player.getAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE)) || 0,
      done,
      available: new Set(data.quests.filter((quest) => registered.has(normalize(quest.name))).map((quest) => quest.name)),
    };
  }

  function stateOf(player) {
    return runtime.botStatesByName?.get?.(player.getUsername());
  }

  function teleport(player, place) {
    const target = new core.Location(place.x, place.y, place.z ?? 0);
    if (core.TeleportHandler?.teleport && core.TeleportType?.NORMAL) {
      core.TeleportHandler.teleport(player, target, core.TeleportType.NORMAL, false);
    } else {
      player.moveTo(target);
    }
    const state = stateOf(player);
    if (state) state.home = { x: place.x, y: place.y, z: place.z ?? 0 };
  }

  function startTraining(entry, plan, nowMs) {
    const { player } = entry;
    const view = snapshot(player);
    if (plan.mode === "wintertodt") {
      teleport(player, WINTERTODT);
      startActivity(player, "wintertodt", { home: WINTERTODT, nowMs });
      entry.activity = "wintertodt";
    } else {
      const level = plan.mode === "combat_training" ? view.combat : view.levels[plan.skill] ?? 1;
      const id = bestActivity(plan.mode, level, definitions);
      const activity = id ? registry?.byId?.get(id) ?? null : null;
      if (!activity) return false;
      travel(player, stateOf(player), activity, nowMs);
      startActivity(player, id, { home: stateOf(player)?.home ?? null, nowMs });
      entry.activity = id;
    }
    entry.phase = "training";
    entry.plan = plan;
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
    note(player, `Traint ${plan.skill === "COMBAT" ? "combat" : plan.skill.toLowerCase()} (${String(entry.activity).replace(/_/g, " ")}) voor ${plan.reason}.`);
    return true;
  }

  function startQuest(entry, plan, nowMs) {
    const { player } = entry;
    const row = questMetadata({ name: plan.quest.name }, core.CacheDefinitions);
    const start = unpackCoord(row?.startcoord?.[0]);
    if (start) teleport(player, start);
    startActivity(player, "roam", { home: start ?? stateOf(player)?.home ?? null, nowMs });
    entry.phase = "quest";
    entry.plan = plan;
    entry.activity = "roam";
    entry.until = nowMs + randomBetween(data.questMinutes, random) * 60_000;
    note(player, `Begint aan ${plan.quest.name}${entry.group ? " (samen)" : ""}.`, "quest");
    return true;
  }

  function finishQuest(entry) {
    const quest = questsByName().get(normalize(entry.plan.quest.name));
    if (!quest || quest.isComplete(entry.player)) return;
    // Simulated: no playthrough is built for this quest yet. The normal rewards apply.
    quest.complete(entry.player, { scroll: false, announce: false });
    note(entry.player, `${quest.name} voltooid (gesimuleerd). Questpunten: ${Number(entry.player.getAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE)) || 0}.`, "quest");
  }

  /** Adventurers whose stretch is over or nearly so, and that are online: free to join a group. */
  function freeCompanions(entry, nowMs) {
    return [...adventurers.values()].filter((other) => other !== entry && other.player?.isRegistered?.()
      && other.phase !== "quest" && other.until - nowMs < GROUP_JOIN_WINDOW_MS);
  }

  /**
   * Now and then an adventurer takes the others along: Wintertodt together when two or more
   * have the Firemaking, otherwise the same training spot (the same mine, the same monsters).
   */
  function startGroup(entry, nowMs) {
    const companions = freeCompanions(entry, nowMs).slice(0, GROUP_MAX - 1);
    if (companions.length === 0) return false;
    const members = [entry, ...companions];
    const firemakers = members.filter((member) => snapshot(member.player).levels.FIREMAKING >= 50);
    if (firemakers.length >= 2) {
      for (const member of firemakers) {
        member.group = true;
        startTraining(member, { kind: "train", mode: "wintertodt", skill: "FIREMAKING", reason: "Wintertodt samen" }, nowMs);
      }
      return true;
    }
    const view = snapshot(entry.player);
    const plan = chooseNext(view, data.quests, { available: view.available, questChance: 0, random });
    entry.group = true;
    if (!startTraining(entry, { ...plan, reason: `${plan.reason}, samen` }, nowMs)) return false;
    const home = stateOf(entry.player)?.home;
    for (const member of companions) {
      member.group = true;
      if (!startTraining(member, { ...plan, reason: `samen met ${entry.name}` }, nowMs) || !home) continue;
      // The same spot as the one who asked.
      teleport(member.player, home);
      startActivity(member.player, member.activity, { home, nowMs });
    }
    return true;
  }

  function next(entry, nowMs) {
    if (entry.phase === "quest") finishQuest(entry);
    entry.group = false;
    if (random() < (data.groupChance ?? 0.3) && startGroup(entry, nowMs)) return;
    const view = snapshot(entry.player);
    const plan = chooseNext(view, data.quests, { available: view.available, questChance: data.questChance, random });
    const started = plan.kind === "quest" ? startQuest(entry, plan, nowMs) : startTraining(entry, plan, nowMs);
    if (!started) entry.until = nowMs + 60_000;
  }

  /** A valuable drop (data.dropValue coins or more) from an adventurer's kill, for the drop log. */
  function onDrops(request) {
    const { player, npc } = request ?? {};
    if (!player || !adventurers.has(player.getUsername?.())) return;
    const npcName = npc?.getDefinition?.()?.getName?.() ?? "iets";
    // After the roll's other handlers have edited it, as the collection log reads it.
    queueMicrotask(() => {
      for (const drop of request.drops ?? []) {
        const itemId = Number(drop?.itemId ?? drop?.id);
        const amount = Math.trunc(Number(drop?.amount ?? 1));
        if (!(itemId > 0) || !(amount > 0)) continue;
        const name = core.ItemDefinition?.forId?.(itemId)?.getName?.();
        const value = Value.itemValue(core, itemId, amount);
        if (!name || !(value >= (data.dropValue ?? 10000))) continue;
        note(player, `${amount > 1 ? `${amount} x ` : ""}${name} van ${npcName} (${value.toLocaleString("nl-NL")} gp).`, "drop");
      }
    });
  }

  /** A kill of a boss-sized monster (combat level data.bossLevel or more), for the boss log. */
  function onNpcDeath({ killer, npc }) {
    if (!killer || !adventurers.has(killer.getUsername?.())) return;
    const definition = npc?.getDefinition?.();
    const level = definition?.getCombatLevel?.() ?? 0;
    if (level < (data.bossLevel ?? 100)) return;
    note(killer, `${definition.getName()} (level ${level}) verslagen.`, "boss");
  }

  function tick() {
    const nowMs = now();
    for (const entry of adventurers.values()) {
      if (!entry.player?.isRegistered?.()) continue;
      if (nowMs >= entry.until) next(entry, nowMs);
    }
  }

  function spawn() {
    const at = data.spawn;
    for (const name of data.names) {
      if (adventurers.has(name)) continue;
      const bot = runtime.spawnPvpBot(new core.Location(at.x, at.y, at.z ?? 0), {
        mode: "roaming", activity: "world", username: name, persistent: true,
      });
      if (!bot) continue;
      adventurers.set(name, { name, player: bot, phase: "new", until: 0, plan: null, activity: null });
      if (journal(bot).length === 0) note(bot, "Een nieuw avontuur begint in Lumbridge.");
    }
  }

  function onLevelUp({ player, skill, newLevel }) {
    if (!player || !adventurers.has(player.getUsername?.())) return;
    const name = String(skill?.getName?.() ?? skill ?? "").toLowerCase();
    note(player, `Level ${newLevel} ${name}!`, "skill");
  }

  function describeLocation(player) {
    const at = player.getLocation();
    const here = { x: at.getX(), y: at.getY() };
    let best = null;
    for (const place of [...travelData.destinations, ...travelData.hangouts, ...travelData.minigames]) {
      const distance = Math.max(Math.abs(place.x - here.x), Math.abs(place.y - here.y));
      if (!best || distance < best.distance) best = { id: place.id, distance };
    }
    const name = best && best.distance < 120 ? best.id.replace(/_/g, " ") : "onderweg";
    return { x: here.x, y: here.y, z: at.getZ(), near: name };
  }

  /** What the page and ::adventurers show. */
  function report() {
    return [...adventurers.values()].map((entry) => {
      const { player } = entry;
      const online = player?.isRegistered?.() === true;
      const skills = {};
      if (online) {
        const manager = player.getSkillManager();
        for (const skill of core.Skill.values()) {
          skills[String(skill.getName()).toLowerCase()] = { level: manager.getMaxLevel(skill), xp: Math.floor(manager.getExperience(skill)) };
        }
      }
      const view = online ? snapshot(player) : null;
      return {
        name: entry.name,
        online,
        combat: online ? player.getSkillManager().getCombatLevel() : null,
        total: online ? player.getSkillManager().getTotalLevel() : null,
        questPoints: view?.questPoints ?? 0,
        quests: view ? [...view.done] : [],
        questsOnPath: data.quests.length,
        skills,
        doing: entry.phase === "quest"
          ? `Quest: ${entry.plan?.quest?.name} (gesimuleerd)`
          : entry.plan ? `Training: ${String(entry.activity).replace(/_/g, " ")} (${entry.plan.reason})` : "Begint",
        group: entry.group === true,
        until: entry.until,
        location: online ? describeLocation(player) : null,
        journal: online ? journal(player).slice().reverse() : [],
      };
    });
  }

  return { adventurers, spawn, tick, onLevelUp, onDrops, onNpcDeath, report, next, startGroup };
}

/** Starts the adventurers on server start; serves /api/adventurers and the commands. */
function startAdventurers({ api, runtime, world, registry }) {
  api.persistAttribute(LOG_ATTRIBUTE, []);
  const manager = createAdventurers({ api, runtime, world, registry });
  api.onPlayerLevelUp(manager.onLevelUp);
  api.onCustomEvent("npc-drops:roll", manager.onDrops);
  api.onNpcDeath(manager.onNpcDeath);
  api.registerContentEndpoint("adventurers", () => ({ updated: Date.now(), adventurers: manager.report() }));
  const rights = api.core.PlayerRights;
  api.registerCommand("adventurers", ({ player }) => {
    for (const a of manager.report()) {
      player.sendMessage(a.online
        ? `${a.name}: combat ${a.combat}, totaal ${a.total}, ${a.quests.length} quests. ${a.doing}. Bij ${a.location?.near}.`
        : `${a.name}: offline.`);
    }
    return true;
  }, rights.OWNER, "Show the adventurer bots: levels, quests and what they do");
  api.registerCommand("adventurer", ({ player, parts }) => {
    const name = parts.slice(1).join(" ").toLowerCase();
    const entry = [...manager.adventurers.values()].find((a) => a.name.toLowerCase() === name);
    if (!entry?.player?.isRegistered?.()) {
      player.sendMessage(`Geen avonturier "${name}". Kies uit: ${data.names.join(", ")}.`);
      return true;
    }
    player.moveTo(entry.player.getLocation().clone());
    player.sendMessage(`Je staat bij ${entry.name}.`);
    return true;
  }, rights.OWNER, "Go to an adventurer bot: ::adventurer <name>");
  api.onServerStartup?.(() => setTimeout(() => {
    manager.spawn();
    const { Task } = api.core;
    api.getTaskManager().submit(new (class extends Task {
      constructor() { super(CHECK_TICKS, "adventurers", false); }
      execute() { manager.tick(); }
    })());
  }, 5000));
  return manager;
}

module.exports = { createAdventurers, startAdventurers, unpackCoord, LOG_ATTRIBUTE };
