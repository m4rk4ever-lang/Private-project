"use strict";

/**
 * The game's version in every log line (`v`: the git commit it runs, short), so lines from before
 * and after an update can be told apart when the logs are read later.
 */
const GAME_VERSION = (() => {
  try {
    return require("child_process").execSync("git rev-parse --short HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
      .toString().trim() || null;
  } catch {
    return process.env.GAME_VERSION ?? null;
  }
})();

/**
 * Adventurers: a few named bots that start as new accounts in Lumbridge and play the game on
 * their own, for good, and keep a journal. Their progress is saved like a player's.
 *
 * Every few seconds the planner (Planner.PlayerBots.js) is asked what each adventurer does
 * next once its current stretch is over. Training runs a normal bot activity at a fitting place
 * (Travel.PlayerBots.js picks it); Firemaking from 50 is Wintertodt, played for real.
 *
 * Nothing is simulated: what a bot cannot really do yet, it does not do. Quests are done only
 * where a bot playthrough is built (playthrough: true in adventurers.json); none is built yet,
 * so for now they train, fight and earn. Every quest on the server (Quests.PlayerBots.js, from
 * the cache's quest table) counts on the page, so their progress shows against all of them.
 *
 * Shown live at /api/adventurers (the page client/public/adventurers.html), and in game with
 * ::adventurers (an overview) and ::adventurer <name> (go there).
 */
const definitions = require("../../../data/definitions/bot-activities.json");
const data = require("../data/adventurers.json");
const { chooseNext, bestActivity, isReady } = require("./Planner.PlayerBots");
const { createQuestList } = require("./Quests.PlayerBots");
const Goals = require("./Goals.PlayerBots");
const { startActivity } = require("../brain/BrainActivities.PlayerBots");
const travelData = require("../data/travel-destinations.json");

const LOG_ATTRIBUTE = "adventurers:journal";
/** Its current goal (Goals.PlayerBots.js), kept across restarts. */
const GOAL_ATTRIBUTE = "adventurers:goal";
/** Which start an adventurer belongs to; a lower one than data.generation starts it over. */
const GENERATION_ATTRIBUTE = "adventurers:generation";
/** The test start an extra member got (applyTestProfile): shown, and kept out of the firsts. */
const TEST_PROFILE_ATTRIBUTE = "adventurers:test-profile";
// Its test start's weapons with charges were charged (scythe, trident, blowpipe ...).
const CHARGED_ATTRIBUTE = "adventurers:charged";
/** Quest and clue rewards (useRewards): never dropped as junk. */
const REWARD_NAME = /antique lamp|casket|scroll box|clue scroll|clue bottle|clue nest|reward/i;
/**
 * Its current job ({ kind, mode, skill, reason, style, bossId, activity, remainingMs, savedAt }),
 * one record that is overwritten, never appended: when a job starts and every TASK_SAVE_MS while
 * it runs. After a restart it takes the job up again with the time it had left.
 */
const TASK_ATTRIBUTE = "adventurers:task";
const TASK_SAVE_MS = 3 * 60_000;
const Tasks = require("./Tasks.PlayerBots");
const TravelHubs = require("../behaviours/navigation/TravelHubs.PlayerBots");
const Sites = require("./Sites.PlayerBots");
const { createHelperSteps } = require("./QuestHelperSteps.PlayerBots");
const { createQuestPlay } = require("./QuestPlay.PlayerBots");
/** A quest a bot could not finish is put aside this long. */
const QUEST_ASIDE_MS = 60 * 60_000;
const Shopping = require("./Shopping.PlayerBots");
const Trade = require("./Trade.PlayerBots");
const Slayer = require("./Slayer.PlayerBots");
const Clans = require("./Clans.PlayerBots");
// More adventurers per clan for a longer test run (adventurers.json "extraPerClan"); once.
if (!data.expandedClans) {
  Clans.expand(data, data.extraPerClan);
  data.expandedClans = true;
}
const { runPaced } = require("../runtime/SpawnPacing.PlayerBots");
const npcSpawns = require("../../../data/definitions/npc-spawns.json");
const { markHonest, markAdventurer } = require("../brain/Honest.PlayerBots");
const { errandsFor } = require("../brain/Errands.PlayerBots");
/** Within this many tiles of its job's place it is there, and its stretch runs. */
const ARRIVED_TILES = 25;
/** A walk that never gets there (a blocked way) stops pausing the stretch after this. */
const MAX_WALK_CREDIT_MS = 20 * 60_000;
/** A companion joins a group if its own stretch ends within this. */
const GROUP_JOIN_WINDOW_MS = 4 * 60_000;
const GROUP_MAX = 5;
const Value = require("../../interface/ValueWarning");
const COINS = 995;
// Every two ticks (1.2 s): eating, the next job and the next step follow without standing around.
const CHECK_TICKS = 2;
const QUEST_TICK_MS = 6_000;
/** A walk that ends this close to its place has arrived (the exact tile may be in a hut). */
const NEAR_ENOUGH_TILES = 15;
/** Below this share of its Hitpoints with nothing to eat, a dangerous job stops. */
const DANGER_HP_SHARE = 0.5;
const DANGER_MODES = new Set(["combat_training", "combat_ranged", "combat_magic", "slayer", "thieving"]);
/** How long it waits at the exchange for a bid on training materials to fill. */
const BID_WAIT_MS = 3 * 60_000;
/** How much further than a bank it walks to the Grand Exchange to sell (saving up, offers in). */
const SELL_DETOUR_TILES = 120;
/** Coins a clanmate always keeps for itself before it chips in toward another's goal. */
const CLAN_KEEP = 5_000;
/** From this y the map is underground (dungeons, caves): no walking route there yet. */
const UNDERGROUND_Y = 6400;
/** No XP and no step for this long while training: it is stuck, it picks something else. */
const STUCK_MS = 75_000;
/** The longest one Slayer task may take before it gives up on it for now. */
const SLAYER_TASK_MAX_MS = 90 * 60_000;
/** Teleport tablets an adventurer may buy for long walks, and the coins it keeps before it does. */
const TABLETS = ["VARROCK_TELEPORT", "LUMBRIDGE_TELEPORT", "FALADOR_TELEPORT", "CAMELOT_TELEPORT"];
/**
 * Charged teleport jewellery it may buy on the GE, as players do: a games necklace, a ring of
 * dueling, an amulet of glory. Each charge is one errand teleport (Errands.PlayerBots.js).
 */
const JEWELLERY = ["GAMES_NECKLACE_8_", "RING_OF_DUELING_8_", "AMULET_OF_GLORY_4_"];
const TABLET_BUDGET = 5000;
/** Arrows, or casts' worth of runes, it wants before it fights that way. */
/** Places the travel data has no stop for, named on the page when an adventurer is there. */
const LANDMARKS = Object.freeze([
  { id: "wizards_tower", x: 3109, y: 3164 },
  { id: "wizards_tower_basement", x: 3104, y: 9571 },
  { id: "lumbridge_castle", x: 3209, y: 3218 },
  { id: "draynor_manor", x: 3109, y: 3353 },
]);
const SUPPLY_MIN = 50;
/** Below this many hitpoints (its level) an adventurer takes food along on its jobs and walks. */
const TRAVEL_FOOD_UNTIL_HP = 40;
const TRAVEL_FOOD = 8;
/** Coins it wants before it buys a first supply of runes to start Magic with. */
const MAGIC_START_BUDGET = 2500;
const MAGIC_RUNES = ["AIR_RUNE", "MIND_RUNE", "WATER_RUNE", "EARTH_RUNE", "FIRE_RUNE", "CHAOS_RUNE"];
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

// Al Kharid behind its wall and toll gate: a walker that does not pay goes round by the path
// north to Varrock, about this many tiles further.
const AL_KHARID = { minX: 3267, maxX: 3330, minY: 3130, maxY: 3240 };
const AL_KHARID_DETOUR = 260;
const inAlKharid = (at) => at.x >= AL_KHARID.minX && at.x <= AL_KHARID.maxX && at.y >= AL_KHARID.minY && at.y <= AL_KHARID.maxY;

/** About how far it walks there: straight, plus the way round the toll gate when it would not pay. */
function walkTiles(here, place, player) {
  const straight = Math.max(Math.abs(place.x - here.x), Math.abs(place.y - here.y));
  if (inAlKharid(here) === inAlKharid(place)) return straight;
  const { paysToll } = require("../brain/DoorOpening.PlayerBots");
  return player && paysToll(player, "Pay-toll(10gp)") ? straight : straight + AL_KHARID_DETOUR;
}

function createAdventurers({ api, runtime, world, registry, random = Math.random, now = () => Date.now(), errands = errandsFor(api) }) {
  const core = api.core;
  const emit = (name, payload) => api.emitCustomEvent(name, payload);
  const QuestRuntime = require("../../quests/QuestRuntime");
  // All quests on this server, the path first; requirements from the cache.
  const questList = createQuestList({ core, path: data.quests, getRegistered: () => QuestRuntime.getRegisteredQuests() });
  /** Whether it may go there: on foot with its quests and items, and its levels and quests met. */
  function travelMeets(player, requires, place = null) {
    return (!place || TravelHubs.onFoot(place, null, (name) => questsByName().get(normalize(name))?.isComplete(player) === true, (item) => Shopping.owns(player, Shopping.idOf(core, item)))) && (!requires || (
      (requires.quests ?? []).every((name) => questsByName().get(normalize(name))?.isComplete(player) === true)
      && Object.entries(requires.skills ?? {}).every(([skill, level]) => (core.Skill[skill] ? player.getSkillManager().getMaxLevel(core.Skill[skill]) : 0) >= level)));
  }
  /** logs/adventurers-activity.jsonl: every journal line of every adventurer, as it happens. */
  const activityLog = (() => {
    try {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(process.cwd(), "logs", "adventurers-activity.jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // A long-running server keeps the last part: the file is started over past 20 MB.
      try { if (fs.statSync(file).size > 20 * 1024 * 1024) fs.renameSync(file, `${file}.old`); } catch {}
      return fs.createWriteStream(file, { flags: "a" });
    } catch {
      return { write: () => {} };
    }
  })();

  /**
   * logs/adventurers-metrics.jsonl, for whoever improves the bots: every five minutes per
   * adventurer what it gained (XP per skill, levels, coins) and where its time went (working at
   * its job, walking to it, errands, quests, standing idle at the job without XP), what it is doing
   * and why; one line for the server (how long the adventurers' own tick takes, how many bots
   * run). Plus an "idle" line the moment one stands at its job for a minute without XP.
   */
  const metricsLog = (() => {
    try {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(process.cwd(), "logs", "adventurers-metrics.jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try { if (fs.statSync(file).size > 20 * 1024 * 1024) fs.renameSync(file, `${file}.old`); } catch {}
      return fs.createWriteStream(file, { flags: "a" });
    } catch {
      return { write: () => {} };
    }
  })();
  const METRICS_EVERY_MS = Math.max(10_000, Number(process.env.ADVENTURER_METRICS_MS) || 5 * 60_000);
  const IDLE_NOTE_MS = 60_000;
  const tickCost = { count: 0, totalMs: 0, maxMs: 0 };
  let metricsAt = 0;

  function xpBySkill(player) {
    const out = {};
    const manager = player.getSkillManager();
    for (const skill of core.Skill.values()) out[skill.getName().toLowerCase()] = manager.getExperience(skill);
    return out;
  }

  function metric(line) {
    try {
      metricsLog.write(`${JSON.stringify({ at: new Date().toISOString(), v: GAME_VERSION, ...line })}\n`);
    } catch {
      // A help, not a must.
    }
  }

  /** Where this tick's time went for this adventurer, and an idle note when it stands still. */
  function account(entry, nowMs, dt) {
    const m = (entry.metrics ??= { since: nowMs, time: {}, xp: xpBySkill(entry.player), coins: null, events: {} });
    const total = Object.values(xpBySkill(entry.player)).reduce((sum, xp) => sum + xp, 0);
    if (total !== entry.xpTotal) {
      entry.xpTotal = total;
      entry.xpAt = nowMs;
    }
    trackJob(entry, nowMs);
    let kind;
    if (entry.phase === "quest") kind = "quest";
    else if (errands.busy(entry.player)) kind = "errand";
    else if ((entry.phase === "training" || entry.phase === "boss") && awayFromJob(entry)) kind = "walking";
    else if (entry.phase === "training" || entry.phase === "boss") kind = nowMs - (entry.xpAt ?? nowMs) > 20_000 ? "idle" : "working";
    else kind = entry.phase ?? "other";
    m.time[kind] = (m.time[kind] ?? 0) + dt;
    if (kind === "working" && entry.activity) (m.activities ??= {})[entry.activity] = ((m.activities ?? {})[entry.activity] ?? 0) + dt;
    if (kind === "idle") {
      entry.idleMs = (entry.idleMs ?? 0) + dt;
      if (entry.idleMs >= IDLE_NOTE_MS && !entry.idleNoted) {
        entry.idleNoted = true;
        m.events.idle = (m.events.idle ?? 0) + 1;
        const at = entry.player.getLocation();
        const state = stateOf(entry.player);
        metric({ kind: "idle", bot: entry.name, activity: entry.activity ?? null, mode: entry.plan?.mode ?? null, brain: brainSnapshot(entry),
          where: [at.getX(), at.getY(), at.getZ()], home: state?.home ?? null, hp: entry.player.getHitpoints?.(),
          inCombat: Boolean(entry.player.getCombat?.()?.getTarget?.()), freeSlots: entry.player.getInventory().getFreeSlots(),
          brainAction: state?.brain?.action?.id ?? state?.brain?.current ?? null });
      }
    } else {
      entry.idleMs = 0;
      entry.idleNoted = false;
    }
  }

  /**
   * One "job" line when a job ends: what it was for (mode, reason, the level it aimed at), how
   * long it ran, the XP it brought, and how it ended (target reached, time up, full bag, stuck,
   * quest done or failed, a trip in between). A "goal" line when a goal is set, reached or dropped.
   */
  function jobKey(entry) {
    if (entry.phase === "quest") return `quest:${entry.questRun?.name ?? "?"}`;
    if (entry.phase === "training" || entry.phase === "boss") return `${entry.phase}:${entry.plan?.mode ?? entry.plan?.boss?.id ?? "?"}:${entry.plan?.reason ?? ""}`;
    return null;
  }

  function trackJob(entry, nowMs) {
    const key = jobKey(entry);
    const job = entry.job;
    if (job && job.key === key) return;
    if (job) {
      const xp = Object.values(xpBySkill(entry.player)).reduce((sum, v) => sum + v, 0);
      const level = job.target ? (job.target.skill === "COMBAT" ? entry.player.getSkillManager().getCombatLevel() : levelOf(entry.player, job.target.skill)) : null;
      // Coins per hour this job brought (bag and bank; what it spent on its supplies counts against
      // it), kept per mode as a running mean: its own measure for "make money" stretches.
      const coinsNow = wealthOf(entry.player)?.total ?? 0;
      const hours = (nowMs - job.startedAt) / 3_600_000;
      const coinsPerHour = hours >= 3 / 60 && Number.isFinite(job.coins) ? Math.round((coinsNow - job.coins) / hours) : null;
      if (coinsPerHour !== null && job.mode && job.key.startsWith("training")) {
        const earn = (entry.earn ??= {});
        earn[job.mode] = earn[job.mode] === undefined ? coinsPerHour : Math.round(earn[job.mode] * 0.6 + coinsPerHour * 0.4);
      }
      metric({ kind: "job", bot: entry.name, job: job.key.split(":")[0], mode: job.mode, coinsPerHour, activity: job.activity ?? entry.activity ?? null, reason: job.reason, target: job.target,
        levelAtStart: job.levelAtStart, levelAtEnd: level, targetMet: job.target ? level >= job.target.level : null,
        minutes: Math.round((nowMs - job.startedAt) / 6000) / 10, xp: Math.round(xp - job.xp),
        ended: entry.jobEnd ?? (key === null ? `then ${entry.phase}` : "replaced") });
    }
    entry.jobEnd = null;
    // A new job starts its own "no progress" clock (stuck()): standing still at the GE before
    // it began is not standing still at the job.
    entry.lastMark = null;
    entry.lastMarkAt = nowMs;
    if (!key) {
      entry.job = null;
      return;
    }
    const target = entry.plan?.target ?? null;
    entry.job = { key, mode: entry.plan?.mode ?? null, activity: entry.activity ?? null, coins: wealthOf(entry.player)?.total ?? null, reason: entry.phase === "quest" ? entry.questRun?.name : entry.plan?.reason ?? null, target,
      startedAt: nowMs, xp: Object.values(xpBySkill(entry.player)).reduce((sum, v) => sum + v, 0),
      levelAtStart: target ? (target.skill === "COMBAT" ? entry.player.getSkillManager().getCombatLevel() : levelOf(entry.player, target.skill)) : null };
  }

  function goalMetric(entry, goal, event) {
    metric({ kind: "goal", bot: entry.name, event, goal: Goals.describe(goal), detail: goal,
      minutes: goal.setAt ? Math.round((Date.now() - goal.setAt) / 6000) / 10 : null });
  }

  /**
   * What its brain was doing at that moment, for a stuck or idle line: the running action and its
   * own account of itself (TrainCombat: site, target, approach, failures), the NPCs around it by
   * name and level, its HP and free slots. Enough to see why, not only that.
   */
  function brainSnapshot(entry) {
    const player = entry.player;
    const out = { hp: player.getHitpoints?.() ?? null, freeSlots: player.getInventory().getFreeSlots() };
    try {
      const brain = runtimeEntry(player)?.brain;
      const frame = brain?.frames?.[brain.frames.length - 1];
      const action = frame?.action?.();
      out.activity = frame?.behaviour?.id ?? null;
      out.action = action?.id ?? null;
      out.describe = action?.describe?.(brain.context(frame, now())) ?? null;
    } catch (error) {
      out.describeError = String(error?.message ?? error);
    }
    try {
      const counts = new Map();
      for (const npc of core.World.getNpcsNear(player.getLocation(), 12, player.getPrivateArea?.() ?? null)) {
        const definition = npc.getCurrentDefinition?.(player) ?? npc.getDefinition?.();
        if (!(definition?.getCombatLevel?.() > 0)) continue;
        const key = `${definition.getName?.()} (${definition.getCombatLevel()})`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      out.npcsNear = Object.fromEntries([...counts].slice(0, 12));
    } catch {
      // A help, not a must.
    }
    return out;
  }

  /** Counts something that happened to this adventurer for its next metrics line. */
  function countEvent(entry, name) {
    if (!entry) return;
    const m = (entry.metrics ??= { since: now(), time: {}, xp: xpBySkill(entry.player), coins: null, events: {} });
    m.events[name] = (m.events[name] ?? 0) + 1;
  }

  function writeMetrics(nowMs) {
    // Which skills got trained this round, by how many, with how much XP and by what activity.
    const bySkill = {};
    for (const entry of adventurers.values()) {
      const m = entry.metrics;
      if (!m || !entry.player?.isRegistered?.()) continue;
      const xp = xpBySkill(entry.player);
      const gained = {};
      for (const [skill, value] of Object.entries(xp)) if (value > (m.xp[skill] ?? 0)) gained[skill] = Math.round(value - m.xp[skill]);
      for (const [skill, amount] of Object.entries(gained)) {
        const own = (bySkill[skill] ??= { bots: 0, xp: 0, by: {} });
        own.bots += 1;
        own.xp += amount;
        const how = (m.activities && Object.keys(m.activities).join("+")) || entry.activity || entry.phase || "?";
        own.by[how] = (own.by[how] ?? 0) + amount;
      }
      const at = entry.player.getLocation();
      const coins = wealthOf(entry.player);
      const minutes = (ms) => Math.round(ms / 6000) / 10;
      metric({
        kind: "bot", bot: entry.name, clan: Clans.clanOf(data, entry.name)?.name ?? null,
        minutes: minutes(nowMs - m.since), combat: entry.player.getSkillManager().getCombatLevel(),
        phase: entry.phase, mode: entry.plan?.mode ?? null, reason: entry.plan?.reason ?? null, target: entry.plan?.target ?? null,
        activity: entry.activity ?? null, quest: entry.questRun?.name ?? null, goal: Goals.describe(entry.player.getAttribute(GOAL_ATTRIBUTE) ?? null) ?? null,
        where: [at.getX(), at.getY(), at.getZ()], place: describeLocation(entry.player, { x: at.getX(), y: at.getY() }),
        xpGained: gained, xpPerHour: Math.round(Object.values(gained).reduce((sum, v) => sum + v, 0) / Math.max(1, (nowMs - m.since) / 3_600_000)),
        coins, coinsGained: m.coins === null ? null : coins - m.coins,
        // Which processing skills it could take up now (coins or own stock) and has stock for.
        canProcess: buyableSkills(entry.player), stocked: stockedSkills(entry.player),
        time: Object.fromEntries(Object.entries(m.time).map(([kind, ms]) => [kind, minutes(ms)])), events: m.events,
      });
      entry.metrics = { since: nowMs, time: {}, xp, coins, events: {} };
    }
    metric({ kind: "skills", trained: bySkill,
      untouched: core.Skill.values().map((skill) => skill.getName().toLowerCase()).filter((skill) => !bySkill[skill]) });
    let bots = 0;
    try {
      core.World.getPlayers().forEach((player) => { if (player?.isPlayerBot?.()) bots += 1; });
    } catch {}
    const memory = process.memoryUsage();
    metric({ kind: "server", adventurers: adventurers.size, bots, tickAvgMs: tickCost.count ? Math.round(tickCost.totalMs / tickCost.count * 10) / 10 : null,
      tickMaxMs: Math.round(tickCost.maxMs), heapMb: Math.round(memory.heapUsed / 1048576), rssMb: Math.round(memory.rss / 1048576),
      questsBlocked: [...questsBlocked].filter(([, until]) => until > nowMs).map(([name]) => name) });
    Object.assign(tickCost, { count: 0, totalMs: 0, maxMs: 0 });
  }

  /** Quests blocked for every adventurer (noteQuestFailure): name -> until; and recent failures. */
  const questsBlocked = new Map();
  const questFailuresAll = new Map();

  /** The last stuck quests, newest first (recordQuestFeedback). */
  const questFeedback = [];
  /** name -> { name, player, phase, until, plan, startedAt } */
  const adventurers = new Map();
  // Quests played for real (QuestPlay.PlayerBots.js): walk, Talk-to, answer.
  const questPlay = createQuestPlay({
    core, world, now,
    walkTo: (entry, to, options) => walkTo(entry, to, options),
    note: (player, text, type) => note(player, text, type),
    quests: () => QuestRuntime.getRegisteredQuests(),
    stateOf: (player) => runtimeEntry(player)?.state ?? null,
    // Quests without a hand-written playthrough: the real Quest Helper's steps (when it runs).
    helper: createHelperSteps({ core, now, log: (event, details) => world.log?.(event, details) }),
    // An item a quest step needs: from its bank, else a shop or the Grand Exchange.
    acquire: (entry, ids, amount, name) => acquireForQuest(entry, ids, amount, name),
    metric: (line) => metric(line),
    // "Purchase a bucket from ...": the item by its name, bought where it is sold.
    buyNamed: (entry, name) => {
      const id = Shopping.idOf(core, String(name).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/S$/, ""))
        ?? Shopping.idOf(core, String(name).toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
      if (!Number.isInteger(id)) return false;
      if (entry.player.getInventory().getAmount(id) > 0) return false;
      return acquireForQuest(entry, [id], 1, String(name));
    },
  });

  /** Fetches or buys an item a quest step needs; true when an errand for it started. */
  function acquireForQuest(entry, ids, amount = 1, name = null) {
    const player = entry.player;
    // What the quest needs first: a walk to its next step (to Doric with no clay) gives way to
    // the errand for it; a second errand beside the first was refused ("cannot get it").
    if (errands.busy(player) && entry.errand?.reason === "quest") {
      errands.errands?.delete?.(player);
      entry.errand = null;
    }
    const banked_ = ids.find((id) => banked(player, id) > 0);
    if (banked_ !== undefined) {
      const bank = nearestBank(player, entry);
      if (!bank) return false;
      return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
        reason: "quest", replan: false,
        arrive: (banker) => {
          const got = withdraw(banker, banked_, amount);
          if (got > 0) note(banker, `Haalt ${got} x ${itemName(banked_)} van de bank voor zijn quest.`, "quest");
        },
      });
    }
    const label = name ?? itemName(ids[0]);
    for (const id of ids) {
      if (Shopping.shopsSelling(id).length > 0 && shopFor(entry, id, label, amount, { replan: false })) return true;
      if (buyOnExchange(entry, id, label, amount, { replan: false })) return true;
    }
    // Not to be bought now: gathered itself when it is something one gathers (clay mined, logs
    // chopped, fish caught), as a player does, then back to the quest.
    for (const id of ids) if (gatherFor(entry, id, amount)) return true;
    return false;
  }

  /**
   * A gathering activity that yields this item (bot-activities.json: a rock's "resources", a
   * tree's "log", a spot's "fish") and that its level allows: done until it has `amount`, then
   * back to the quest it was on (entry.gatherFor).
   */
  function gatherFor(entry, itemId, amount) {
    const run = entry.questRun;
    if (!run) return false;
    const name = String(core.ItemDefinition?.forId?.(itemId)?.getName?.() ?? "").toLowerCase().replace(/ /g, "_");
    if (!name) return false;
    const MODE_SKILL = { mining: "MINING", woodcutting: "WOODCUTTING", fishing: "FISHING" };
    for (const activity of definitions.activities ?? []) {
      const template = activity.template ? definitions.templates?.[activity.template] : null;
      const mode = activity.mode ?? template?.mode;
      if (!MODE_SKILL[mode]) continue;
      const fields = activity.fields ?? {};
      const yields = [...(fields.resources ?? []), fields.log, fields.fish].filter(Boolean).map((v) => String(v).toLowerCase());
      if (!yields.includes(name)) continue;
      if (levelOf(entry.player, MODE_SKILL[mode]) < Number(fields.level ?? 1)) continue;
      entry.gather = { itemId, amount, quest: run.name };
      entry.questRun = null;
      const started = startTraining(entry, { kind: "train", mode, skill: MODE_SKILL[mode], activity: activity.id,
        reason: `${itemName(itemId).toLowerCase()} voor ${run.name}` }, now());
      if (!started) {
        entry.gather = null;
        entry.questRun = run;
        continue;
      }
      note(entry.player, `Kan ${itemName(itemId).toLowerCase()} niet kopen; gaat het zelf verzamelen voor ${run.name}.`, "quest");
      return true;
    }
    return false;
  }

  // Quests only get added (at boot); the map is rebuilt when their number changes.
  let questIndex = { size: -1, map: new Map() };
  function questsByName() {
    const quests = QuestRuntime.getRegisteredQuests();
    if (questIndex.size !== quests.length) {
      const map = new Map();
      for (const quest of quests) map.set(normalize(quest.name), quest);
      questIndex = { size: quests.length, map };
    }
    return questIndex.map;
  }

  function journal(player) {
    const entries = player.getAttribute(LOG_ATTRIBUTE);
    return Array.isArray(entries) ? entries : [];
  }

  /** A journal line of a kind: "skill", "quest", "boss", "drop" or "activity" (the page's tabs). */
  function note(player, text, type = "activity") {
    const entries = [...journal(player), { at: now(), type, text }];
    // Every line also in the activity log, to look back at what an adventurer did and where.
    try {
      const at = player.getLocation?.();
      activityLog.write(`${JSON.stringify({ at: new Date().toISOString(), v: GAME_VERSION, bot: player.getUsername?.(), type, text,
        where: at ? [at.getX(), at.getY(), at.getZ()] : null })}\n`);
    } catch {
      // A help, not a must.
    }
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
    for (const quest of questList()) {
      if (registered.get(normalize(quest.name))?.isComplete(player)) done.add(quest.name);
    }
    return {
      // Recipes keyed by something other than a skill (SMELTING) go by their level skill.
      levels: (() => {
        const levels = skillLevels(player);
        for (const [key, recipe] of Object.entries(data.buyToTrain ?? {})) if (recipe.levelSkill) levels[key] = levels[recipe.levelSkill] ?? 1;
        return levels;
      })(),
      combat: player.getSkillManager().getCombatLevel(),
      questPoints: Number(player.getAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE)) || 0,
      done,
      buyable: buyableSkills(player),
      stocked: stockedSkills(player),
      styles: fightingStyles(player),
      slayer: slayerView(player),
      // Only quests a bot can really play (none yet): nothing is simulated.
      available: new Set(questList().filter((quest) => questPlay.ready(quest.name)
        && registered.has(normalize(quest.name)) && !questAside(player, quest.name))
        .map((quest) => quest.name)),
    };
  }

  /** Slayer in its options: { task: true/false } when it can do Slayer now, else null. */
  function slayerView(player) {
    const entry = [...adventurers.values()].find((other) => other.player === player);
    if (!entry || (entry.slayerPausedUntil ?? 0) > now()) return null;
    // A master's tasks are fights: not before it can hold its own (combat 10).
    if (player.getSkillManager().getCombatLevel() < (data.slayerCombat ?? 10)) return null;
    return { task: Slayer.currentTask(emit, player) !== null };
  }

  /**
   * At the exchange (it has a bank): noted materials, as the exchange hands out a big lot, go
   * into the bank and one bag's worth comes out as the item itself, as a player swaps them.
   * Without this a bot stood with 14 noted herbs it could not use and its bid "never filled".
   */
  function swapNotes(buyer, buy) {
    clearForProcessing(buyer, buy);
    const notes = (buyer.getInventory().getItems() ?? []).filter((item) => item && item.getId() > 0
      && buy.materials.includes(baseId(item.getId())) && baseId(item.getId()) !== item.getId())
      .map((item) => ({ itemId: item.getId(), amount: item.getAmount() }));
    if (notes.length > 0) deposit(buyer, notes);
    for (const id of buy.materials) {
      if (buyer.getInventory().getAmount(id) <= 0 && banked(buyer, id) > 0) {
        withdraw(buyer, id, Math.min(buy.amount, Math.floor(27 / buy.materials.length)));
      }
    }
  }

  /**
   * At a bank before a processing job: everything but its materials, the tool of the recipe and
   * its coins goes in, as a player empties the bag before fletching or making potions (the
   * owner's rule: only what is processed, and how, in the bag).
   */
  function clearForProcessing(banker, buy) {
    const tool = buy.recipe.tool ? Shopping.idOf(core, buy.recipe.tool) : null;
    const keep = new Set([...buy.materials, Trade.COINS, ...(Number.isInteger(tool) ? [tool] : [])]);
    const goods = [];
    for (const item of banker.getInventory().getItems() ?? []) {
      const id = item?.getId?.() ?? -1;
      if (!(id > 0) || keep.has(baseId(id)) || goods.some((good) => good.itemId === id)) continue;
      goods.push({ itemId: id, amount: banker.getInventory().getAmount(id) });
    }
    const stored = deposit(banker, goods);
    if (stored.length > 0) note(banker, `Zet op de bank voor ${buy.skill.toLowerCase()}: ${stored.slice(0, 5).map((good) => itemName(good.itemId).toLowerCase()).join(", ")}${stored.length > 5 ? ` en ${stored.length - 5} meer` : ""}.`, "activity");
  }

  /** The materials it would buy for a skill now: { skill, recipe, itemId, name, amount, cost }, or null. */
  function buyPlan(player, skill) {
    const recipe = data.buyToTrain?.[skill];
    if (!recipe) return null;
    const level = levelOf(player, recipe.levelSkill ?? skill);
    const [, names] = recipe.tiers.find(([needed]) => level >= needed) ?? [];
    if (!names) return null;
    const materials = (Array.isArray(names) ? names : [names]).map((name) => Shopping.idOf(core, name));
    if (!materials.every(Number.isInteger)) return null;
    const cost = materials.reduce((sum, id) => {
      const guide = Number(core.ItemDefinition?.forId?.(id)?.getGrandExchangeValue?.() ?? 0) || 1;
      return sum + Math.ceil(guide * 1.05) * recipe.amount;
    }, 0);
    return { skill, recipe, itemId: materials[0], materials, amount: recipe.amount, cost };
  }

  /** Skills it can afford to train on bought materials (with coins to spare for food and tools). */
  function buyableSkills(player) {
    // Its coins in the bag and in the bank: at the exchange it takes them out of its bank.
    const coins = Shopping.coinsOf(player) + banked(player, Trade.COINS);
    const done = questDone(player);
    return Object.keys(data.buyToTrain ?? {}).filter((skill) => {
      // Herblore needs Druidic Ritual first, as for a player.
      if (data.buyToTrain[skill].quest && !done(data.buyToTrain[skill].quest)) return false;
      // A tool it cannot buy (the air talisman Sedridor gives back): only with one of its own.
      const recipe = data.buyToTrain[skill];
      if (recipe.ownTool && !Shopping.ownsAnywhere(player, Shopping.idOf(core, recipe.tool))) return false;
      const plan = buyPlan(player, skill);
      // Its own stock (the logs it chopped, the ore it smelted) is enough; else coins to buy.
      // Enough for a smaller lot (ten at least) is enough to start: it buys what it can pay.
      return plan && (hasStock(player, plan) || coins >= Math.ceil(plan.cost * Math.min(1, 10 / plan.amount)) + 200);
    });
  }

  /** It has the materials for this (in its bag or bank): what it gathered feeds the next skill. */
  function hasStock(player, plan) {
    return plan.materials.every((id) => banked(player, id) + player.getInventory().getAmount(id) >= 5);
  }

  function goalHelpers(player) {
    const worn = new Set((player.getEquipment().getItems() ?? []).map((item) => item?.getId?.()).filter((id) => id > 0));
    return {
      gear: Shopping.gear,
      styles: fightingStyles(player),
      levelOf: (skill) => levelOf(player, skill),
      owns: (id) => Number.isInteger(id) && (player.getInventory().contains(id) || banked(player, id) > 0),
      worn: (id) => worn.has(id),
      priceOf: (id) => {
        const guide = Number(core.ItemDefinition?.forId?.(id)?.getGrandExchangeValue?.() ?? 0);
        return guide > 0 ? Math.ceil(guide * 1.05) : 0;
      },
      questDone: questDone(player),
      idOf: (name) => Shopping.idOf(core, name),
      variant: (entry) => Shopping.variantOf(core, entry, player),
      coins: Shopping.coinsOf(player) + banked(player, Trade.COINS),
    };
  }

  /** Its goal now: the stored one until reached, then the next (in its journal both). */
  function goalOf(entry) {
    const player = entry.player;
    const helpers = goalHelpers(player);
    let goal = player.getAttribute(GOAL_ATTRIBUTE) ?? null;
    if (goal && Goals.reached(goal, helpers)) {
      note(player, `Doel gehaald: ${Goals.describe(goal)}.`, "skill");
      goalMetric(entry, goal, "reached");
      // Saved up for a piece: it goes and buys it now (the shop, else the exchange).
      if (goal.kind === "coins" && goal.item) entry.buyGoal = goal.item;
      goal = null;
    }
    // A goal for a piece it already has (on it or in its bank), level or coins: done with.
    if (goal?.item) {
      const id = Shopping.idOf(core, goal.item);
      if (Number.isInteger(id) && Shopping.ownsAnywhere(player, id)) {
        goalMetric(entry, goal, "dropped: has it");
        goal = null;
      }
    }
    // A goal for a piece it has by now (bought, found, or something better on): no longer a goal.
    if (goal?.item && !Goals.candidates(null, helpers).some((other) => other.item === goal.item || other.why === goal.why)) {
      if (goal.kind === "coins") {
        goalMetric(entry, goal, "dropped: has it or better");
        goal = null;
      }
    }
    // A Ranged or Magic goal it can no longer work at (no bow and arrows, no runes): a new one.
    const styleOf = { RANGED: "ranged", MAGIC: "magic" };
    if (goal?.kind === "level" && styleOf[goal.skill] && !helpers.styles.includes(styleOf[goal.skill])) {
      goalMetric(entry, goal, "dropped: cannot train that style");
      goal = null;
    }
    if (!goal) {
      goal = Goals.pickGoal(helpers, random);
      if (goal) {
        goal = { ...goal, setAt: Date.now() };
        note(player, `Nieuw doel: ${Goals.describe(goal)}.`, "activity");
        goalMetric(entry, goal, "set");
      }
      player.setAttribute(GOAL_ATTRIBUTE, goal);
    }
    return goal;
  }

  /** The ways it can fight now: a bow it owns with arrows, runes for a spell. */
  function fightingStyles(player) {
    const styles = [];
    const has = (name, amount = 1) => {
      const id = Shopping.idOf(core, name);
      return Number.isInteger(id) && player.getInventory().getAmount(id) + banked(player, id)
        + ((player.getEquipment().getItems() ?? []).find((item) => item?.getId?.() === id)?.getAmount?.() ?? 0) >= amount;
    };
    const ranged = Shopping.gear.styles?.ranged ?? {};
    if ((ranged.weapon ?? []).some((entry) => has(entry.item)) && (ranged.ammo ?? []).some((entry) => has(entry.item, SUPPLY_MIN))) styles.push("ranged");
    if (has("AIR_RUNE", SUPPLY_MIN) && has("MIND_RUNE", SUPPLY_MIN)) styles.push("magic");
    return styles;
  }

  /** The things a way of fighting uses: bows and arrows, or runes and staves. */
  function styleSupplyIds(style) {
    const gear = Shopping.gear.styles ?? {};
    const all = (name) => Object.values(gear[name] ?? {}).flat().map((entry) => entry.item);
    const names = style === "ranged" ? all("ranged") : style === "magic" ? [...MAGIC_RUNES, ...all("magic")] : [];
    return names.map((name) => Shopping.idOf(core, name)).filter(Number.isInteger);
  }

  /** How the job fights: "ranged", "magic", "melee", or null for a job that does not fight. */
  function planStyle(entry, plan = entry.plan) {
    if (!plan) return null;
    if (plan.mode === "combat_ranged") return "ranged";
    if (plan.mode === "combat_magic") return "magic";
    if (plan.kind === "boss" || plan.mode === "combat_training" || plan.mode === "slayer") {
      return plan.style ?? runtimeEntry(entry.player)?.state?.honestStyle ?? "melee";
    }
    return null;
  }

  /** Whether it carries enough to fight this way now: a bow and SUPPLY_MIN arrows, or runes for SUPPLY_MIN casts. */
  function carriesSupplies(player, style) {
    const worn = (id) => (player.getEquipment().getItems() ?? []).find((item) => item?.getId?.() === id)?.getAmount?.() ?? 0;
    const held = (name) => { const id = Shopping.idOf(core, name); return Number.isInteger(id) ? player.getInventory().getAmount(id) + worn(id) : 0; };
    const gear = Shopping.gear.styles ?? {};
    if (style === "ranged") {
      return (gear.ranged?.weapon ?? []).some((entry) => held(entry.item) > 0)
        && (gear.ranged?.ammo ?? []).some((entry) => held(entry.item) >= SUPPLY_MIN);
    }
    if (style === "magic") return held("AIR_RUNE") >= SUPPLY_MIN && held("MIND_RUNE") >= SUPPLY_MIN;
    return true;
  }

  /**
   * The tools a job uses: { any: [...] } (one of them: the best axe or pickaxe it has) and
   * { all: [...] } (each: a fishing rod and its feathers). Names as in adventurer-gear.json.
   */
  function toolsFor(mode, activityId = null, skill = null) {
    const gear = Shopping.gear;
    const names = (list) => (list ?? []).map((entry) => entry.item);
    const bySkill = { FIREMAKING: ["TINDERBOX"], SMITHING: ["HAMMER"], FLETCHING: ["KNIFE"], CRAFTING: ["CHISEL", "NEEDLE"] };
    if (mode === "woodcutting") return { any: names(gear.tools.axe), all: [] };
    if (mode === "mining") return { any: names(gear.tools.pickaxe), all: [] };
    if (mode === "fishing" || mode === "hunter") return { any: [], all: gear.fishingTools[activityId] ?? [] };
    if (String(mode).startsWith("buy_") || mode === "wintertodt") {
      const recipe = data.buyToTrain?.[skill];
      return { any: recipe?.tool ? [recipe.tool] : bySkill[skill] ?? [], all: [] };
    }
    return { any: [], all: [] };
  }

  /** Tools the job needs that are in its bank and not on it: [itemId], best first. */
  function toolsInBank(player, mode, activityId = null, skill = null) {
    const { any, all } = toolsFor(mode, activityId, skill);
    const fetch = [];
    const ids = (list) => list.map((name) => Shopping.idOf(core, name)).filter(Number.isInteger);
    const anyIds = ids(any);
    if (anyIds.length > 0 && !anyIds.some((id) => Shopping.owns(player, id))) {
      const best = anyIds.find((id) => banked(player, id) > 0);
      if (best !== undefined) fetch.push(best);
    }
    for (const id of ids(all)) if (!Shopping.owns(player, id) && banked(player, id) > 0) fetch.push(id);
    return fetch;
  }

  /** To the nearest bank for the job's tools, then the job again (its saved-task resume). */
  function fetchTools(entry, plan, ids) {
    const bank = nearestBank(entry.player, entry);
    if (!bank) return false;
    return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
      reason: "withdraw",
      arrive: (banker) => {
        let got = 0;
        for (const id of ids) got += withdraw(banker, id, 1000);
        if (got > 0) {
          note(banker, `Haalt zijn ${ids.map(itemName).join(" en ").toLowerCase()} van de bank.`, "activity");
          entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
        }
      },
    });
  }

  /** At a bank: tools the job does not use go in (no hammer and pickaxes along for net fishing). */
  function bankUnusedTools(entry, banker, plan = entry.plan) {
    // No job yet (a new account's first bank visit): its starter tools stay with it.
    if (!plan) return [];
    const needed = new Set(Object.values(toolsFor(plan?.mode, plan === entry.plan ? entry.activity : plan.activity, plan?.skill)).flat()
      .map((name) => Shopping.idOf(core, name)).filter(Number.isInteger));
    const all = [...Object.values(Shopping.gear.tools ?? {}).flat().map((entry) => entry.item),
      ...Object.values(Shopping.gear.fishingTools ?? {}).flat(), "TINDERBOX", "HAMMER", "CHISEL", "NEEDLE", "KNIFE"];
    const goods = [];
    for (const id of new Set(all.map((name) => Shopping.idOf(core, name)).filter(Number.isInteger))) {
      if (needed.has(id)) continue;
      const amount = banker.getInventory().getAmount(id);
      if (amount > 0) goods.push({ itemId: id, amount });
    }
    return deposit(banker, goods);
  }

  /**
   * At a bank: the arrows, bows and runes of the ways of fighting the job does not use go in
   * (a woodcutter does not carry 300 arrows about). Those of its own style stay with it.
   */
  function bankUnusedSupplies(entry, banker, plan = entry.plan) {
    const using = planStyle(entry, plan);
    const goods = [];
    // Prayer potions are stock for its fights, as food is: in the bank for a job without one.
    const fighting = plan?.kind === "boss" || DANGER_MODES.has(plan?.mode);
    if (!fighting) {
      for (const item of banker.getInventory().getItems() ?? []) {
        if (item && item.getId() > 0 && PRAYER_RESTORE.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? ""))
            && !goods.some((good) => good.itemId === item.getId())) {
          goods.push({ itemId: item.getId(), amount: banker.getInventory().getAmount(item.getId()) });
        }
      }
    }
    // Law runes and the elements of the teleport spells stay with it (it teleports from its bag).
    const travel = new Set(["LAW_RUNE", "AIR_RUNE", "EARTH_RUNE", "WATER_RUNE", "FIRE_RUNE"].map((name) => Shopping.idOf(core, name)).filter(Number.isInteger));
    const teleports = banker.getInventory().getAmount(Shopping.idOf(core, "LAW_RUNE")) > 0;
    for (const style of ["ranged", "magic"]) {
      if (style === using) continue;
      for (const id of styleSupplyIds(style)) {
        if (teleports && travel.has(id)) continue;
        const amount = banker.getInventory().getAmount(id);
        if (amount > 0) goods.push({ itemId: id, amount });
      }
    }
    return deposit(banker, goods);
  }

  /** Skills it has the materials for now: they weigh more in its next pick (one skill feeds another). */
  function stockedSkills(player) {
    return Object.keys(data.buyToTrain ?? {}).filter((skill) => {
      const plan = buyPlan(player, skill);
      return plan && hasStock(player, plan);
    });
  }

  function stateOf(player) {
    return runtime.botStatesByName?.get?.(player.getUsername());
  }



  function here(player) {
    const at = player.getLocation();
    return { x: at.getX(), y: at.getY(), z: at.getZ() };
  }

  function runtimeEntry(player) {
    return runtime.entriesByUsername?.get?.(player.getUsername?.());
  }

  const BLOCKED_MS = 15 * 60_000;
  const placeKey = (to) => `${to.x},${to.y},${to.z ?? 0}`;
  function blockedPlace(entry, to) {
    return (entry?.blockedPlaces?.get(placeKey(to)) ?? 0) > now();
  }

  /** A blocked place within `radius` tiles (the other skeletons behind the same locked door). */
  function blockedNear(entry, to, radius) {
    for (const [key, until] of entry?.blockedPlaces ?? []) {
      if (until <= now()) continue;
      const [x, y, z] = key.split(",").map(Number);
      if (z === (to.z ?? 0) && Math.max(Math.abs(x - to.x), Math.abs(y - to.y)) <= radius) return true;
    }
    return false;
  }

  function placeName(to) {
    return String(to.name ?? to.id ?? `${to.x}, ${to.y}`).replace(/_/g, " ");
  }

  /**
   * Walks there (Errands.PlayerBots.js) and runs `arrive` on arrival. With `replan` the planner
   * looks again once it is there (after a sale or a purchase); without it the job it started
   * goes on (a walk to the trees is part of the stretch). False when it cannot go now.
   */
  /**
   * Stranded (an island after a quest, behind Draynor Manor's fence, down a dungeon): three walks
   * that failed from about the same spot in fifteen minutes and it casts the home teleport, as a
   * player who is stuck does (its plugin keeps the 30-minute cooldown and the combat check).
   */
  /**
   * The Al Kharid toll gate beside it, on the far side of where it is going: clicked through its
   * own options (Pay-toll with 10 coins, else Open after the quest), and the walk sent again.
   * Bots on the Al Kharid side stood at the gate with millions and never paid it.
   */
  // Ways between the surface and the map's underground (6400 tiles north: the Dwarven Mine, the
  // Mining Guild, dungeons), from the live-game transport table the agents' travel_to uses
  // (plugins/agent/data/transports.json, Shortest Path). Only plain ones: a skill level at most,
  // no items, quests or varbits asked.
  const UNDERGROUND_Y = 6400;
  const LEVEL_HOPS = (() => {
    try {
      const data = require("../../agent/data/transports.json");
      const rows = data?.transports?.transports ?? [];
      const hops = [];
      for (const [from, to, menu, id, skills, items, quests, varbits, varps] of rows) {
        if (!Array.isArray(from) || !Array.isArray(to) || items || quests || varbits || varps) continue;
        if ((from[1] >= UNDERGROUND_Y) === (to[1] >= UNDERGROUND_Y)) continue;
        if (!/^(climb-(down|up)|enter|leave|exit|go-down|go-up|walk-down|walk-up)\b/i.test(String(menu ?? ""))) continue;
        const needs = [...String(skills ?? "").matchAll(/(\d+)\s+([A-Za-z]+)/g)].map(([, level, skill]) => ({ level: Number(level), skill: skill.toUpperCase() }));
        hops.push({ from: { x: from[0], y: from[1], z: from[2] }, to: { x: to[0], y: to[1], z: to[2] }, menu: String(menu), id, needs });
      }
      return hops;
    } catch {
      return [];
    }
  })();

  /** The way down or up to reach `to` when it is on the other side of the ground, or null. */
  function levelHop(player, to) {
    const here = player.getLocation();
    const goingDown = to.y >= UNDERGROUND_Y;
    if ((here.getY() >= UNDERGROUND_Y) === goingDown) return null;
    let best = null;
    let bestCost = Infinity;
    for (const hop of LEVEL_HOPS) {
      if ((hop.to.y >= UNDERGROUND_Y) !== goingDown || hop.from.z !== here.getZ() || hop.to.z !== (to.z ?? 0)) continue;
      if (hop.needs.some(({ level, skill }) => levelOf(player, skill) < level)) continue;
      // The landing near the goal (the same mine or dungeon), the way in not too far off.
      const landing = Math.max(Math.abs(hop.to.x - to.x), Math.abs(hop.to.y - to.y));
      if (landing > 120) continue;
      const cost = Math.max(Math.abs(hop.from.x - here.getX()), Math.abs(hop.from.y - here.getY())) + 3 * landing;
      if (cost < bestCost) { bestCost = cost; best = hop; }
    }
    return best;
  }

  /** Clicks the hop's stairs or ladder (by its id near the tile, else by its name). */
  function clickHop(player, hop) {
    const [verb, ...rest] = hop.menu.split(" ");
    const name = rest.join(" ").toLowerCase();
    const seenOf = (object) => { try { return core.ObjectDefinition.forPlayer?.(object.getId(), player) ?? core.ObjectDefinition.forId(object.getId()); } catch { return core.ObjectDefinition.forId(object.getId()); } };
    let found = null;
    let best = Infinity;
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dy = -3; dy <= 3; dy += 1) {
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(hop.from.x + dx, hop.from.y + dy, hop.from.z)) ?? []) {
          const definition = seenOf(object);
          const byId = object.getId() === hop.id;
          if (!byId && String(definition?.getName?.() ?? "").toLowerCase() !== name) continue;
          const index = (definition?.getInteractions?.() ?? []).findIndex((option) => String(option ?? "").toLowerCase() === verb.toLowerCase());
          if (index < 0) continue;
          const away = Math.max(Math.abs(dx), Math.abs(dy)) - (byId ? 0.5 : 0);
          if (away < best) { best = away; found = { object, definition, index }; }
        }
      }
    }
    if (!found) return false;
    const { object, definition, index } = found;
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, definition, objectId: object.getId(), clickType: index + 1,
        location: { x: object.getLocation().getX(), y: object.getLocation().getY(), z: object.getLocation().getZ() }, handled: false,
      }),
    });
    return true;
  }

  const TOLL_GATE = { x: 3268, ys: [3227, 3228] };
  function crossTollGate(entry, player, to) {
    const at = player.getLocation();
    if (at.getZ() !== 0 || Math.abs(at.getX() - TOLL_GATE.x) > 2 || at.getY() < 3225 || at.getY() > 3230) return false;
    const goingWest = to.x < TOLL_GATE.x && at.getX() >= TOLL_GATE.x;
    const goingEast = to.x >= TOLL_GATE.x && at.getX() < TOLL_GATE.x;
    if (!goingWest && !goingEast) return false;
    if (now() < (entry.tollAt ?? 0)) return false;
    entry.tollAt = now() + 15_000;
    const y = TOLL_GATE.ys.includes(at.getY()) ? at.getY() : TOLL_GATE.ys[0];
    // A multi-loc: its base definition is nameless; as this player sees it, a Gate with Pay-toll.
    const seenOf = (object) => { try { return core.ObjectDefinition.forPlayer?.(object.getId(), player) ?? core.ObjectDefinition.forId(object.getId()); } catch { return core.ObjectDefinition.forId(object.getId()); } };
    const gate = (core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(TOLL_GATE.x, y, 0)) ?? [])
      .find((object) => /gate/i.test(String(seenOf(object)?.getName?.() ?? ""))
        || (seenOf(object)?.getInteractions?.() ?? []).some((option) => /^pay-toll/i.test(String(option ?? ""))));
    if (!gate) return false;
    const seen = seenOf(gate);
    const options = (seen?.getInteractions?.() ?? []).map((option) => String(option ?? ""));
    // Open only after Prince Ali Rescue (free passage); before it Open starts the guard's talk, which
    // a bot does not hold: then the toll, with 10 coins in its bag, or not at all.
    const free = questsByName().get(normalize("Prince Ali Rescue"))?.isComplete(player) === true;
    let index = free ? options.findIndex((option) => /^open$/i.test(option)) : -1;
    if (index < 0 && player.getInventory().getAmount(Trade.COINS) >= 10) index = options.findIndex((option) => /^pay-toll/i.test(option));
    if (index < 0) return false;
    const loc = gate.getLocation();
    player.getMovementQueue().walkToObject(gate, {
      execute: () => world.emitObjectInteraction?.({
        player, object: gate, objectId: gate.getId(), clickType: index + 1,
        location: { x: loc.getX(), y: loc.getY(), z: loc.getZ() }, handled: false,
      }),
    });
    note(player, `Gaat door de tolpoort van Al Kharid (${options[index].toLowerCase()}).`, "activity");
    metric({ kind: "toll_gate", bot: entry.name, option: options[index], to: placeName(to), where: [at.getX(), at.getY(), at.getZ()] });
    // After the crossing: the walk again (the quest or the job asks for it on its next look).
    if (entry.phase === "errand") entry.until = now() + 5_000;
    return true;
  }

  /** The home teleport through its plugin (cooldown, combat check, animation); true when cast. */
  function castHome(player) {
    const check = { player, check: true, ready: false, destination: null };
    emit("home-teleport:cast", check);
    if (!check.ready) return false;
    const cast = { player, started: false };
    emit("home-teleport:cast", cast);
    if (cast.started !== true) return false;
    // The cast takes some 16 seconds and any step or click breaks it off: its brain rests and the
    // manager leaves it alone until it has landed (it was broken off at once, every few minutes
    // again, on the same roof).
    const entry = adventurers.get(player.getUsername?.());
    if (entry) {
      entry.homeUntil = now() + 20_000;
      errands.errands?.delete?.(player);
      entry.errand = null;
      const brain = runtimeEntry(player)?.brain;
      if (brain) brain.paused = true;
    }
    return true;
  }

  /**
   * The protection prayer a player turns on against a foe that hits hard in one style (the Barrows
   * brothers, the Giant Mole, Sarachnis), when its Prayer level and points allow it; off again
   * once the fight is over, as points drain while it is on. Turned on through the game's prayer
   * handler, so the drain, the head icon and the level checks are the game's.
   */
  const PROTECT_AGAINST = [
    { names: /^(dharok|guthan|torag|verac)|giant mole|sarachnis/i, prayer: "PROTECT_FROM_MELEE", level: 43 },
    { names: /^karil/i, prayer: "PROTECT_FROM_MISSILES", level: 40 },
    { names: /^ahrim/i, prayer: "PROTECT_FROM_MAGIC", level: 37 },
  ];
  /** Restores prayer points: the first prayer potion or super restore in the bag, drunk. */
  const PRAYER_RESTORE = /^(prayer potion|super restore|sanfew serum)\(\d\)$/i;
  function drinkPrayer(entry, nowMs) {
    const player = entry.player;
    if (nowMs < (entry.drinkPrayerAt ?? 0) || !api.emitItemAction) return false;
    const items = player.getInventory().getItems() ?? [];
    const slot = items.findIndex((item) => item && item.getId() > 0
      && PRAYER_RESTORE.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? "")));
    if (slot < 0) return false;
    const item = items[slot];
    const actions = core.CacheDefinitions?.getItem?.(item.getId())?.inventoryActions ?? [];
    const index = actions.findIndex((option) => option === "Drink");
    if (index < 0) return false;
    entry.drinkPrayerAt = nowMs + 3_000;
    api.emitItemAction({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot,
      clickType: index + 1, option: "Drink", handled: false });
    return true;
  }

  function protectionPrayer(entry, nowMs) {
    const player = entry.player;
    let PrayerHandler;
    try {
      ({ PrayerHandler } = require("../../../src/main/typescript/elvarg/game/content/PrayerHandler"));
    } catch {
      return;
    }
    const target = player.getCombat?.()?.getTarget?.() ?? player.getCombat?.()?.getAttacker?.() ?? null;
    const name = target?.isNpc?.() ? String(target.getDefinition?.()?.getName?.() ?? "") : "";
    const want = name ? PROTECT_AGAINST.find((entry) => entry.names.test(name)) : null;
    const points = player.getSkillManager().getCurrentLevel(core.Skill.PRAYER);
    if (want && levelOf(player, "PRAYER") >= want.level && points > 0) {
      entry.prayingUntil = nowMs + 8_000;
      // Points running low: a prayer potion (or a super restore) drunk, as a player keeps the
      // prayer up; without one the prayer goes off and the brother hits through.
      if (points * 10 < levelOf(player, "PRAYER") * 3) drinkPrayer(entry, nowMs);
      const id = PrayerHandler[want.prayer];
      if (!PrayerHandler.isActivated(player, id)) PrayerHandler.activatePrayerPrayerId(player, id);
      return;
    }
    // A few seconds after the fight (the next brother may come at once): all off again.
    if (entry.prayingUntil && nowMs > entry.prayingUntil) {
      entry.prayingUntil = null;
      PrayerHandler.deactivatePrayers(player);
    }
  }

  function unstrand(entry, player) {
    const at = player.getLocation();
    const recent = (entry.blockedFrom ?? []).filter((spot) => now() - spot.at < 15 * 60_000
      && spot.z === at.getZ() && Math.max(Math.abs(spot.x - at.getX()), Math.abs(spot.y - at.getY())) <= 10);
    recent.push({ x: at.getX(), y: at.getY(), z: at.getZ(), at: now() });
    entry.blockedFrom = recent;
    if (recent.length < 3) return;
    if (castHome(player)) {
      entry.blockedFrom = [];
      countEvent(entry, "teleportedOut");
      metric({ kind: "stranded", bot: entry.name, where: [at.getX(), at.getY(), at.getZ()] });
      note(player, "Zit vast en kan nergens heen; teleporteert naar huis (Lumbridge).", "activity");
    }
  }

  function walkTo(entry, to, { reason, arrive = () => {}, replan = true, say = true, urgent = false, hopped = false } = {}) {
    const run = runtimeEntry(entry.player);
    // On the other side of the ground (the Dwarven Mine below Falador, the Mining Guild): first to
    // the stairs or ladder, down or up as a player goes, then on from where it lands (tickAll).
    const hop = hopped ? null : levelHop(entry.player, to);
    if (hop) {
      const options = { reason, arrive, replan, say, urgent };
      return walkTo(entry, { ...hop.from, name: placeName(to) }, {
        reason, replan, say: false, urgent, hopped: true,
        arrive: (player) => {
          if (!clickHop(player, hop)) {
            note(player, `Vond de ${hop.menu.toLowerCase()} naar ${placeName(to)} niet.`, "activity");
            return;
          }
          note(player, `${hop.menu.split(" ")[0].replace(/-/g, " ")} (${hop.menu.split(" ").slice(1).join(" ").toLowerCase()}) op weg naar ${placeName(to)}.`, "activity");
          metric({ kind: "level_hop", bot: entry.name, menu: hop.menu, from: [hop.from.x, hop.from.y, hop.from.z], to: placeName(to) });
          entry.afterHop = { to, options, down: hop.to.y >= UNDERGROUND_Y, until: now() + 20_000 };
        },
      });
    }
    // On a rooftop course it first runs the course down (getOffRoof); no errand from up there.
    if (entry.offRoof && entry.player.getLocation().getZ() > 0 && reason !== "agility") return false;
    // `urgent`: a full bag to bank goes even while other errands rest after a failed one.
    if (!run || errands.busy(entry.player) || (replan && !urgent && (entry.noErrandUntil ?? 0) > now())) return false;
    if (blockedPlace(entry, to)) return false;
    // The errand walks it through its brain's navigation (doors, stairs, long routes). A new
    // adventurer has none until its first job, and its first move is often an errand (the bank):
    // without one it never took a step, gave up after a minute and tried the next bank forever.
    if (!run.brain && !startActivity(entry.player, "roam", { home: here(entry.player), nowMs: now() })) return false;
    // A quest's walks hand back to the quest, not to the job's brain (its roaming walked the bot
    // off the castle stairs the moment it got there).
    const hold = () => { if (reason === "quest" && run.brain) run.brain.paused = true; };
    const started = errands.go(run, to, {
      reason,
      arrive: (player) => {
        hold();
        entry.errand = null;
        try {
          arrive(player);
        } finally {
          if (replan) entry.until = 0;
        }
      },
      fail: (player) => {
        hold();
        entry.errand = null;
        // Already there in all but the last tile (the spot itself in a hut or on rocks): there.
        const here = player.getLocation();
        if (here.getZ() === (to.z ?? 0) && Math.max(Math.abs(here.getX() - to.x), Math.abs(here.getY() - to.y)) <= NEAR_ENOUGH_TILES) {
          try {
            arrive(player);
          } finally {
            if (replan) entry.until = 0;
          }
          return;
        }
        // At the Al Kharid toll gate and the walk got no further: through it as a player does
        // (Pay-toll, or Open after Prince Ali Rescue), then the walk again from the other side.
        if (crossTollGate(entry, player, to)) return;
        note(player, `Kwam niet bij ${placeName(to)}: de weg was versperd.`, "activity");
        // From under the ground to a place above it: up the ladder at the next look.
        if (here.getY() >= 6400 && to.y < 6400) entry.climbOut = true;
        countEvent(entry, "walkBlocked");
        unstrand(entry, player);
        const at = player.getLocation();
        metric({ kind: "walk_blocked", bot: entry.name, reason, to: { name: placeName(to), x: to.x, y: to.y, z: to.z ?? 0 },
          where: [at.getX(), at.getY(), at.getZ()], tilesLeft: Math.max(Math.abs(at.getX() - to.x), Math.abs(at.getY() - to.y)),
          doorAttempt: stateOf(player)?.doorAttempt ? { id: stateOf(player).doorAttempt.objectId ?? stateOf(player).doorAttempt.object?.getId?.() ?? null } : null,
          coins: Shopping.coinsOf(player), ...brainSnapshot(entry) });
        // That place is out for a while; the next bank or shop is still fine.
        // A quest's walk tries again (doors, another way); its own tries decide when to give up.
        if (reason !== "quest") (entry.blockedPlaces ??= new Map()).set(placeKey(to), now() + BLOCKED_MS);
        if (replan) {
          if (!["bank", "exchange"].includes(reason)) entry.noErrandUntil = now() + 10 * 60_000;
          entry.until = 0;
        }
      },
    });
    if (!started) return false;
    // A teleport for the way there (a spell, a tablet broken, jewellery rubbed: the game's own
    // option, its charge and animation): in its log and the metrics (kind teleport), with the
    // charges left, so the logs show they are used and used up.
    const teleport = errands.errands?.get?.(entry.player)?.teleport;
    if (teleport) {
      const label = teleport.kind === "home" ? "home teleport" : teleport.kind === "spell" ? `spreuk ${teleport.name}`
        : teleport.kind === "tablet" ? `tablet (${teleport.name})` : `sieraad naar ${teleport.name}`;
      note(entry.player, `Teleporteert met ${label} richting ${placeName(to)}.`, "activity");
      metric({ kind: "teleport", bot: entry.name, how: teleport.kind, name: teleport.name ?? null, to: placeName(to), reason });
    }
    // What the page shows while it walks.
    entry.errand = { to: placeName(to), reason, since: now() };
    if (replan) {
      entry.phase = "errand";
      entry.until = Infinity;
    }
    // Already there (a second purchase at the GE): no "walks to" for a walk it does not make.
    const at = entry.player.getLocation();
    const there = at.getZ() === (to.z ?? 0) && Math.max(Math.abs(at.getX() - to.x), Math.abs(at.getY() - to.y)) <= 6;
    if (say && !there) note(entry.player, `Loopt naar ${placeName(to)}.`, "activity");
    return true;
  }

  function startTraining(entry, plan, nowMs) {
    const { player } = entry;
    const view = snapshot(player);
    // Only a Slayer task narrows what it fights; any other job fights what it finds.
    const own = runtimeEntry(player);
    if (own?.state && plan.mode !== "slayer") own.state.onlyNames = null;
    // A Slayer task is a fight too: food along first, from its bank or a shop.
    if (plan.mode === "slayer" && stockFood(entry, plan, nowMs)) return true;
    if (plan.mode === "slayer" && !carriesFood(player) && entry.needFood) {
      return startTraining(entry, { kind: "train", mode: "fishing", skill: "FISHING", reason: "eten vangen" }, nowMs);
    }
    if (plan.mode === "slayer") return startSlayer(entry, plan, nowMs);
    if (getTravelFood(entry, plan, nowMs)) return true;
    if (plan.mode.startsWith("buy_")) {
      return startBuyTraining(entry, plan, nowMs);
    }
    if (plan.mode === "combat_ranged" || plan.mode === "combat_magic") {
      const style = plan.mode === "combat_ranged" ? "ranged" : "magic";
      // Enough arrows or runes on it before it sets off; what is in the bank it fetches there,
      // in person, and then starts. Not enough anywhere: not this way of fighting now.
      if (!carriesSupplies(player, style)) {
        const bank = nearestBank(player, entry);
        if (!fightingStyles(player).includes(style) || !bank) return false;
        return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
          reason: "withdraw",
          arrive: (banker) => {
            let got = 0;
            for (const id of styleSupplyIds(style)) {
              if (banked(banker, id) > 0 && banker.getInventory().getFreeSlots() > 2) got += withdraw(banker, id, 10_000);
            }
            if (got > 0) {
              note(banker, `Haalt zijn ${style === "ranged" ? "boog en pijlen" : "runes"} van de bank om te ${style === "ranged" ? "boogschieten" : "toveren"}.`, "activity");
              entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
            }
          },
        });
      }
      const run = runtimeEntry(player);
      if (run?.state) run.state.honestStyle = style;
      return startTraining(entry, { ...plan, mode: "combat_training", style }, nowMs);
    }
    if (plan.mode === "combat_training" && !plan.style) {
      const run = runtimeEntry(player);
      if (run?.state) run.state.honestStyle = "melee";
    }
    if (plan.mode === "agility") {
      const level = levelOf(player, "AGILITY");
      // The best course its level allows and its quests open (Canifis is in Morytania, behind
      // Priest in Peril), that it has not found blocked lately.
      const course = (data.agilityCourses ?? []).find((option) => level >= option.level
        && (option.quests ?? []).every((name) => questsByName().get(normalize(name))?.isComplete(player) === true)
        && !blockedPlace(entry, option));
      if (!course || !registry?.byId?.get(`agility_${course.course}`)) return false;
      startActivity(player, `agility_${course.course}`, { home: course, nowMs });
      walkTo(entry, course, { reason: "agility", replan: false });
      entry.activity = `agility_${course.course}`;
      entry.phase = "training";
      entry.plan = plan;
      entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
      entry.walkedMs = 0;
      note(player, `Loopt rondjes op de ${course.name}.`);
      return true;
    }
    if (plan.mode === "hunter") {
      // Bird snaring where its level's birds live (bot-activities.json: the action's site): its
      // snares first (bank, shop or GE), then the walk there, and the stretch from arrival.
      const id = bestActivity("hunter", levelOf(player, "HUNTER"), definitions);
      const activity = id ? registry?.byId?.get(id) ?? null : null;
      const site = definitions.activities.find((entry) => entry.id === id)?.actions?.[0]?.site;
      if (!activity || !site) {
        note(player, `Kan niet gaan jagen: geen jachtplek voor zijn level (${id ?? "geen"}).`, "activity");
        return false;
      }
      const place = { x: site[0], y: site[1], z: 0 };
      if (!TravelHubs.onFoot(place)) {
        note(player, "Kan niet gaan jagen: de jachtplek is te voet niet bereikbaar.", "activity");
        return false;
      }
      const bankedTools = toolsInBank(player, "hunter", id);
      if (bankedTools.length > 0) return fetchTools(entry, plan, bankedTools);
      const snare = Shopping.missingTools(player, core, id)[0];
      if (snare) {
        if (shopFor(entry, snare.itemId, snare.name, 2)) return true;
        note(player, `Kan niet gaan jagen: kon geen ${String(snare.name).toLowerCase().replace(/_/g, " ")} kopen.`, "activity");
        return false;
      }
      startActivity(player, id, { home: place, nowMs });
      walkTo(entry, { ...place, name: "de Feldip Hills" }, { reason: "training", replan: false });
      entry.activity = id;
      entry.phase = "training";
      entry.plan = plan;
      entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
      entry.walkedMs = 0;
      note(player, "Gaat vogels vangen met een bird snare in de Feldip Hills.");
      return true;
    }
    if (plan.mode === "wintertodt") {
      // Wintertodt is in Kourend: by boat, not on foot. Not until it can get there.
      if (!TravelHubs.onFoot(WINTERTODT)) return false;
      startActivity(player, "wintertodt", { home: WINTERTODT, nowMs });
      walkTo(entry, { ...WINTERTODT, name: "Wintertodt" }, { reason: "wintertodt", replan: false });
      entry.activity = "wintertodt";
    } else {
      const level = plan.mode === "combat_training" ? view.combat : view.levels[plan.skill] ?? 1;
      // A quest's own errand names its activity (clay_rocks for Doric's clay); else the best one.
      const id = plan.activity ?? reachableActivity(player, plan.mode, level);
      // Fighting on an empty stomach is how adventurers die: food first, if it can buy some.
      // Thieving too: the knights and guards hit back ("low hp, no food" ended most stretches).
      if ((plan.mode === "combat_training" || plan.mode === "thieving") && stockFood(entry, plan, nowMs)) return true;
      // A gathering job wants room for what it gathers: things for other jobs (a pickaxe, snares,
      // a pot) go to the bank first, as a player empties the bag before a fishing trip.
      // A quest's few pieces of clay need no empty bag: only room for them.
      const room = entry.gather ? Math.min(18, entry.gather.amount + 1) : 18;
      if (["woodcutting", "mining", "fishing"].includes(plan.mode) && player.getInventory().getFreeSlots() < room
          && nowMs >= (entry.clearBagAt ?? 0)) {
        // Not again for a few minutes; for 20 when the bank could take nothing (all of it needed).
        entry.clearBagAt = nowMs + 3 * 60_000;
        const bank = nearestBank(player, entry);
        if (bank && walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
          reason: "bank",
          arrive: (banker) => {
            const stored = [...bankUnusedTools(entry, banker, { ...plan, activity: plan.activity ?? id }), ...bankUnusedSupplies(entry, banker, plan), ...deposit(banker, sortBag(banker).keep)];
            if (stored.length > 0) note(banker, `Maakt zijn tas leeg voor ${plan.mode}: ${stored.map((good) => itemName(good.itemId)).join(", ")}.`, "activity");
            else entry.clearBagAt = now() + 20 * 60_000;
            entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
          },
        })) return true;
      }
      // Nothing to eat and none to be had: fish first (and cook it), not fight hungry.
      if (plan.mode === "combat_training" && !carriesFood(player) && entry.needFood && view.combat >= 10) {
        return startTraining(entry, { kind: "train", mode: "fishing", skill: "FISHING", reason: "eten vangen" }, nowMs);
      }
      // Its axe, pickaxe, net or rod at the bank: fetched first, in person.
      const bankedTools = toolsInBank(player, plan.mode, id);
      if (bankedTools.length > 0) return fetchTools(entry, plan, bankedTools);
      // No axe or pickaxe at all: the best one its level allows, bought now (a shop, or the GE).
      if (plan.mode === "woodcutting" || plan.mode === "mining") {
        const toolIds = toolsFor(plan.mode).any.map((name) => Shopping.idOf(core, name)).filter(Number.isInteger);
        if (!toolIds.some((toolId) => Shopping.ownsAnywhere(player, toolId))) {
          const want = Shopping.shoppingList(player, core, { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player), modes: [plan.mode] })
            .find((entry) => toolIds.includes(entry.itemId));
          if (want) return shopFor(entry, want.itemId, want.name);
          // None to be had now (too few coins, no shop near): not off to the rocks or trees with
          // bare hands; another job, and the coins first.
          note(player, `Heeft geen ${plan.mode === "mining" ? "pickaxe" : "axe"} en kan er nu geen kopen; doet eerst iets anders.`, "activity");
          return false;
        }
      }
      // Fishing needs its net, rod or harpoon: bought first (a walk to the shop), or no fishing now.
      const tool = Shopping.missingTools(player, core, id)[0];
      if (tool) return shopFor(entry, tool.itemId, tool.name, tool.name === "FEATHER" || tool.name === "FISHING_BAIT" ? 200 : 1);
      const activity = id ? registry?.byId?.get(id) ?? null : null;
      if (!activity) return false;
      // Its own choice of spot (Sites.PlayerBots.js): the nearest fitting one, not the world
      // bots' travel with its hubs and spreading.
      const place = Sites.pickSite(player, activity, {
        core, random, distance: (from, to, who) => siteDistance(from, to, who, plan.mode),
        meets: (who, requires, site) => travelMeets(who, requires, site), destinations: destinationsFor(id, player),
      });
      // A job that belongs at a place (trees, rocks, stalls, fishing spots) with none it can reach
      // now: not started where it happens to stand (redwoods "at" Lumbridge or the GE, round and
      // round); the planner picks something else.
      if (!place && (["woodcutting", "mining", "fishing", "thieving"].includes(plan.mode)
          || Sites.sitesFor(activity, 99, { meets: () => true, destinations: destinationsFor(id, null) }).length > 0)) {
        world.log?.("adventurer_no_site", { name: entry.name, activity: id, mode: plan.mode });
        metric({ kind: "no_site", bot: entry.name, activity: id, mode: plan.mode, reason: plan.reason ?? null });
        return false;
      }
      Sites.settleAt(stateOf(player), place);
      if (place) world.log?.("adventurer_site", { name: entry.name, activity: id, site: place.id });
      const home = stateOf(player)?.home ?? null;
      startActivity(player, id, { home, nowMs });
      if (place && home) walkTo(entry, { ...home, name: place.id }, { reason: "training", replan: false });
      entry.activity = id;
    }
    entry.phase = "training";
    entry.plan = plan;
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
    entry.walkedMs = 0;
    note(player, `Traint ${plan.skill === "COMBAT" ? "combat" : plan.skill.toLowerCase()} (${String(entry.activity).replace(/_/g, " ")}) voor ${plan.reason}.`);
    return true;
  }

  /**
   * Training on bought materials: its own tool first (bought if near), then the materials at the
   * Grand Exchange (a bid a little over the guide), then the work where it is done (logs at the
   * exchange, bars at the Varrock anvils). The products are sold at the next visit.
   */
  function startBuyTraining(entry, plan, nowMs) {
    const { player } = entry;
    const buy = buyPlan(player, plan.skill);
    if (!buy) return false;
    // Lately too poor for a lot at the exchange: only with its own stock, not a walk to buy.
    if (nowMs < (entry.noBuyUntil ?? 0) && !hasStock(player, buy)) return false;
    const toolId = buy.recipe.tool ? Shopping.idOf(core, buy.recipe.tool) : null;
    if (Number.isInteger(toolId) && !Shopping.owns(player, toolId)) {
      // Its knife or hammer at the bank: fetched there, not bought again.
      if (banked(player, toolId) > 0) return fetchTools(entry, plan, [toolId]);
      return shopFor(entry, toolId, buy.recipe.tool, 1);
    }
    entry.plan = plan;
    if (buy.materials.every((id) => player.getInventory().getAmount(id) > 0)) {
      const station = buy.recipe.station ?? null;
      const home = station ?? (() => { const at = player.getLocation(); return { x: at.getX(), y: at.getY(), z: at.getZ() }; })();
      startActivity(player, buy.recipe.activity, { home, nowMs });
      if (station) walkTo(entry, station, { reason: "station", replan: false });
      entry.activity = buy.recipe.activity;
      entry.phase = "training";
      entry.buying = buy.itemId;
      entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
      entry.walkedMs = 0;
      note(player, `Traint ${plan.skill.toLowerCase()} met ${buy.materials.map(itemName).join(" en ")}.`);
      return true;
    }
    // A clanmate with spare stock hands it over before it spends coins on it.
    for (const id of buy.materials) {
      if (banked(player, id) + player.getInventory().getAmount(id) <= 0) fromClan(entry, id, buy.amount);
    }
    // Its own stock first: banked logs or bars, fetched from the nearest bank.
    if (buy.materials.every((id) => banked(player, id) + player.getInventory().getAmount(id) > 0)) {
      const bank = nearestBank(player);
      const ge = { ...data.grandExchange, name: "de Grand Exchange" };
      const to = !bank || distanceTo(player, ge) <= bank.away ? ge : { ...bank, name: bank.name ?? bank.id };
      return walkTo(entry, to, {
        reason: "withdraw",
        arrive: (banker) => {
          clearForProcessing(banker, buy);
          const share = Math.floor(28 / buy.materials.length) - 1;
          const got = buy.materials.reduce((sum, id) => sum + withdraw(banker, id, Math.min(buy.amount, share)), 0);
          if (got > 0) {
            note(banker, `Haalt ${buy.materials.map(itemName).join(" en ")} van de bank om ${plan.skill.toLowerCase()} te trainen.`, "activity");
            entry.resume = plan;
            entry.waitingSince = now();
          }
        },
      });
    }
    // To the exchange for the materials; it waits there for the bid to fill.
    return walkTo(entry, { ...data.grandExchange, name: "de Grand Exchange" }, {
      reason: "buy_materials",
      arrive: (buyer) => {
        emit("ge:collect", { player: buyer });
        swapNotes(buyer, buy);
        const missing = buy.materials.filter((id) => buyer.getInventory().getAmount(id) <= 0);
        if (missing.length === 0) {
          entry.resume = plan;
          entry.waitingSince = now();
          return;
        }
        // As many as its coins pay for (bag and bank; the exchange has a bank), keeping 200 over.
        const perLot = buy.cost / buy.amount;
        const wealth = Shopping.coinsOf(buyer) + banked(buyer, Trade.COINS);
        // A stock for several loads (up to ten bags), as a player buys a lot and banks it, when its
        // coins allow it with half of them to spare; else one load.
        const loads = Math.max(1, Math.min(10, Math.floor((wealth / 2) / Math.max(1, perLot * buy.amount))));
        const amount = Math.max(0, Math.min(buy.amount * loads, Math.floor((wealth - 200) / Math.max(1, perLot))));
        // A lot of one or two is not worth the walk (and the next walk for the next one): ten at least.
        if (amount < Math.min(10, buy.amount)) {
          note(buyer, `Te weinig geld voor een partij ${missing.map(itemName).join(" en ")}; doet eerst iets anders.`, "activity");
          entry.noBuyUntil = now() + 30 * 60_000;
          return;
        }
        const short = Math.ceil(perLot * amount) + 50 - Shopping.coinsOf(buyer);
        if (short > 0) withdraw(buyer, Trade.COINS, short);
        if (!missing.every((id) => bid(buyer, core, emit, id, amount))) {
          note(buyer, `Kon niet op alles bieden (${missing.map(itemName).join(", ")}).`, "activity");
          return;
        }
        note(buyer, `Biedt op ${amount} x ${missing.map(itemName).join(" en ")} (~${Math.ceil(perLot * amount).toLocaleString("nl-NL")} gp) om ${plan.skill.toLowerCase()} te trainen.`, "activity");
        entry.resume = plan;
        entry.waitingSince = now();
      },
    });
  }

  /**
   * A boss behind a way in (boss.via): its tools first, then the way itself, as a player goes.
   * The Giant Mole: a spade and a light (the Mole Hole is dark), walk to a Falador Park mole hill
   * and dig with the spade's Dig. True while it is on its way in (an errand set off); false when
   * it is in (or the boss needs nothing) and the fight can start; null when it cannot get in.
   */
  function enterBoss(entry, plan, nowMs) {
    const { player } = entry;
    const via = plan.boss.via;
    if (!via) return false;
    const here = player.getLocation();
    if (Math.max(Math.abs(here.getX() - plan.boss.x), Math.abs(here.getY() - plan.boss.y)) <= 150) return false;
    const resume = () => { entry.savedTask = { kind: "boss", bossId: plan.boss.id, reason: plan.reason ?? "verder", remainingMs: 0, savedAt: now() }; };
    for (const name of [via.tool, via.light].filter(Boolean)) {
      const id = Shopping.idOf(core, name);
      if (!Number.isInteger(id) || player.getInventory().getAmount(id) > 0) continue;
      if (banked(player, id) > 0) {
        const bank = nearestBank(player, entry);
        if (bank && walkTo(entry, { ...bank, name: bank.name ?? bank.id }, { reason: "withdraw", arrive: (banker) => { withdraw(banker, id, 1); resume(); } })) return true;
        return null;
      }
      const label = itemName(id).toLowerCase();
      if ((Shopping.shopsSelling(id).length > 0 && shopFor(entry, id, label, 1)) || buyOnExchange(entry, id, label, 1)) {
        resume();
        return true;
      }
      note(player, `Kan ${plan.boss.name} niet bereiken: geen ${label} te krijgen.`, "boss");
      return null;
    }
    if (via.kind === "dig") {
      const spade = Shopping.idOf(core, via.tool);
      const started = walkTo(entry, { ...via.at, name: via.name }, {
        reason: "boss", replan: false,
        arrive: (digger) => {
          const items = digger.getInventory().getItems() ?? [];
          const slot = items.findIndex((item) => item && item.getId() === spade);
          if (slot >= 0) {
            api.emitItemAction?.({ player: digger, interfaceId: core.Inventory.INTERFACE_ID, item: items[slot], itemId: spade, slot,
              clickType: 1, option: "Dig", handled: false });
          }
          resume();
          entry.until = 0;
        },
      });
      if (started) {
        entry.phase = "errand";
        entry.until = Infinity;
        note(player, `Gaat graven in ${via.name} om bij ${plan.boss.name} te komen.`, "boss");
        return true;
      }
    }
    return null;
  }

  function startBoss(entry, plan, nowMs) {
    const { player } = entry;
    const { boss } = plan;
    if (!registry?.byId?.get(boss.id)) return false;
    // Behind a way in (a spade and a mole hill): that first.
    const entering = enterBoss(entry, plan, nowMs);
    if (entering === true) return true;
    if (entering === null) return false;
    // Prayer potions along for a boss it prays against (Protect from Melee and up): its own from
    // the bank, else bought, then back to this boss. Once in half an hour at most, so a bot too
    // poor for them does not walk to the exchange before every fight.
    if (levelOf(player, "PRAYER") >= 43 && PROTECT_AGAINST.some((entry) => entry.names.test(boss.name ?? "")) && nowMs >= (entry.prayerPotAt ?? 0)) {
      const potion = Shopping.idOf(core, "PRAYER_POTION_4_");
      // Its bank's stock first, part-drunk ones too (3, 2 or 1 dose), then a full one bought.
      const doses = ["PRAYER_POTION_4_", "PRAYER_POTION_3_", "PRAYER_POTION_2_", "PRAYER_POTION_1_", "SUPER_RESTORE_4_", "SUPER_RESTORE_3_"]
        .map((name) => Shopping.idOf(core, name)).filter(Number.isInteger);
      const carried = (player.getInventory().getItems() ?? []).filter((item) => item && PRAYER_RESTORE.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? ""))).length;
      if (Number.isInteger(potion) && carried < 2) {
        entry.prayerPotAt = nowMs + 30 * 60_000;
        entry.savedTask = { kind: "boss", bossId: boss.id, reason: plan.reason ?? "verder", remainingMs: 0, savedAt: now() };
        if (acquireForQuest(entry, doses.length > 0 ? doses : [potion], 4, "prayer potions")) {
          note(player, `Gaat prayer potions halen voor ${boss.name}.`, "boss");
          return true;
        }
        entry.savedTask = null;
      }
    }
    startActivity(player, boss.id, { home: boss, nowMs });
    walkTo(entry, boss, { reason: "boss", replan: false });
    entry.phase = "boss";
    entry.plan = plan;
    entry.activity = boss.id;
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
    entry.walkedMs = 0;
    note(player, `Gaat ${boss.name} bevechten${entry.group ? " (samen)" : ""}.`, "boss");
    return true;
  }

  /**
   * A quest with a bot playthrough. None is built yet, so the planner never offers one
   * (snapshot().available is empty); when one is, it starts here.
   */
  function startQuest(entry, plan) {
    if (!questPlay.start(entry, plan.quest.name, now())) {
      note(entry.player, `${plan.quest.name} heeft nog geen bot-playthrough; overgeslagen.`, "quest");
      return false;
    }
    entry.phase = "quest";
    entry.plan = plan;
    entry.activity = null;
    entry.until = Infinity;
    note(entry.player, `Begint aan de quest ${plan.quest.name}.`, "quest");
    return true;
  }

  /** A quest it could not finish lately (an NPC it could not find, a stuck walk). */
  function questAside(player, name) {
    const entry = adventurers.get(player.getUsername?.());
    return (entry?.questsAside?.get(name) ?? 0) > now() || (questsBlocked.get(name) ?? 0) > now();
  }

  /**
   * A quest two different adventurers got stuck in within two hours is blocked for all of them
   * for three hours (logged): the others do not each walk into the same wall.
   */
  function noteQuestFailure(name, bot) {
    const recent = (questFailuresAll.get(name) ?? []).filter((failure) => now() - failure.at < 2 * 60 * 60_000);
    recent.push({ bot, at: now() });
    questFailuresAll.set(name, recent);
    if (new Set(recent.map((failure) => failure.bot)).size >= 2 && !((questsBlocked.get(name) ?? 0) > now())) {
      questsBlocked.set(name, now() + 3 * 60 * 60_000);
      world.log?.("adventurer_quest_blocked", { quest: name, bots: [...new Set(recent.map((failure) => failure.bot))] });
      recordQuestFeedback({ name: "(alle avonturiers)" }, { quest: name, reason: `blocked for every adventurer for 3 h: stuck for ${new Set(recent.map((failure) => failure.bot)).size} bots` });
    }
  }

  /** The quest's planning tick: walking, climbing, talking; done or put aside. */
  function questTick(entry, nowMs) {
    const run = entry.questRun;
    // Its job's brain rests meanwhile (it would walk back to its fishing spot mid-talk); an
    // errand walk drives it on its own and leaves it unpaused when it ends.
    const brain = runtimeEntry(entry.player)?.brain;
    const busy = errands.busy(entry.player);
    if (brain && !busy) brain.paused = true;
    // On a rooftop course (Al Kharid's roofs have no ladder): the course down first, then the
    // quest again, not "no stairs found" for every quest it tries from up there.
    if (!busy && entry.plan?.quest && roofCourse(entry.player.getLocation())) {
      entry.afterRoof = entry.plan.quest;
      entry.questRun = null;
      if (brain) brain.paused = false;
      getOffRoof(entry, nowMs);
      return;
    }
    const result = questPlay.tick(entry, nowMs, { busy });
    if (result === "running") return;
    if (brain) brain.paused = false;
    entry.questRun = null;
    if (result === "done") {
      note(entry.player, `Quest voltooid: ${run.name}!`, "quest");
      const startedAt = run.history?.[0]?.at ? Date.parse(run.history[0].at) : null;
      metric({ kind: "quest_done", bot: entry.name, quest: run.name, guide: run.helperKey ? "quest-helper" : "playthrough",
        minutes: startedAt ? Math.round((Date.now() - startedAt) / 6000) / 10 : null, steps: run.history?.length ?? null,
        dialogue: run.dialogue ?? [] });
      entry.jobEnd = "quest done";
    } else {
      // Stuck: put aside (longer each time it fails) and written down why, so the cause can be
      // fixed (logs/adventurer-quest-feedback.jsonl; also on the page's feedback list).
      const failures = (entry.questFailures ??= new Map());
      failures.set(run.name, (failures.get(run.name) ?? 0) + 1);
      (entry.questsAside ??= new Map()).set(run.name, nowMs + QUEST_ASIDE_MS * Math.min(8, 2 ** (failures.get(run.name) - 1)));
      recordQuestFeedback(entry, questPlay.describeFailure({ ...entry, questRun: run }));
      noteQuestFailure(run.name, entry.name);
      countEvent(entry, "questFailed");
      entry.jobEnd = `quest failed: ${run.reason ?? "?"}`;
      note(entry.player, `Legt ${run.name} even weg (stap ${run.step + 1} lukte niet).`, "quest");
    }
    entry.phase = "new";
    entry.plan = null;
    entry.until = 0;
    // In a sweep (::advquestall): on to the next quest no one has tried in it yet.
    if (sweep.active && nowMs < sweep.until) sweepNext(entry);
  }

  /** One stuck quest, as a line in the feedback log (and the last few in memory for the page). */
  function recordQuestFeedback(entry, failure) {
    if (!failure) return;
    const line = { at: new Date().toISOString(), bot: entry.name, ...failure };
    questFeedback.unshift(line);
    questFeedback.length = Math.min(questFeedback.length, 100);
    world.log?.("adventurer_quest_stuck", line);
    try {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(process.cwd(), "logs", "adventurer-quest-feedback.jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${JSON.stringify({ v: GAME_VERSION, ...line })}\n`);
    } catch {
      // The log is a help, not a must: the quest is put aside either way.
    }
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
    // A boss all of them can take on, together.
    const shared = (data.bosses ?? []).filter((boss) => members.every((member) => snapshot(member.player).combat >= boss.combat));
    if (shared.length > 0 && random() < 0.5) {
      const boss = shared[Math.floor(random() * shared.length)];
      for (const member of members) {
        member.group = true;
        startBoss(member, { kind: "boss", boss, reason: "samen" }, nowMs);
      }
      return true;
    }
    const firemakers = members.filter((member) => snapshot(member.player).levels.FIREMAKING >= 50);
    if (firemakers.length >= 2 && TravelHubs.onFoot(WINTERTODT)) {
      for (const member of firemakers) {
        member.group = true;
        startTraining(member, { kind: "train", mode: "wintertodt", skill: "FIREMAKING", reason: "Wintertodt samen" }, nowMs);
      }
      return true;
    }
    // Training side by side without a shared goal was aimless (five bots running about Falador
    // park, "together" with one that had gone questing): groups are for a boss or Wintertodt.
    return false;
  }

  /**
   * A buy at the Grand Exchange: the offer, and a wait there until it has come in (a player does
   * not walk off and leave his trout in the exchange). True when placed.
   */
  function bid(player, core_, emit_, itemId, amount) {
    if (!Trade.buyAtExchange(player, core_, emit_, itemId, amount)) return false;
    const entry = adventurers.get(player.getUsername?.());
    if (entry) entry.offersUntil = Math.max(entry.offersUntil ?? 0, now() + BID_WAIT_MS);
    return true;
  }

  function inventoryCounts(player) {
    const counts = new Map();
    for (const item of player.getInventory().getItems() ?? []) {
      if (item && item.getId() > 0) counts.set(item.getId(), (counts.get(item.getId()) ?? 0) + item.getAmount());
    }
    return counts;
  }

  /** Still waiting at the exchange for offers it just placed: collects what came in. */
  function waitForOffers(entry, nowMs) {
    if (!((entry.offersUntil ?? 0) > nowMs)) return false;
    const request = { player: entry.player };
    const before = inventoryCounts(entry.player);
    emit("ge:collect", request);
    if (request.collected > 0) {
      const got = [...inventoryCounts(entry.player)].filter(([id, amount]) => id !== COINS && amount > (before.get(id) ?? 0))
        .map(([id, amount]) => `${amount - (before.get(id) ?? 0)} x ${itemName(id)}`);
      if (got.length > 0) note(entry.player, `Haalt zijn aankopen op bij de GE: ${got.join(", ")}.`, "activity");
    }
    // Only its buys are worth waiting for; sell offers fill while it goes on, as for a player.
    if (!((request.waitingBuys ?? request.waiting) > 0)) {
      entry.offersUntil = 0;
      return false;
    }
    entry.phase = "waiting";
    entry.until = nowMs + 6_000;
    return true;
  }

  /**
   * Left on a rooftop course (a lap broken off halfway: Al Kharid, Varrock, Falador): the only way
   * down is on along the course, as for a player. It runs the course until it is on the ground,
   * then picks its next job; without this it stood on the roof and every quest failed there.
   */
  /** Upstairs (a house in Varrock, a bank's first floor): the nearest ladder or stairs down. */
  function climbDown(entry, nowMs, way = "down") {
    const player = entry.player;
    const at = player.getLocation();
    if (nowMs < (entry.climbDownAt ?? 0)) return true;
    let best = null;
    let bestAway = Infinity;
    let bestIndex = -1;
    for (let dx = -15; dx <= 15; dx += 1) {
      for (let dy = -15; dy <= 15; dy += 1) {
        const x = at.getX() + dx;
        const y = at.getY() + dy;
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, at.getZ())) ?? []) {
          const loc = object.getLocation();
          if (loc.getX() !== x || loc.getY() !== y || loc.getZ() !== at.getZ()) continue;
          const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((o) => String(o ?? "").toLowerCase());
          const index = options.findIndex((option) => option === `climb-${way}` || option === `climb ${way}`);
          if (index < 0) continue;
          const away = Math.max(Math.abs(dx), Math.abs(dy));
          if (away < bestAway) { best = object; bestAway = away; bestIndex = index; }
        }
      }
    }
    if (!best) return false;
    entry.climbDownAt = nowMs + 8_000;
    const loc = best.getLocation();
    player.getMovementQueue().walkToObject(best, {
      execute: () => world.emitObjectInteraction?.({
        player, object: best, objectId: best.getId(), clickType: bestIndex + 1,
        location: { x: loc.getX(), y: loc.getY(), z: loc.getZ() }, handled: false,
      }),
    });
    if (!entry.climbingDown) note(player, way === "up" ? "Staat onder de grond; klimt de ladder op." : "Staat op een verdieping; gaat de ladder of trap af.", "activity");
    entry.climbingDown = true;
    return true;
  }

  /**
   * The best activity of a mode its level allows that has a spot it can walk to: magic trees or
   * redwoods with no reachable spot (Kourend's woodcutting guild) give way to the next tier
   * down (yews), as a player chops where they can get to. Without this a high-level account
   * started the job at home and walked round Lumbridge for it.
   */
  /**
   * The places an activity can be done (adventurers.json "activitySites": magic trees only where
   * magic trees grow), else every place of its kind. Lumbridge counted as a place for magic trees.
   */
  /**
   * How far a spot is for a job: the walk there, and for a gathering job (logs, ore, fish: a
   * full bag again and again) also the walk from it to the nearest bank, as a player picks the
   * willows by a bank over the ones in the middle of nowhere.
   */
  function siteDistance(from, to, who, mode) {
    const walk = from.z !== (to.z ?? 0) ? walkTiles(from, to, who) + 50 : walkTiles(from, to, who);
    if (!["woodcutting", "mining", "fishing"].includes(mode) || !Number.isFinite(walk)) return walk;
    const toBank = Math.min(...(data.banks ?? []).map((bank) => Math.max(Math.abs(bank.x - to.x), Math.abs(bank.y - to.y))));
    return walk + (Number.isFinite(toBank) ? toBank * 1.5 : 0);
  }

  /** East of the Salve: Morytania (behind Priest in Peril). */
  function inMorytania(place) {
    return place.x >= 3400 && place.x <= 3900 && place.y >= 3150 && place.y <= 3600 && (place.z ?? 0) === 0;
  }

  function destinationsFor(id, player = null) {
    const all = require("../brain/Travel.PlayerBots").data.destinations ?? [];
    const only = data.activitySites?.[id];
    let places = Array.isArray(only) ? all.filter((place) => only.includes(place.id)) : all;
    // West of White Wolf Mountain (Catherby, Seers' Village, the Gnome Stronghold) only from combat
    // 35: the white wolves on the way killed every low-level account that went (logs, 17-11).
    if (player && player.getSkillManager().getCombatLevel() < 35) {
      places = places.filter((place) => !(place.x < 2880 && place.y >= 3380 && place.y <= 3600 && (place.z ?? 0) === 0));
    }
    // Morytania (the Slayer Tower, Canifis, Mort'ton) only after Priest in Peril, as for a player:
    // without it the walk there went north through the Wilderness and never arrived.
    if (player && questsByName().get(normalize("Priest in Peril"))?.isComplete(player) !== true) {
      places = places.filter((place) => !inMorytania(place));
    }
    // Fighting: not where the monsters are far below it (a combat 87 at Lumbridge's goblins or
    // Port Sarim's jail guards); adventurers.json "combatSiteMaxLevel".
    if (id === "combat_training" && player) {
      const combat = player.getSkillManager().getCombatLevel();
      const capped = places.filter((place) => combat <= (data.combatSiteMaxLevel?.[place.id] ?? Infinity));
      if (capped.length > 0) places = capped;
    }
    return places;
  }

  function reachableActivity(player, mode, level) {
    let last = null;
    for (let cap = level; cap >= 1; cap -= 1) {
      const id = bestActivity(mode, cap, definitions);
      if (!id) return null;
      if (id === last) continue;
      last = id;
      const activity = registry?.byId?.get(id) ?? null;
      if (!activity) return id;
      const site = Sites.pickSite(player, activity, {
        core, random: () => 0, distance: (from, to, who) => siteDistance(from, to, who, mode),
        meets: (who, requires, place) => travelMeets(who, requires, place), destinations: destinationsFor(id, player),
      });
      if (site) return id;
      // A job done anywhere (no spots of its own) is fine; a tree, rock or fishing spot is not.
      if (!["woodcutting", "mining", "fishing", "thieving"].includes(mode) && Sites.sitesFor(activity, 99, { meets: () => true }).length === 0) return id;
    }
    // Nothing of this kind it can reach now: another job instead.
    return null;
  }

  /** The rooftop course it stands on (up a floor, within 70 tiles of its start), or null. */
  function roofCourse(at) {
    if (at.getZ() === 0) return null;
    // On the course itself: one of its obstacles' start tiles on this floor within 15 tiles. Not
    // only near its start (Lumbridge castle's first floor is 68 tiles from Al Kharid's).
    const { COURSES } = require("../../skills/agility/courses/Courses.Agility");
    const course = (data.agilityCourses ?? []).find((option) => option.course !== "gnome"
      && (COURSES.find((entry) => entry.key === option.course)?.obstacles ?? []).some((obstacle) => Array.isArray(obstacle.route)
        && (obstacle.route[2] ?? 0) === at.getZ()
        && Math.max(Math.abs(at.getX() - obstacle.route[0]), Math.abs(at.getY() - obstacle.route[1])) <= 15));
    return course && registry?.byId?.get(`agility_${course.course}`) ? course : null;
  }

  function getOffRoof(entry, nowMs) {
    const player = entry.player;
    const at = player.getLocation();
    if (at.getZ() === 0) {
      entry.roofSince = null;
      // Under the ground (a basement, a dungeon: y 6400 and up) after a walk from there failed
      // (the Wizards' Tower basement to the GE): up the ladder first, then the walk again.
      if (entry.climbOut && at.getY() >= 6400) {
        if (climbDown(entry, nowMs, "up")) return true;
      }
      entry.climbOut = false;
      entry.climbingDown = false;
      return false;
    }
    // Up there for minutes and the course does not bring it down (an obstacle it cannot do from
    // where it stands): the home teleport, as a player stuck on a roof does.
    if (roofCourse(at)) entry.roofSince ??= nowMs;
    else entry.roofSince = null;
    if (entry.roofSince && nowMs - entry.roofSince > 3 * 60_000 && castHome(player)) {
      entry.roofSince = null;
      entry.offRoof = false;
      countEvent(entry, "teleportedOut");
      metric({ kind: "stranded", bot: entry.name, where: [at.getX(), at.getY(), at.getZ()], why: "roof" });
      note(player, "Komt niet van het dak af; teleporteert naar huis (Lumbridge).", "activity");
      entry.phase = "waiting";
      entry.until = nowMs + 20_000;
      return true;
    }
    // A ladder or stairs down nearby first: that is a house or a bank, not a rooftop course.
    if (!entry.offRoof && climbDown(entry, nowMs)) return true;
    const course = roofCourse(at);
    if (!course) return false;
    startActivity(player, `agility_${course.course}`, { home: course, nowMs });
    entry.activity = `agility_${course.course}`;
    entry.phase = "training";
    entry.plan = { kind: "train", mode: "agility", skill: "AGILITY", reason: "van het dak af" };
    entry.until = nowMs + 5 * 60_000;
    entry.lastMark = null;
    entry.lastMarkAt = nowMs;
    // Once a minute at most, not a line a tick when the course cannot help it either.
    if (entry.offRoof && nowMs - (entry.offRoofAt ?? 0) < 60_000) return true;
    entry.offRoofAt = nowMs;
    entry.offRoof = true;
    note(player, `Staat nog op de ${course.name}; loopt de baan af om beneden te komen.`, "activity");
    return true;
  }

  function next(entry, nowMs) {
    if (errands.busy(entry.player)) return;
    clanFunds(entry, nowMs);
    if (getOffRoof(entry, nowMs)) return;
    // Down from the roof it was on when its quest began: on with that quest now.
    if (entry.afterRoof) {
      const quest = entry.afterRoof;
      entry.afterRoof = null;
      if (startQuest(entry, { kind: "quest", quest })) return;
    }
    // A full bag halfway through a job (a money-making stretch above all): it sells or banks and
    // then goes back to the same job for the time it had left, not to something new after one load.
    if (entry.phase === "training" && entry.plan?.kind === "train" && entry.plan.mode !== "slayer"
        && Number.isFinite(entry.until) && entry.until - nowMs > 2 * 60_000 && !entry.savedTask) {
      entry.savedTask = { kind: "train", mode: entry.plan.mode, skill: entry.plan.skill, reason: entry.plan.reason,
        style: entry.plan.style ?? null, target: entry.plan.target ?? null, planActivity: entry.plan.activity ?? null, activity: entry.activity, remainingMs: entry.until - nowMs, savedAt: now(), afterTrip: true };
    }
    if (waitForOffers(entry, nowMs)) return;
    // Waiting at the exchange for its materials: collect once they are in, then to work.
    if (entry.resume) {
      const waiting = Trade.finishedOffers(entry.player, emit) > 0;
      if (waiting) emit("ge:collect", { player: entry.player });
      const resume = entry.resume;
      const buy = buyPlan(entry.player, resume.skill);
      // Collected as notes (a lot of ten bags): swapped at the exchange's bank first.
      if (buy && distanceTo(entry.player, data.grandExchange) <= 15) swapNotes(entry.player, buy);
      if (buy && buy.materials.every((id) => entry.player.getInventory().getAmount(id) > 0)) {
        entry.resume = null;
        if (startBuyTraining(entry, resume, nowMs)) return;
      } else if (nowMs - (entry.waitingSince ?? nowMs) < BID_WAIT_MS) {
        entry.phase = "waiting";
        entry.until = nowMs + 6_000;
        return;
      } else {
        entry.resume = null;
        note(entry.player, "Het bod liep niet vol; doet iets anders.", "activity");
      }
    }
    // A goal it saved up for: bought first, then worn (Trade.wearBest at the next look).
    if (entry.buyGoal) {
      const item = entry.buyGoal;
      entry.buyGoal = null;
      const id = Shopping.idOf(core, item);
      if (Number.isInteger(id) && !Shopping.ownsAnywhere(entry.player, id) && shopFor(entry, id, itemName(id), 1)) return;
    }
    // Died and left a grave: back for its things first, as a player runs back to the grave.
    if (reclaimGrave(entry)) return;
    // Errands first, each a walk; the planner looks again when it is back.
    if (trade(entry) || upgrade(entry)) return;
    // Just got a Slayer task: off to it.
    if (entry.slayerNext) {
      entry.slayerNext = false;
      if (startSlayer(entry, { kind: "train", mode: "slayer", skill: "SLAYER", reason: "nieuwe taak" }, nowMs)) return;
    }
    // A full bag and no bank or exchange it can reach now (every road it tried was blocked):
    // it weighs it up. Cheap things go; what is worth the walk stays and it tries a bank again
    // shortly instead of starting a new job with a full bag.
    if (!clearBag(entry.player)) {
      // A bag full of things it keeps (the last job's materials: 21 raw monkfish for a firemaking
      // job): to the nearest bank with them, everything but coins, food and tools goes in. It
      // waited forever beside the GE's bank otherwise.
      const bank = nearestBank(entry.player, entry);
      if (bank && walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
        reason: "bank",
        urgent: true,
        arrive: (banker) => {
          const keep = Trade.keepIds(banker, core, { isFood });
          const stored = deposit(banker, Trade.goodsToSell(banker, core, keep, { isFood, worthless: true }));
          if (stored.length > 0) note(banker, `Maakt zijn volle tas leeg op de bank: ${stored.slice(0, 5).map((good) => itemName(good.itemId).toLowerCase()).join(", ")}${stored.length > 5 ? ` en ${stored.length - 5} meer` : ""}.`, "activity");
        },
      })) return;
      entry.phase = "waiting";
      entry.until = nowMs + 60_000;
      return;
    }
    entry.group = false;
    if (entry.savedTask && resumeTask(entry, nowMs)) {
      entry.idleReason = null;
      return;
    }
    if (random() < (data.groupChance ?? 0.3) && startGroup(entry, nowMs)) return;
    const view = snapshot(entry.player);
    // What the others are doing now, so they spread over the skills instead of all mining.
    const busyModes = new Set([...adventurers.values()]
      .filter((other) => other !== entry && other.phase === "training")
      .map((other) => other.plan?.mode).filter(Boolean));
    // When a pick cannot start (no tool to buy near, no place), the next pick goes at once:
    // an adventurer does not stand about waiting.
    const exclude = new Set();
    // Fled hurt and hungry lately: no fights or thieving until it carries food again.
    if (nowMs < (entry.dangerUntil ?? 0) && !carriesFood(entry.player)) for (const mode of DANGER_MODES) exclude.add(mode);
    view.earn = entry.earn ?? {};
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const plan = chooseNext(view, questList(), {
        available: view.available, questChance: data.questChance, moneyChance: data.moneyChance ?? 0.1, bosses: (data.bosses ?? []).filter((boss) => boss.onFoot !== false), bossChance: attempt === 0 ? data.bossChance : 0, random,
        focus: data.focus?.[entry.name] ?? {}, busyModes, exclude, goal: goalOf(entry),
      });
      const started = plan.kind === "quest" ? startQuest(entry, plan)
        : plan.kind === "boss" ? startBoss(entry, plan, nowMs)
        : startTraining(entry, plan, nowMs);
      if (started) {
        entry.idleReason = null;
        return;
      }
      if (plan.mode) exclude.add(plan.mode);
    }
    entry.idleReason = `kon ${[...exclude].map((mode) => mode.replace(/_/g, " ")).join(", ") || "niets"} niet starten`;
    world.log?.("adventurer_idle", { name: entry.name, tried: [...exclude] });
    entry.until = nowMs + 15_000;
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

  /**
   * Standing about: training, but no XP and not a step for two minutes (its job found nothing
   * to do there). Then it picks something else instead of waiting out the stretch.
   */
  function stuck(entry, nowMs) {
    if (entry.phase !== "training" && entry.phase !== "boss") return false;
    if (errands.busy(entry.player)) return false;
    const at = entry.player.getLocation();
    const mark = `${at.getX()},${at.getY()},${at.getZ()}:${Math.floor(entry.player.getSkillManager().getTotalExp?.() ?? 0)}`;
    if (mark !== entry.lastMark) {
      entry.lastMark = mark;
      entry.lastMarkAt = nowMs;
      return false;
    }
    return nowMs - (entry.lastMarkAt ?? nowMs) > STUCK_MS;
  }

  /**
   * Where its gear may come from: bought in a shop, collected at the Grand Exchange, picked up
   * from the ground, made with a skill, or its Tutorial Island kit. Any other wearable item that
   * turns up is a bug in some bot code: it is named in its journal and the server log
   * ("adventurer_unexplained_item"), so it can be found and fixed.
   */
  const acquired = new Map();
  function acquire(player, itemId) {
    const name = player?.getUsername?.();
    if (!name || !adventurers.has(name) || !(itemId > 0)) return;
    if (!acquired.has(name)) acquired.set(name, new Set());
    const definition = core.ItemDefinition?.forId?.(itemId);
    acquired.get(name).add(itemId);
    const unnoted = definition?.unNote?.();
    if (Number.isInteger(unnoted)) acquired.get(name).add(unnoted);
  }

  function wearables(player) {
    const counts = new Map();
    for (const container of [player.getInventory(), player.getEquipment()]) {
      for (const item of container.getItems() ?? []) {
        const id = item?.getId?.() ?? -1;
        if (!(id > 0)) continue;
        const slot = core.ItemDefinition?.forId?.(id)?.getEquipmentType?.()?.getSlot?.();
        if (!Number.isInteger(slot) || slot < 0) continue;
        counts.set(id, (counts.get(id) ?? 0) + item.getAmount());
      }
    }
    return counts;
  }

  function audit(entry) {
    const now = wearables(entry.player);
    const before = entry.wearables;
    entry.wearables = now;
    if (!before) return;
    // In a quest what it gets is the quest's (a reward, dyed goblin mail): not unexplained.
    if (entry.phase === "quest") return;
    const known = acquired.get(entry.name) ?? new Set();
    // The same piece with a charge less (games necklace(7) -> (6)) is not a new one.
    const base = (id) => String(itemName(id)).toLowerCase().replace(/\s*\(\d+\)$/, "");
    const hadBase = new Set([...before.keys()].map(base));
    for (const [id, amount] of now) {
      if (amount <= (before.get(id) ?? 0) || known.has(id) || hadBase.has(base(id))) continue;
      note(entry.player, `Onverklaard: ${itemName(id)} kwam erbij zonder koop, vondst of eigen werk. Dit is een fout in de botcode.`, "activity");
      world.log?.("adventurer_unexplained_item", { username: entry.name, itemId: id, name: itemName(id), activity: entry.activity ?? null });
    }
    acquired.set(entry.name, new Set());
  }

  /** Every change in what it wears goes in its journal, so where each piece came from can be followed. */
  function watchGear(entry) {
    audit(entry);
    const worn = (entry.player.getEquipment().getItems() ?? []).filter((item) => item && item.getId() > 0).map((item) => item.getId());
    const before = entry.worn ?? worn;
    entry.worn = worn;
    const on = worn.filter((id) => !before.includes(id));
    const off = before.filter((id) => !worn.includes(id));
    if (on.length === 0 && off.length === 0) return;
    const names = (ids) => ids.map(itemName).join(", ");
    note(entry.player, `Uitrusting: ${on.length ? `aan ${names(on)}` : ""}${on.length && off.length ? "; " : ""}${off.length ? `uit ${names(off)}` : ""}.`, "activity");
  }

  /** Still on its way to its job's place (the brain walks there by itself too): not yet there. */
  function awayFromJob(entry) {
    const home = stateOf(entry.player)?.home;
    if (!home || entry.activity === "slayer_task") return false;
    const at = entry.player.getLocation();
    if (at.getZ() !== (home.z ?? 0)) return true;
    return Math.max(Math.abs(at.getX() - home.x), Math.abs(at.getY() - home.y)) > ARRIVED_TILES;
  }

  function tick() {
    const started = process.hrtime.bigint();
    try {
      tickAll();
    } finally {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      tickCost.count += 1;
      tickCost.totalMs += ms;
      tickCost.maxMs = Math.max(tickCost.maxMs, ms);
    }
    const nowMs = now();
    if (nowMs - metricsAt >= METRICS_EVERY_MS) {
      if (metricsAt > 0) writeMetrics(nowMs);
      metricsAt = nowMs;
    }
  }

  function tickAll() {
    const nowMs = now();
    for (const entry of adventurers.values()) {
      if (!entry.player?.isRegistered?.()) continue;
      if (Number.isFinite(entry.lastTickAt)) account(entry, nowMs, Math.min(10_000, Math.max(0, nowMs - entry.lastTickAt)));
      // An errand's teleport being cast (the home teleport takes 16 s): no gear changes or other
      // clicks meanwhile, they broke it off and it walked instead.
      {
        const errand = errands.errands?.get?.(entry.player);
        if (errand?.teleport && nowMs < (errand.walkFrom ?? 0)) {
          entry.lastTickAt = nowMs;
          continue;
        }
      }
      // Casting the home teleport: nothing else until it has landed.
      if (entry.homeUntil) {
        if (nowMs < entry.homeUntil) {
          entry.lastTickAt = nowMs;
          continue;
        }
        entry.homeUntil = null;
        const brain = runtimeEntry(entry.player)?.brain;
        if (brain) brain.paused = false;
        entry.until = 0;
      }
      // Gone down or up the stairs on its way: on to the place itself once it has landed.
      if (entry.afterHop) {
        const hop = entry.afterHop;
        const landed = (entry.player.getLocation().getY() >= UNDERGROUND_Y) === hop.down;
        if (landed) {
          entry.afterHop = null;
          if (walkTo(entry, hop.to, { ...hop.options, hopped: true })) {
            entry.lastTickAt = nowMs;
            continue;
          }
        } else if (nowMs < hop.until) {
          entry.lastTickAt = nowMs;
          continue;
        } else {
          entry.afterHop = null;
          note(entry.player, `Kwam niet ${hop.down ? "naar beneden" : "naar boven"} op weg naar ${placeName(hop.to)}.`, "activity");
          entry.until = 0;
        }
      }
      watchGear(entry);
      joinClan(entry);
      // On its way to the job (a long walk to the Gnome Stronghold): the walk does not count
      // against the stretch, which starts when it gets there.
      if ((entry.phase === "training" || entry.phase === "boss") && Number.isFinite(entry.until)
          && (errands.busy(entry.player) || awayFromJob(entry)) && Number.isFinite(entry.lastTickAt)
          && (entry.walkedMs ?? 0) < MAX_WALK_CREDIT_MS) {
        const walked = Math.max(0, nowMs - entry.lastTickAt);
        entry.until += walked;
        entry.walkedMs = (entry.walkedMs ?? 0) + walked;
      }
      entry.lastTickAt = nowMs;
      // Auto-retaliate follows the job (a fight: on; anything else: off), checked every tick.
      {
        const fighting = entry.phase === "boss" || (entry.phase === "training" && DANGER_MODES.has(entry.plan?.mode) && entry.plan?.mode !== "thieving");
        if (fighting !== (entry.retaliating ?? true)) {
          entry.retaliating = fighting;
          entry.player.setAutoRetaliate?.(fighting);
        }
      }
      leaveUnreachableFight(entry, nowMs);
      // Who hits it, kept for the death log (at the death itself the attacker is already gone).
      {
        const foe = entry.player.getCombat?.()?.getAttacker?.() ?? null;
        if (foe && foe.isNpc?.()) {
          entry.lastFoe = { name: String(foe.getDefinition?.()?.getName?.() ?? "?"), level: foe.getDefinition?.()?.getCombatLevel?.() ?? null, at: nowMs };
        } else if (foe && foe.isPlayer?.()) entry.lastFoe = { name: `speler ${foe.getUsername?.()}`, level: null, at: nowMs };
      }
      protectionPrayer(entry, nowMs);
      // Standing at the Al Kharid toll gate with a walk to its other side: through it now, not
      // after the walk has given up (a long trip waits minutes before it calls itself stuck).
      {
        const here = entry.player.getLocation();
        const errand = errands.errands?.get?.(entry.player);
        const target = errand?.to ?? null;
        const atGate = here.getZ() === 0 && Math.abs(here.getX() - TOLL_GATE.x) <= 1 && here.getY() >= 3226 && here.getY() <= 3229;
        const spot = `${here.getX()},${here.getY()}`;
        if (atGate && target) {
          if (entry.gateSpot !== spot) { entry.gateSpot = spot; entry.gateSince = nowMs; }
          else if (nowMs - entry.gateSince > 8_000) {
            crossTollGate(entry, entry.player, target);
            entry.gateSince = nowMs;
          }
        } else entry.gateSpot = null;
      }
      eatWhenHurt(entry);
      if (!entry.player.getCombat?.()?.getTarget?.()) buryLowBones(entry.player);
      // Out of breath it walks; rested (40%) it runs again, as a player clicks run back on.
      if (entry.player.isRunningReturn?.() === false && (entry.player.getRunEnergy?.() ?? 0) >= 40) entry.player.setRunning?.(true);
      // Down from the roof: the course was only the way down.
      if (entry.phase === "training" && entry.plan?.reason === "van het dak af" && entry.player.getLocation().getZ() === 0) {
        entry.jobEnd ??= "off the roof";
        entry.until = 0;
      }
      if (entry.phase === "training" && entry.buying && entry.player.getInventory().getAmount(entry.buying) <= 0
          && !errands.busy(entry.player)) {
        // Out of this load with more in its bank and time left: the next load, the same job, as a
        // player banks and goes on (it switched job after every single load, a minute each).
        if (banked(entry.player, entry.buying) > 0 && entry.until - nowMs > 60_000 && entry.plan?.kind === "train") {
          entry.savedTask = { kind: "train", mode: entry.plan.mode, skill: entry.plan.skill, reason: entry.plan.reason,
            target: entry.plan.target ?? null, remainingMs: entry.until - nowMs, savedAt: now(), afterTrip: true };
          entry.jobEnd = "next load";
        }
        entry.buying = null;
        entry.until = 0;
      }
      if (entry.phase === "quest" && entry.questRun) {
        // A quest step is tried every six seconds (its tries count on that pace): a walk or a
        // dialogue gets time to happen before the step counts as not advancing.
        if (nowMs < (entry.questTickAt ?? 0)) continue;
        entry.questTickAt = nowMs + QUEST_TICK_MS;
        questTick(entry, nowMs);
        rememberTask(entry, nowMs);
        continue;
      }
      if (stuck(entry, nowMs)) {
        note(entry.player, `Kon bij ${String(entry.activity ?? "zijn klus").replace(/_/g, " ")} niets doen; kiest iets anders.`, "activity");
        countEvent(entry, "stuck");
        entry.jobEnd = "stuck";
        unstrand(entry, entry.player);
        const stuckAt = entry.player.getLocation();
        metric({ kind: "stuck", bot: entry.name, mode: entry.plan?.mode ?? null, reason: entry.plan?.reason ?? null,
          combat: entry.player.getSkillManager().getCombatLevel(), where: [stuckAt.getX(), stuckAt.getY(), stuckAt.getZ()],
          home: stateOf(entry.player)?.home ?? null, ...brainSnapshot(entry) });
        entry.until = 0;
      }
      // Trained to what the job was for (a quest's combat level, a goal's level) and a little
      // past it (0-3 levels, not the same every time): the stretch ends, something else next.
      const target = entry.phase === "training" ? entry.plan?.target : null;
      if (target) {
        entry.overshoot ??= Math.floor(random() * 4);
        const level = target.skill === "COMBAT" ? entry.player.getSkillManager().getCombatLevel() : levelOf(entry.player, target.skill);
        if (level >= target.level + entry.overshoot) {
          note(entry.player, `Heeft ${target.skill === "COMBAT" ? "combat" : target.skill.toLowerCase()} ${level} gehaald; doet nu iets anders.`, "skill");
          entry.plan = { ...entry.plan, target: null };
          entry.overshoot = null;
          entry.until = 0;
          // The job it would go back to after a trip was for this same level: not again.
          entry.savedTask = null;
          countEvent(entry, "targetReached");
          entry.jobEnd = "target reached";
        }
      }
      if (entry.needFood && carriesFood(entry.player)) entry.needFood = false;
      // Gathered what its quest needed (entry.gatherFor): back to that quest.
      if (entry.gather && entry.phase === "training") {
        const have = entry.player.getInventory().getAmount(entry.gather.itemId) + banked(entry.player, entry.gather.itemId);
        if (have >= entry.gather.amount || nowMs >= entry.until) {
          const quest = entry.gather.quest;
          entry.gather = null;
          note(entry.player, `Heeft genoeg verzameld; terug naar ${quest}.`, "quest");
          forceQuest(entry.name, quest);
        }
      }
      // Down from the roof: the course was only the way down; its next job now.
      if (entry.offRoof && entry.player.getLocation().getZ() === 0) {
        entry.offRoof = false;
        entry.until = 0;
      }
      // Out of food in the middle of a fight stretch: it stops and restocks (bank, shop), as a
      // player does, rather than fighting on with nothing to eat.
      // Hurt with nothing to eat in a job that hurts (a fight, a stall's guards, a pocket's
      // owner): it stops at once and keeps off such jobs for ten minutes, unless it gets food.
      const hp = entry.player.getHitpoints?.() ?? 10;
      const maxHp = Math.max(1, levelOf(entry.player, "HITPOINTS"));
      if ((entry.phase === "training" || entry.phase === "boss") && (DANGER_MODES.has(entry.plan?.mode) || entry.phase === "boss")
          && hp < maxHp * DANGER_HP_SHARE && !carriesFood(entry.player) && !errands.busy(entry.player)) {
        note(entry.player, `Nog maar ${hp}/${maxHp} HP en geen eten: stopt met ${String(entry.activity ?? "deze klus").replace(/_/g, " ")} voor het te laat is.`, "activity");
        countEvent(entry, "fledLowHp");
        entry.jobEnd = "low hp, no food";
        entry.dangerUntil = nowMs + 10 * 60_000;
        entry.savedTask = null;
        entry.until = 0;
      } else if ((entry.phase === "training" && ["combat_training", "slayer", "combat_ranged", "combat_magic"].includes(entry.plan?.mode))
          && !carriesFood(entry.player) && nowMs >= (entry.stockFoodAt ?? 0) && !errands.busy(entry.player)) {
        note(entry.player, "Heeft geen eten meer; haalt eerst nieuw eten.", "activity");
        entry.jobEnd = "out of food";
        entry.savedTask = { kind: "train", mode: entry.plan.mode, skill: entry.plan.skill, reason: entry.plan.reason, target: entry.plan.target ?? null, planActivity: entry.plan.activity ?? null, remainingMs: 0, savedAt: now() };
        entry.until = 0;
      }
      // A finished Slayer task ends the stretch: back to a master, or something else.
      if (entry.phase === "training" && entry.activity === "slayer_task" && !Slayer.currentTask(emit, entry.player)) {
        note(entry.player, "Slayer-taak klaar.", "skill");
        entry.until = 0;
      }
      // A full bag ends the stretch: off to sell (trade()), as a player banks or sells.
      // A full bag ends a gathering stretch; a processing one (fletching, burning: buy_) starts
      // with a bag full of its materials, and runs out of them instead.
      const gathering = !String(entry.plan?.mode ?? "").startsWith("buy_") && !String(entry.activity ?? "").startsWith("process_") && !entry.buying;
      if (nowMs >= entry.until || (entry.phase === "training" && gathering && entry.player.getInventory().getFreeSlots() === 0)) {
        entry.jobEnd ??= nowMs >= entry.until ? "time up" : "full bag";
        next(entry, nowMs);
      }
      rememberTask(entry, nowMs);
    }
  }

  /** Every tick: an adventurer on a quest answers its open dialogue (about every other tick). */
  function talkTick() {
    for (const entry of adventurers.values()) {
      if (!entry.questRun || !entry.player?.isRegistered?.() || random() < 0.4) continue;
      try {
        questPlay.talkTick(entry);
      } catch (error) {
        world.log?.("adventurer_quest_talk_failed", { name: entry.name, error: String(error?.message ?? error) });
      }
    }
  }

  /**
   * A test start for the extra members (adventurers.json "testProfiles", one per extra member, the
   * same in every clan): other levels, the first quests of the path done and coins to buy gear
   * with, so a test run also shows how mid- and high-level accounts play, not only new ones.
   */
  function testProfileOf(name) {
    const clan = Clans.clanOf(data, name);
    const profiles = data.testProfiles ?? [];
    if (!clan || profiles.length === 0) return null;
    const extra = Math.max(0, Math.floor(Number(data.extraPerClan) || 0));
    const index = clan.members.indexOf(name) - (clan.members.length - extra);
    // Each profile `count` times in a row (one elite per clan, three new fighters ...).
    const slots = profiles.flatMap((profile) => Array.from({ length: Math.max(1, Math.floor(Number(profile.count) || 1)) }, () => profile));
    return index >= 0 ? slots[index % slots.length] : null;
  }

  const settingProfile = new WeakSet();

  function applyTestProfile(player, profile) {
    settingProfile.add(player);
    try {
      applyTestProfileLevels(player, profile);
    } finally {
      // Level-up events of the profile may come a tick later: ignored for a few seconds.
      setTimeout(() => settingProfile.delete(player), 5_000);
    }
  }

  function applyTestProfileLevels(player, profile) {
    const { SkillManager } = core;
    const skills = player.getSkillManager();
    // The same "random" levels in every clan: from the profile's name, not from the bot's.
    let seed = [...String(profile.name)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
    const roll = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (const skill of core.Skill.values()) {
      const name = skill.getName().toUpperCase();
      let level = profile.levels?.[name] ?? profile.all ?? null;
      if (level === null && Array.isArray(profile.random)) level = profile.random[0] + Math.floor(roll() * (profile.random[1] - profile.random[0] + 1));
      if (skill === core.Skill.HITPOINTS) level = Math.max(10, level ?? 10);
      if (!level || level <= 1) continue;
      skills.setCurrentLevel(skill, level, false).setMaxLevels(skill, level, false).setExperience(skill, SkillManager.getExperienceForLevel(level));
    }
    // (Before its quests: their rewards would fill the bag first.)
    // Gear to match its levels, as an account at those levels would own: per slot the best piece
    // its levels and quests allow (a weapon, armour, an axe and a pickaxe), then worn.
    const helpers = { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) };
    const given = [];
    // Twice: now, and after its quests for what they open (a dragon scimitar after Monkey Madness).
    const giveGear = () => {
    for (const [slot, list] of [...Object.entries(Trade.listsFor("melee", player, core)), ["axe", Shopping.gear.tools?.axe ?? []], ["pickaxe", Shopping.gear.tools?.pickaxe ?? []]]) {
      // The best allowed piece the game knows (a list entry without an item id is passed over).
      // No shield beside a two-handed weapon (a scythe): it would take the weapon off again.
      if (slot === "shield" && Trade.twoHanded(player, core)) continue;
      // Within what an account with its coins would own: a 10k fighter has no amulet of fury.
      const budget = Math.max(5_000, Number(profile.coins) || 0);
      const best = list.find((entry) => !entry.earned && Shopping.allowed(entry, helpers) && Number.isInteger(Shopping.idOf(core, entry.item))
        && Value.itemValue(core, Shopping.idOf(core, entry.item), 1) <= budget);
      const id = best ? Shopping.idOf(core, best.item) : null;
      if (!Number.isInteger(id) || player.getInventory().getFreeSlots() < 1 || Shopping.owns(player, id)) continue;
      acquire(player, id);
      addCharged(player, id, 1);
      // Worn at once: the quests' rewards after this fill the bag (a late-game account got none).
      Shopping.wear(player, core, id);
      given.push(best.item);
    }
    Trade.wearBest(player, core, helpers, "melee");
    player.getInventory().refreshItems?.();
    player.getEquipment().refreshItems?.();
    };
    giveGear();
    // What an account at its level has earned and keeps (a fire or infernal cape, a max cape,
    // Ava's device): `wear` is put on, `bank` goes in its bank.
    for (const name of profile.wear ?? []) {
      const id = Shopping.idOf(core, name);
      if (!Number.isInteger(id)) continue;
      acquire(player, id);
      addCharged(player, id, 1);
      if (Shopping.wear(player, core, id)) given.push(name);
    }
    const kept = [];
    for (const name of profile.bank ?? []) {
      const id = Shopping.idOf(core, name);
      if (!Number.isInteger(id)) continue;
      acquire(player, id);
      addCharged(player, id, 1);
      kept.push({ itemId: id, amount: 1 });
    }
    deposit(player, kept);
    if (kept.length > 0) given.push(`${kept.map((good) => itemName(good.itemId).toLowerCase()).join(", ")} op de bank`);
    // Runes for teleports in its bag (Varrock 25, Lumbridge 31, Falador 37, Camelot 45, Ardougne
    // 51), as a player with the levels and the coins travels: a max-level account walked everywhere.
    if (levelOf(player, "MAGIC") >= 25 && (Number(profile.coins) || 0) >= 100_000) {
      for (const [name, amount] of [["LAW_RUNE", 200], ["AIR_RUNE", 1000], ["FIRE_RUNE", 200], ["EARTH_RUNE", 200], ["WATER_RUNE", 200]]) {
        const id = Shopping.idOf(core, name);
        if (!Number.isInteger(id)) continue;
        acquire(player, id);
        player.getInventory().add(new core.Item(id, amount));
      }
      given.push("teleport-runes");
    }
    // Its Ranged and Magic sets too, in the bank (it wears the melee set): the best its levels and
    // coins allow, with arrows or runes, so it can switch styles as an account at its levels can.
    for (const [style, skill] of [["ranged", "RANGED"], ["magic", "MAGIC"]]) {
      if (levelOf(player, skill) < 20) continue;
      const budget = Math.max(5_000, Number(profile.coins) || 0);
      const banked = [];
      for (const [slot, list] of Object.entries(Shopping.gear.styles?.[style] ?? {})) {
        const best = list.find((entry) => !entry.earned && Shopping.allowed(entry, helpers) && Number.isInteger(Shopping.idOf(core, entry.item))
          && Value.itemValue(core, Shopping.idOf(core, entry.item), 1) * (slot === "ammo" ? 1000 : 1) <= budget);
        const id = best ? Shopping.idOf(core, best.item) : null;
        if (!Number.isInteger(id) || player.getInventory().getFreeSlots() < 1) continue;
        acquire(player, id);
        addCharged(player, id, slot === "ammo" ? 1000 : 1);
        banked.push({ itemId: id, amount: slot === "ammo" ? 1000 : 1 });
      }
      if (style === "magic") {
        const level = levelOf(player, skill);
        const runes = [["AIR_RUNE", 2000], ["MIND_RUNE", 500], ["FIRE_RUNE", 1000], ...(level >= 35 ? [["CHAOS_RUNE", 500]] : []),
          ...(level >= 60 ? [["DEATH_RUNE", 500]] : []), ...(level >= 80 ? [["BLOOD_RUNE", 500]] : [])];
        for (const [name, amount] of runes) {
          const id = Shopping.idOf(core, name);
          if (!Number.isInteger(id) || Value.itemValue(core, id, amount) > budget / 4) continue;
          acquire(player, id);
          player.getInventory().add(new core.Item(id, amount));
          banked.push({ itemId: id, amount });
        }
      }
      deposit(player, banked);
      if (banked.length > 0) given.push(`${style}-set op de bank`);
    }
    const registered = questsByName();
    let done = 0;
    for (const quest of data.quests ?? []) {
      if (done >= (profile.quests ?? 0)) break;
      const own = registered.get(normalize(quest.name));
      try {
        if (own && own.complete(player) !== false) done += 1;
      } catch {
        // A quest that cannot be completed this way is left open.
      }
    }
    giveGear();
    if (profile.coins) {
      acquire(player, Trade.COINS);
      player.getInventory().add(new core.Item(Trade.COINS, profile.coins));
    }
    player.setAttribute(TEST_PROFILE_ATTRIBUTE, profile.name);
    note(player, `Testaccount (${profile.name}): begint met andere levels, ${done} quests, ${profile.coins ?? 0} coins en ${given.length > 0 ? given.map((item) => item.toLowerCase().replace(/_/g, " ")).join(", ") : "geen extra gear"}.`);
  }

  /** Back to a new account: level 1 (10 Hitpoints), no items, no quests, an empty journal. */
  function startOver(player) {
    const { SkillManager } = core;
    const skills = player.getSkillManager();
    for (const skill of core.Skill.values()) {
      const level = skill === core.Skill.HITPOINTS ? 10 : 1;
      skills.setCurrentLevel(skill, level, false).setMaxLevels(skill, level, false)
        .setExperience(skill, SkillManager.getExperienceForLevel(level));
    }
    player.getInventory().resetItems();
    player.getEquipment().resetItems();
    for (const bank of player.getBanks?.() ?? []) bank?.resetItems?.();
    // Nothing of the old start carries over: not its Grand Exchange offers (coins or items from
    // earlier sales waiting to be collected bought a reset adventurer an iron scimitar).
    emit("ge:reset", { player });
    for (const quest of QuestRuntime.getRegisteredQuests()) {
      if (quest.getStage(player) !== 0) quest.setStage(player, 0);
    }
    // Every other saved thing back to a new account's (Slayer task, diary tasks, minigame states,
    // cooldowns ...): nothing of the old save carries over. Its honesty mark goes back on.
    api.resetPersistentAttributes?.(player);
    markHonest(player);
    player.setAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE, 0);
    player.setAttribute(LOG_ATTRIBUTE, []);
    player.setAttribute(GOAL_ATTRIBUTE, null);
    player.setAttribute(TASK_ATTRIBUTE, null);
    // What every new account gets on Tutorial Island.
    for (const [name, amount] of Shopping.gear.starterKit) {
      const id = Shopping.idOf(core, name);
      if (Number.isInteger(id)) {
        acquire(player, id);
        player.getInventory().add(new core.Item(id, amount));
      }
    }
    player.getInventory().refreshItems?.();
    player.getEquipment().refreshItems?.();
    player.setAttribute(GENERATION_ATTRIBUTE, data.generation ?? 1);
    const profile = testProfileOf(player.getUsername?.());
    if (profile) applyTestProfile(player, profile);
    // A new account starts in Lumbridge, wherever the old one was.
    const start = data.spawn;
    player.moveTo?.(new core.Location(start.x, start.y, start.z ?? 0));
    // Its brain's home too (set from the saved spot at login): else it walked back to where the
    // old account had been.
    const brainState = runtimeEntry(player)?.state ?? runtime.botStatesByName?.get?.(player.getUsername?.());
    if (brainState) brainState.home = { x: start.x, y: start.y, z: start.z ?? 0 };
    note(player, "Een nieuw avontuur begint in Lumbridge, met alleen de spullen van Tutorial Island.");
  }

  function carriesFood(player) {
    const Food = require("../../items/Food.plugin");
    return (player.getInventory().getItems() ?? []).some((item) => item && Food.isFoodItem(item.getId()));
  }

  /**
   * Into the bag ready to use: a weapon with charges (a scythe of vitur, a trident, a blowpipe)
   * comes charged, as a player who owns one keeps it. Given with none, the scythe turned into the
   * uncharged one at its first hit, and the bot wore a rune scimitar and a square shield instead.
   */
  function addCharged(player, id, amount) {
    const inventory = player.getInventory();
    inventory.add(new core.Item(id, amount));
    for (const item of inventory.getItems?.() ?? []) {
      if (item?.getId?.() !== id) continue;
      emit("item:fill-charges", { player, item, handled: false });
    }
  }

  function levelOf(player, skillName) {
    const skill = core.Skill[skillName];
    return skill ? player.getSkillManager().getMaxLevel(skill) : 1;
  }

  function questDone(player) {
    const quests = questsByName();
    return (name) => quests.get(normalize(name))?.isComplete(player) === true;
  }

  /**
   * Walks to the nearest shop that sells it and buys there, through the shop itself. True when
   * it set off. Only shops within data.shopRadius tiles: a longer walk is not worth one item.
   */
  /** To the Grand Exchange for one thing it needs (a tool no shop near sells), then the job again. */
  function buyOnExchange(entry, itemId, name, amount = 1, { replan = true } = {}) {
    const { player } = entry;
    const guide = Number(core.ItemDefinition?.forId?.(itemId)?.getGrandExchangeValue?.() ?? 0);
    // Its coins in the bag and in its bank: the exchange has a bank, it takes out what it needs.
    const cost = Math.ceil(guide * 1.05) * amount;
    if (!(guide > 0) || Shopping.coinsOf(player) + banked(player, Trade.COINS) < cost + 50) return false;
    if (blockedPlace(entry, data.grandExchange)) return false;
    const plan = entry.plan;
    const label = String(name).toLowerCase().replace(/_/g, " ");
    return walkTo(entry, { ...data.grandExchange, name: "de Grand Exchange" }, {
      reason: "buy_materials",
      arrive: (buyer) => {
        emit("ge:collect", { player: buyer });
        const short = cost + 50 - Shopping.coinsOf(buyer);
        if (short > 0) withdraw(buyer, Trade.COINS, short);
        if (!bid(buyer, core, emit, itemId, amount)) return;
        emit("ge:collect", { player: buyer });
        acquire(buyer, itemId);
        note(buyer, `Koopt ${amount > 1 ? `${amount} x ` : ""}${label} op de GE (~${Math.ceil(guide * 1.05 * amount).toLocaleString("nl-NL")} gp).`, "activity");
        if (plan?.mode) entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
      },
    });
  }

  function shopFor(entry, itemId, name, amount = 1, { replan = true } = {}) {
    const { player } = entry;
    const at = player.getLocation();
    const shop = Shopping.nearestShop(itemId, { x: at.getX(), y: at.getY() });
    // No shop for it near: the Grand Exchange has it, as players buy a bird snare or a harpoon.
    const empty = shop && (entry.emptyShops?.get(`${shop.shopId}:${itemId}`) ?? 0) > now();
    if (!shop || empty || shop.distance > (data.shopRadius ?? 80)) return buyOnExchange(entry, itemId, name, amount, { replan });
    const label = name.toLowerCase().replace(/_/g, " ");
    return walkTo(entry, { x: shop.keeper.x, y: shop.keeper.y, z: shop.keeper.z, name: shop.name }, {
      reason: replan ? "shop" : "quest", replan,
      arrive: (buyer) => {
        const coinsBefore = Shopping.coinsOf(buyer);
        const got = Shopping.buy(buyer, core, shop.shopId, itemId, amount);
        if (got <= 0) {
          note(buyer, `${shop.name} had geen ${label} voor hem; probeert de Grand Exchange.`, "activity");
          // Out of stock: the exchange instead, as a player does (not the same shop again).
          (entry.emptyShops ??= new Map()).set(`${shop.shopId}:${itemId}`, now() + 30 * 60_000);
          if (!buyOnExchange(entry, itemId, name, amount, { replan })) entry.noErrandUntil = now() + 10 * 60_000;
          return;
        }
        acquire(buyer, itemId);
        const paid = coinsBefore - Shopping.coinsOf(buyer);
        note(buyer, `Gekocht: ${got > 1 ? `${got} x ` : ""}${label} bij ${shop.name} (${paid.toLocaleString("nl-NL")} gp).`, "activity");
        Shopping.wear(buyer, core, itemId);
      },
    });
  }

  /**
   * Small bones (bones, bat and wolf bones) are buried where it stands, as a player does on the
   * way: a little Prayer and a free slot. Big bones and better stay for Prayer training or a
   * house party's altar (bankKeep).
   */
  function buryLowBones(player) {
    if (!api.emitItemAction) return;
    const low = new Set(["BONES", "BAT_BONES", "WOLF_BONES", "BURNT_BONES"].map((name) => core.ItemIdentifiers[name]).filter(Number.isInteger));
    const items = player.getInventory().getItems() ?? [];
    const slot = items.findIndex((item) => item && low.has(item.getId()));
    if (slot < 0) return;
    const item = items[slot];
    api.emitItemAction({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot, clickType: 1, option: "Bury", handled: false });
  }

  /** Food in its bag: [{ slot, itemId }]. */
  function foodSlots(player) {
    return (player.getInventory().getItems() ?? []).map((item, slot) => ({ slot, itemId: item?.getId?.() ?? -1 }))
      .filter(({ itemId }) => itemId > 0 && isFood(itemId));
  }

  /**
   * Hurt on its way or at its job (a man in Lumbridge, a guard in Ardougne): it eats what it
   * carries, by the item's own Eat option as a player clicks it. Below half its hitpoints.
   */
  function eatWhenHurt(entry) {
    const player = entry.player;
    const max = player.getSkillManager().getMaxLevel(core.Skill.HITPOINTS);
    if (player.getHitpoints() * 2 >= max) return;
    const food = foodSlots(player)[0];
    if (!food || !api.emitItemAction) return;
    const actions = core.CacheDefinitions?.getItem?.(food.itemId)?.inventoryActions ?? [];
    const index = actions.findIndex((option) => option === "Eat" || option === "Drink");
    if (index < 0) return;
    const item = player.getInventory().getItems()[food.slot];
    api.emitItemAction({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: food.itemId, slot: food.slot,
      clickType: index + 1, option: actions[index], handled: false });
  }

  /**
   * A low-level adventurer without food takes some along before its next job (the walk to
   * Ardougne goes past things that hit back): from its bank, or bought. Once in a while, not
   * before every job; true when it went for it.
   */
  /**
   * Food along before a fight (combat, a Slayer task, a quest with fights): what it has in its
   * bank first, else bought (a shop, or the GE). True when it set off for it.
   */
  function stockFood(entry, plan, nowMs) {
    const player = entry.player;
    if (carriesFood(player) || nowMs < (entry.stockFoodAt ?? 0)) return false;
    entry.stockFoodAt = nowMs + 10 * 60_000;
    const amount = Shopping.gear.foodAmount ?? 14;
    const resume = () => {
      if (plan?.kind === "train") entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
    };
    const inBank = (Shopping.gear.food ?? []).map((food) => Shopping.idOf(core, food.item))
      .find((id) => Number.isInteger(id) && banked(player, id) >= 5);
    const bank = inBank !== undefined ? nearestBank(player, entry) : null;
    if (bank) {
      return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
        reason: "withdraw",
        arrive: (banker) => {
          const got = withdraw(banker, inBank, amount);
          if (got > 0) note(banker, `Neemt ${got} x ${itemName(inBank)} van de bank mee om te eten.`, "activity");
          resume();
        },
      });
    }
    const food = Shopping.foodToBuy(player, core, levelOf(player, "HITPOINTS"));
    if (food && Shopping.coinsOf(player) >= Shopping.estimatedPrice(core, food.itemId, food.amount) + 50
        && shopFor(entry, food.itemId, food.name, food.amount)) {
      resume();
      entry.needFood = false;
      return true;
    }
    // No food to be had now (no coins, no shop near): it catches and cooks its own for a while.
    entry.needFood = true;
    note(player, "Kan nu geen eten krijgen; gaat eerst zelf vissen en koken.", "activity");
    return false;
  }

  function getTravelFood(entry, plan, nowMs) {
    const player = entry.player;
    const hitpoints = player.getSkillManager().getMaxLevel(core.Skill.HITPOINTS);
    if (hitpoints >= TRAVEL_FOOD_UNTIL_HP || foodSlots(player).length > 0 || nowMs < (entry.foodTriedAt ?? 0)) return false;
    entry.foodTriedAt = nowMs + 20 * 60_000;
    const resume = () => { entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() }; };
    const inBank = (Shopping.gear.food ?? []).map((entry) => Shopping.idOf(core, entry.item))
      .find((id) => Number.isInteger(id) && banked(player, id) >= 3);
    const bank = inBank !== undefined ? nearestBank(player, entry) : null;
    if (bank) {
      return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
        reason: "withdraw",
        arrive: (banker) => {
          const got = withdraw(banker, inBank, TRAVEL_FOOD);
          if (got > 0) note(banker, `Neemt ${got} x ${itemName(inBank)} van de bank mee als eten onderweg.`, "activity");
          resume();
        },
      });
    }
    const food = Shopping.foodToBuy(player, core, hitpoints);
    if (!food || Shopping.coinsOf(player) < Shopping.estimatedPrice(core, food.itemId, TRAVEL_FOOD) + 50) return false;
    if (!shopFor(entry, food.itemId, food.name, TRAVEL_FOOD)) return false;
    resume();
    return true;
  }

  function isFood(itemId) {
    return require("../../items/Food.plugin").isFoodItem(itemId);
  }

  /**
   * What it keeps in its bank for later rather than selling: materials it trains with (its
   * buyToTrain logs and bars, data.bankKeep: ores, raw fish, bones). Up to data.bankCap of each;
   * more than that is sold. Junk (worth under data.junkValue each, and of no use) it drops.
   */
  let usefulIds = null;
  function useful() {
    if (usefulIds) return usefulIds;
    usefulIds = new Set();
    for (const recipe of Object.values(data.buyToTrain ?? {})) {
      for (const [, names] of recipe.tiers) {
        for (const name of Array.isArray(names) ? names : [names]) {
          const id = Shopping.idOf(core, name);
          if (Number.isInteger(id)) usefulIds.add(id);
        }
      }
    }
    for (const name of data.bankKeep ?? []) {
      const id = Shopping.idOf(core, name);
      if (Number.isInteger(id)) usefulIds.add(id);
    }
    return usefulIds;
  }

  function baseId(itemId) {
    const unnoted = core.ItemDefinition?.forId?.(itemId)?.unNote?.();
    return Number.isInteger(unnoted) && unnoted > 0 ? unnoted : itemId;
  }

  /**
   * How many of a thing it keeps (in its bank and bag), by need rather than one number:
   * - supplies it uses up (runes, arrows, food, tablets): all of them;
   * - training materials for its levels now or later: up to data.bankCap; a tier it has
   *   outgrown (bronze bars at Smithing 80) is no use any more and is sold;
   * - other keepers (ores, raw fish, bones, feathers): up to data.bankCap.
   */
  function need(player, itemId) {
    const id = baseId(itemId);
    if (isFood(id) || Trade.isSupply(core, id)) return Infinity;
    // Prayer potions: a reserve for its own fights when it prays (Protect from Melee); what it
    // makes beyond that (Herblore training) is for sale.
    if (Trade.isPrayerRestore(core, id)) return levelOf(player, "PRAYER") >= 43 ? (data.potionReserve ?? 20) : 0;
    for (const [skill, recipe] of Object.entries(data.buyToTrain ?? {})) {
      const level = levelOf(player, skill);
      const tiers = recipe.tiers.map(([needed, names]) => ({ needed, ids: (Array.isArray(names) ? names : [names]).map((name) => Shopping.idOf(core, name)) }));
      const index = tiers.findIndex((tier) => tier.ids.includes(id));
      if (index < 0) continue;
      // Tiers run best first: the one above this is outgrown it when its level is well past it.
      const above = tiers[index - 1];
      if (above && level >= above.needed + 10) return 0;
      return data.bankCap ?? 10000;
    }
    return useful().has(id) ? (data.bankCap ?? 10000) : 0;
  }

  /**
   * Materials from clanmates: each gives what it really has in its bank above what it keeps
   * for itself (data.clanReserve, or all of it when it has no use for it). Into this one's
   * bank; both journals say so. Returns how many it got.
   */
  function fromClan(entry, itemId, wanted) {
    // The leader comes first: the others give it more of their own reserve, and they do not take
    // from the leader's stock (it must progress fastest, the clan's race runs through it).
    const leader = isLeader(entry.name);
    const mates = Clans.matesOf(data, entry.name).filter((name) => leader || !isLeader(name))
      .map((name) => adventurers.get(name)).filter((mate) => mate?.player?.isRegistered?.());
    const reserve = (data.clanReserve ?? 500) / (leader ? 4 : 1);
    const given = Clans.gift(mates, itemId, wanted, {
      spare: (mate, id) => banked(mate.player, id) - Math.min(need(mate.player, id), reserve),
      take: (mate, amount) => {
        let left = amount;
        for (const bank of mate.player.getBanks?.() ?? []) {
          const out = Math.min(left, bank?.getAmount?.(itemId) ?? 0);
          if (out <= 0) continue;
          bank.deleteNumber?.(itemId, out) ?? bank.delete?.(new core.Item(itemId, out));
          left -= out;
          if (left <= 0) break;
        }
        return amount - left;
      },
    });
    let total = 0;
    for (const { mate, amount } of given) {
      const tab = core.Bank?.getTabForItem?.(entry.player, itemId) ?? 0;
      entry.player.getBank?.(tab)?.add?.(new core.Item(itemId, amount), false);
      acquire(entry.player, itemId);
      total += amount;
      note(entry.player, `Krijgt ${amount.toLocaleString("nl-NL")} x ${itemName(itemId)} van clangenoot ${mate.name}.`, "activity");
      note(mate.player, `Geeft ${amount.toLocaleString("nl-NL")} x ${itemName(itemId)} aan clangenoot ${entry.name}.`, "activity");
    }
    return total;
  }

  /** In its clan in game (the Clans plugin), its leader founding it. */
  function joinClan(entry) {
    if (entry.clanJoined) return;
    const clan = Clans.clanOf(data, entry.name);
    if (!clan) return;
    const request = { player: entry.player, clan: clan.name, leader: clan.leader === entry.name, joined: false };
    try {
      emit("clans:ensure-member", request);
    } catch (error) {
      world.log?.("adventurer_clan_failed", { name: entry.name, error: String(error?.message ?? error) });
    }
    entry.clanJoined = request.joined === true;
  }

  function banked(player, itemId) {
    return (player.getBanks?.() ?? []).reduce((sum, bank) => sum + (bank?.getAmount?.(itemId) ?? 0), 0);
  }

  /**
   * Its grave after a death (Gravestones plugin): walk there and Loot and Pay as a player does
   * ("gravestones:reclaim" pays the fee from its Coffer, bag or bank). Without the coins the paid
   * items stay; after the grave's time they go to Death's Office, as for a player.
   */
  /** Back from its grave: its own things, not unexplained ones (the audit). */
  function fromGrave(player) {
    for (const container of [player.getInventory(), player.getEquipment()]) {
      for (const item of container.getItems() ?? []) if (item && item.getId() > 0) acquire(player, item.getId());
    }
  }

  function reclaimGrave(entry) {
    const query = { player: entry.player, location: null, taken: false };
    emit("gravestones:reclaim", query);
    if (query.taken) {
      fromGrave(entry.player);
      note(entry.player, "Haalt zijn spullen op bij zijn graf.", "activity");
      return false;
    }
    if (!query.location || (entry.graveTries ?? 0) >= 3) return false;
    entry.graveTries = (entry.graveTries ?? 0) + 1;
    return walkTo(entry, { ...query.location, name: "zijn graf" }, {
      reason: "grave",
      urgent: true,
      arrive: (player) => {
        const back = { player, location: null, taken: false };
        emit("gravestones:reclaim", back);
        if (back.taken) {
          entry.graveTries = 0;
          fromGrave(player);
          note(player, "Haalt zijn spullen op bij zijn graf.", "activity");
        } else if (back.location) {
          note(player, "Kan het graf niet helemaal leeghalen (te weinig geld voor het fee).", "activity");
        }
      },
    });
  }

  /**
   * Fighting something it cannot get to (a prisoner behind bars in Edgeville, a monster across a
   * fence): it stops hitting back and goes on with its job, as a player walks away. Looked at every
   * few seconds with the route finder.
   */
  let fightRouteFinder = null;
  function leaveUnreachableFight(entry, nowMs) {
    const player = entry.player;
    const combat = player.getCombat?.();
    const foe = combat?.getTarget?.() ?? combat?.getAttacker?.();
    if (!foe || foe.isNpc?.() !== true) {
      entry.unreachableSince = 0;
      return;
    }
    // Not out to fight (a quest, an errand, fishing): what attacks it on the way (Draynor Manor's
    // trees, a rat) is walked away from, as a player clicks on, not fought where it stands.
    const fightingJob = entry.phase === "boss" || (entry.phase === "training" && DANGER_MODES.has(entry.plan?.mode) && entry.plan?.mode !== "thieving");
    // Auto-retaliate on only for a fight (as a player turns it off to walk past things).
    if (fightingJob !== (entry.retaliating ?? true)) {
      entry.retaliating = fightingJob;
      player.setAutoRetaliate?.(fightingJob);
    }
    if (!fightingJob && combat.getTarget?.() === foe) {
      combat.reset?.();
      if (nowMs - (entry.walkOnNoteAt ?? 0) > 60_000) {
        entry.walkOnNoteAt = nowMs;
        note(player, `Wordt aangevallen door ${String(foe.getDefinition?.()?.getName?.() ?? "iets").toLowerCase()}; loopt door.`, "activity");
      }
      return;
    }
    if (nowMs < (entry.fightCheckAt ?? 0)) return;
    entry.fightCheckAt = nowMs + 3_000;
    fightRouteFinder ??= new core.RsmodRouteFinding();
    const from = player.getLocation();
    const to = foe.getLocation();
    const size = Math.max(1, Math.floor(foe.getSize?.() ?? 1));
    const reachable = from.getZ() === to.getZ() && fightRouteFinder.findRoute({
      level: from.getZ(), srcX: from.getX(), srcY: from.getY(), srcSize: 1, destX: to.getX(), destY: to.getY(),
      destWidth: size, destLength: size, locAngle: 0, locShape: -2, moveNear: false, blockAccessFlags: 0, maxWaypoints: 25,
      privateArea: player.getPrivateArea?.() ?? null,
    }).success === true;
    if (reachable) {
      entry.unreachableSince = 0;
      return;
    }
    entry.unreachableSince ||= nowMs;
    if (nowMs - entry.unreachableSince < 6_000) return;
    entry.unreachableSince = 0;
    combat.reset?.();
    note(player, `Laat ${String(foe.getDefinition?.()?.getName?.() ?? "een monster").toLowerCase()} achter tralies liggen.`, "activity");
  }

  /** A death: the journal says where, and its next job starts after the respawn. */
  function onDeath({ player }) {
    const entry = adventurers.get(player?.getUsername?.());
    if (!entry) return;
    countEvent(entry, "died");
    const at = player.getLocation();
    metric({ kind: "death", bot: entry.name, phase: entry.phase, mode: entry.plan?.mode ?? null, activity: entry.activity ?? null,
      quest: entry.questRun?.name ?? null, where: [at.getX(), at.getY(), at.getZ()], hadFood: carriesFood(player),
      combat: player.getSkillManager().getCombatLevel(),
      // Who hit it last (within a minute), and why it went wrong, roughly.
      killer: entry.lastFoe && now() - entry.lastFoe.at < 60_000 ? entry.lastFoe.name : null,
      killerLevel: entry.lastFoe && now() - entry.lastFoe.at < 60_000 ? entry.lastFoe.level : null,
      reason: !(entry.lastFoe && now() - entry.lastFoe.at < 60_000) ? "onbekend (geen aanvaller gezien)"
        : !carriesFood(player) ? "geen eten bij zich"
        : (entry.lastFoe.level ?? 0) > player.getSkillManager().getCombatLevel() ? "sterkere tegenstander"
        : "verloor het gevecht met eten bij zich",
      prayer: player.getSkillManager().getCurrentLevel(core.Skill.PRAYER) });
    note(player, `Is gestorven bij (${at.getX()}, ${at.getY()})${entry.lastFoe && now() - entry.lastFoe.at < 60_000 ? ` door ${entry.lastFoe.name.toLowerCase()}` : ""}; gaat zijn spullen ophalen.`, "activity");
    entry.lastFoe = null;
    entry.graveTries = 0;
    entry.questRun = null;
    entry.phase = "new";
    entry.plan = null;
    entry.until = now() + 5_000;
  }

  /** Its bag sorted: to bank (useful), to sell, and junk to drop. */
  function sortBag(player) {
    const goods = Trade.goodsToSell(player, core, Trade.keepIds(player, core, { isFood }), { isFood });
    const keep = [];
    const sell = [];
    for (const good of goods) {
      const id = baseId(good.itemId);
      if (need(player, id) > banked(player, id)) keep.push(good);
      else sell.push(good);
    }
    const junk = [];
    for (const item of player.getInventory().getItems() ?? []) {
      const id = item?.getId?.() ?? -1;
      if (!(id > 0) || need(player, id) > 0) continue;
      const definition = core.ItemDefinition?.forId?.(id);
      const wearable = Number.isInteger(definition?.getEquipmentType?.()?.getSlot?.()) && definition.getEquipmentType().getSlot() >= 0;
      const each = Value.itemValue(core, id, 1);
      const pouch = /^coin pouch/i.test(String(core.ItemDefinition.forId(id)?.getName?.() ?? ""));
      // Rewards are never junk, worth nothing at the shop or not (a lamp's XP, a casket, a clue).
      if (REWARD_NAME.test(String(definition?.getName?.() ?? ""))) continue;
      if (!wearable && !pouch && each < (data.junkValue ?? 3) && !Trade.keepIds(player, core, { isFood }).has(id)) junk.push(id);
    }
    return { keep, sell, junk: [...new Set(junk)] };
  }

  /** Junk out of the bag, as a player drops it. */
  /**
   * Coin pouches from pickpocketing are opened (Open-all, the game's own item option), not
   * dropped as worthless: they are its coins.
   */
  /**
   * Quest and clue rewards are used as a player uses them: an antique lamp is rubbed (its XP goes
   * to the skill furthest behind among those it may pick, see the xpreward:open handler), a
   * casket opened. A scroll box or clue scroll is kept (banked) for later.
   */
  function useRewards(player) {
    const items = player.getInventory().getItems() ?? [];
    for (let slot = 0; slot < items.length; slot += 1) {
      const item = items[slot];
      if (!item || !(item.getId() > 0)) continue;
      const name = String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? "");
      const option = /^antique lamp$/i.test(name) ? "Rub" : /^casket/i.test(name) ? "Open" : null;
      if (!option) continue;
      api.emitItemAction?.({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot,
        clickType: 1, option, handled: false });
      // One a click (the lamp waits for its skill choice); the next on the next look.
      return;
    }
  }

  /** Its pick on a lamp's skill menu: the skill furthest behind of those offered. */
  function onXpReward(event) {
    const player = event?.player;
    if (!player || !adventurers.has(player.getUsername?.()) || typeof event.onConfirm !== "function") return;
    const offered = Array.isArray(event.skills) && event.skills.length > 0 ? event.skills : core.Skill.values();
    const manager = player.getSkillManager();
    const lowest = [...offered].sort((a, b) => manager.getMaxLevel(a) - manager.getMaxLevel(b))[0];
    if (!lowest) return;
    const message = event.onConfirm(lowest, lowest.getName());
    if (message) note(player, `Wrijft over een antique lamp: XP in ${String(lowest.getName()).toLowerCase()}.`, "skill");
  }

  function openPouches(player) {
    const items = player.getInventory().getItems() ?? [];
    items.forEach((item, slot) => {
      if (!item || !(item.getId() > 0)) return;
      if (!/^coin pouch/i.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? ""))) return;
      api.emitItemAction?.({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot,
        clickType: 1, option: "Open-all", handled: false });
    });
  }

  function dropJunk(player, junk) {
    const inventory = player.getInventory();
    for (const id of junk) inventory.deleteNumber?.(id, inventory.getAmount(id));
    inventory.refreshItems?.();
    if (junk.length > 0) note(player, `Laat vallen: ${junk.map(itemName).join(", ")} (waardeloos).`, "activity");
  }

  /** The nearest bank (data.banks) to where it is. */
  function nearestBank(player, entry = [...adventurers.values()].find((other) => other.player === player)) {
    const at = player.getLocation();
    let best = null;
    // Every bank in the world counts: the nearest usable booth from the object index (any
    // town, not only the named list), and the three nearest named banks; then the shortest walk
    // among them. A walk estimate never sends it from Port Sarim to Seers' Village.
    const named = (data.banks ?? []).filter((bank) => !blockedPlace(entry, bank));
    const booth = nearestBooth(player);
    const candidates = booth && !blockedPlace(entry, booth) ? [...named, booth] : named;
    const near = candidates
      .map((bank) => ({ bank, straight: Math.max(Math.abs(bank.x - at.getX()), Math.abs(bank.y - at.getY())) }))
      .sort((a, b) => a.straight - b.straight).slice(0, 4);
    for (const { bank, straight } of near) {
      const walk = walkTiles({ x: at.getX(), y: at.getY() }, bank, player);
      let away = Number.isFinite(walk) ? Math.min(walk, straight * 3) : straight * 3;
      // Through the Al Kharid toll gate (a bank on its other side): a detour as players weigh it,
      // and none at all without the toll. After a reset all sixty went to Al Kharid's bank from
      // Lumbridge and queued at the gate on the way back.
      const sideOf = (x) => x >= TOLL_GATE.x;
      if (sideOf(at.getX()) !== sideOf(bank.x) && at.getY() > 3100 && at.getY() < 3340 && bank.y > 3100 && bank.y < 3340) {
        const pays = player.getInventory().getAmount(Trade.COINS) >= 10 || questsByName().get(normalize("Prince Ali Rescue"))?.isComplete(player) === true;
        if (!pays) continue;
        away += 80;
      }
      if (!best || away < best.away) best = { ...bank, away };
    }
    return best;
  }

  /** The nearest bank booth that opens the bank (Bank or Use), from the bots' object index. */
  function nearestBooth(player) {
    const { BANK_BOOTH_IDS, isUsableBankBooth } = require("../lib/BankBooths.PlayerBots");
    const found = world.objectSearch?.findNearestIndexedLocation?.(player, [...BANK_BOOTH_IDS], {
      regionRadius: 6, accept: (objectId) => isUsableBankBooth(objectId),
    });
    if (!found) return null;
    // Named after the bank of the list it belongs to, else after where it is.
    const own = (data.banks ?? []).find((bank) => Math.max(Math.abs(bank.x - found.x), Math.abs(bank.y - found.y)) <= 15);
    return { id: own?.id ?? `bank_${found.x}_${found.y}`, name: own?.name ?? describeLocation(player, found).near ?? "de bank", x: found.x, y: found.y, z: found.z };
  }

  function distanceTo(player, place) {
    const at = player.getLocation();
    return Math.max(Math.abs(place.x - at.getX()), Math.abs(place.y - at.getY()));
  }

  /** Into its bank, at a bank: everything it would otherwise sell (it sells them at the GE later). */
  function deposit(player, goods) {
    const inventory = player.getInventory();
    const stored = [];
    for (const { itemId, amount } of goods) {
      const tab = core.Bank?.getTabForItem?.(player, itemId) ?? 0;
      const bank = player.getBank?.(tab);
      if (!bank) continue;
      const held = inventory.getAmount(itemId);
      if (held <= 0) continue;
      // A note goes in as the item itself, as the bank does it.
      const definition = core.ItemDefinition?.forId?.(itemId);
      const bankId = definition?.isNoted?.() ? definition.unNote() : itemId;
      bank.add(new core.Item(bankId, held), false);
      inventory.deleteNumber?.(itemId, held);
      stored.push({ itemId, amount: held });
    }
    inventory.refreshItems?.();
    return stored;
  }

  /** Out of its bank, unnoted, as many as fit (up to `amount`). Returns how many. */
  function withdraw(player, itemId, amount) {
    const inventory = player.getInventory();
    // A stack (coins, runes, noted goods) takes one slot whatever the amount.
    const stacks = core.ItemDefinition?.forId?.(itemId)?.isStackable?.() === true || itemId === Trade.COINS;
    const room = stacks ? (inventory.getAmount(itemId) > 0 || inventory.getFreeSlots() > 0 ? Infinity : 0) : inventory.getFreeSlots();
    let wanted = Math.min(amount, room);
    let got = 0;
    for (const bank of player.getBanks?.() ?? []) {
      const have = bank?.getAmount?.(itemId) ?? 0;
      const take = Math.min(have, wanted - got);
      if (take <= 0) continue;
      bank.deleteNumber?.(itemId, take);
      acquire(player, itemId);
      inventory.add(new core.Item(itemId, take), false);
      got += take;
    }
    inventory.refreshItems?.();
    return got;
  }

  /**
   * Slayer: with no task it walks to the nearest master (Turael, Spria) and asks for one;
   * with a task it fights only the task's monsters, at the nearest place it can fight them.
   * A task it cannot do here (Wilderness, a dungeon, a finishing item) puts Slayer aside.
   */
  function startSlayer(entry, plan, nowMs) {
    const { player } = entry;
    const task = Slayer.currentTask(emit, player);
    const here = { x: player.getLocation().getX(), y: player.getLocation().getY() };
    if (!task) {
      // The best master its levels allow and it can walk to; of equals, the nearest.
      const options = Slayer.mastersFor({ combat: player.getSkillManager().getCombatLevel(), slayer: levelOf(player, "SLAYER") },
        (place) => TravelHubs.onFoot(place, null, (name) => questsByName().get(normalize(name))?.isComplete(player) === true, (item) => Shopping.owns(player, Shopping.idOf(core, item))));
      const best = options.filter((option) => option.combat === options[0]?.combat);
      const master = Slayer.nearest(best.length > 0 ? best : Slayer.MASTERS, (place) => walkTiles(here, place, player));
      if (!master) return false;
      return walkTo(entry, master, {
        reason: "slayer",
        arrive: (slayer) => {
          const { task: got, line } = Slayer.askForTask(emit, slayer, master);
          if (got) {
            note(slayer, `Krijgt van ${master.name} een Slayer-taak: ${got.count} x ${String(got.name).toLowerCase()}.`, "skill");
            entry.slayerNext = true;
          } else {
            note(slayer, `${master.name} gaf geen taak${line ? `: "${line}"` : ""}.`, "activity");
            entry.slayerPausedUntil = now() + 30 * 60_000;
          }
        },
      });
    }
    const targets = Slayer.taskTargets(npcSpawns, (npcId, spawn) => {
      const request = { player, npcId, location: new core.Location(spawn.x, spawn.y, spawn.z ?? 0), onTask: false };
      emit("slayer:on-task", request);
      return request.onTask;
    });
    // A spot it could not get to (behind Draynor Manor's locked door) is left for a while: the
    // next nearest one of its task's monsters instead.
    // Underground spots (the Stronghold of Security's minotaurs, y 9000+) need a dungeon route it
    // does not know yet; a task with only those waits (task #18: dungeon routes).
    // On the mainland it can walk (x 2400+, y 2400-4300): not Kourend (by boat), nor the maps of
    // places one only gets into another way (1893,5189: under the ground, like the Mole Hole).
    const onMainland = (place) => place.x >= 2400 && place.y >= 2400 && place.y <= 4300;
    // Morytania's monsters only after Priest in Peril; none in the Wilderness (y 3520 and up between
    // x 2944 and 3392), where an adventurer does not go for a task.
    const morytania = questsByName().get(normalize("Priest in Peril"))?.isComplete(entry.player) === true;
    const wilderness = (place) => place.x >= 2944 && place.x <= 3392 && place.y >= 3520 && place.y < 4000;
    const open = targets.filter((place) => !blockedNear(entry, place, 15) && place.y < UNDERGROUND_Y && onMainland(place)
      && (morytania || !inMorytania(place)) && !wilderness(place));
    const spot = Slayer.nearest(open, (place) => walkTiles(here, place, player));
    if (!spot) {
      note(player, `Kan zijn Slayer-taak (${String(task.name).toLowerCase()}) hier nog niet doen; laat Slayer even liggen.`, "activity");
      entry.slayerPausedUntil = now() + 60 * 60_000;
      return false;
    }
    // Monsters that need something worn (earmuffs, a nose peg, a facemask): it brings one it owns,
    // buys one where a shop sells it, or leaves the task for now.
    for (const options of Slayer.protectionFor(Slayer.namesNear(targets, spot))) {
      const ids = options.map((name) => Shopping.idOf(core, String(name).toUpperCase().replace(/[^A-Z0-9]+/g, "_"))).filter(Number.isInteger);
      if (ids.some((id) => Shopping.owns(player, id))) {
        const id = ids.find((option) => player.getInventory().getAmount(option) > 0);
        if (id !== undefined) Shopping.wear(player, core, id);
        continue;
      }
      const banked = ids.find((id) => banked(player, id) > 0);
      if (banked !== undefined) return fetchTools(entry, plan, [banked]);
      const buyable = ids.find((id) => Shopping.shopsSelling(id).length > 0);
      if (buyable !== undefined && Shopping.coinsOf(player) >= Shopping.estimatedPrice(core, buyable, 1)
          && shopFor(entry, buyable, itemName(buyable), 1)) return true;
      note(player, `Heeft ${options.join(" of ").toLowerCase()} nodig voor deze Slayer-taak; laat Slayer even liggen.`, "activity");
      entry.slayerPausedUntil = now() + 60 * 60_000;
      return false;
    }
    const run = runtimeEntry(player);
    if (run?.state) {
      run.state.onlyNames = Slayer.namesNear(targets, spot);
      run.state.honestStyle = run.state.honestStyle ?? "melee";
    }
    const home = { x: spot.x, y: spot.y, z: spot.z ?? 0 };
    startActivity(player, "slayer_task", { home, nowMs });
    walkTo(entry, { ...home, name: `de ${String(spot.name).toLowerCase()}` }, { reason: "training", replan: false });
    entry.activity = "slayer_task";
    entry.phase = "training";
    entry.plan = plan;
    // A task is fought to the end (the tick ends the stretch when it is done), as a player
    // finishes a task before doing something else; a long cap in case it cannot be finished.
    entry.until = nowMs + SLAYER_TASK_MAX_MS;
    note(player, `Slayer-taak: ${task.count} x ${String(task.name).toLowerCase()} te gaan.`, "skill");
    return true;
  }

  /**
   * Coins it is short for what it saves up for (a coins goal: gear, a teleport amulet, tools
   * for its next levels). 0 when it has enough or saves for nothing.
   */
  function shortfall(player) {
    const entry = [...adventurers.values()].find((other) => other.player === player);
    const goal = entry ? player.getAttribute(GOAL_ATTRIBUTE) ?? null : null;
    if (goal?.kind !== "coins") return 0;
    return Math.max(0, goal.amount - (Shopping.coinsOf(player) + banked(player, Trade.COINS)));
  }

  /** Coins it has, carried and banked. */
  function allCoins(player) {
    return Shopping.coinsOf(player) + banked(player, Trade.COINS);
  }

  /**
   * Clanmates chip in toward a gear goal, as clan members do: a mate with plenty to spare (more
   * than its own goal and CLAN_KEEP besides) gives at most a quarter of that surplus, never more
   * than is short. Bank to bank, once an hour per adventurer; both journals say so. The rest it
   * earns itself, so it stays a race of the whole clan without anyone being carried.
   */
  function isLeader(name) {
    return Clans.clanOf(data, name)?.leader === name;
  }

  function clanFunds(entry, nowMs) {
    const player = entry.player;
    const short = shortfall(player);
    if (short <= 0 || nowMs < (entry.clanFundsAt ?? 0)) return 0;
    // The leader is helped first and most: half a mate's surplus, every half hour; the others a
    // quarter, once an hour, and never out of the leader's purse.
    const leader = isLeader(entry.name);
    entry.clanFundsAt = nowMs + (leader ? 30 : 60) * 60_000;
    for (const name of Clans.matesOf(data, entry.name).filter((other) => leader || !isLeader(other))) {
      const mate = adventurers.get(name);
      if (!mate?.player?.isRegistered?.()) continue;
      const own = mate.player.getAttribute(GOAL_ATTRIBUTE);
      const surplus = allCoins(mate.player) - (own?.kind === "coins" ? own.amount : 0) - CLAN_KEEP;
      const give = Math.min(short, Math.floor(surplus / (leader ? 2 : 4)));
      if (give < 100) continue;
      let left = give;
      for (const bank of mate.player.getBanks?.() ?? []) {
        const out = Math.min(left, bank?.getAmount?.(Trade.COINS) ?? 0);
        if (out <= 0) continue;
        bank.deleteNumber?.(Trade.COINS, out);
        left -= out;
        if (left <= 0) break;
      }
      const moved = give - left;
      if (moved <= 0) continue;
      player.getBank?.(core.Bank?.getTabForItem?.(player, Trade.COINS) ?? 0)?.add?.(new core.Item(Trade.COINS, moved), false);
      const goal = Goals.describe(player.getAttribute(GOAL_ATTRIBUTE));
      note(player, `Krijgt ${moved.toLocaleString("nl-NL")} gp van clangenoot ${mate.name} voor zijn doel (${goal}).`, "activity");
      note(mate.player, `Geeft ${moved.toLocaleString("nl-NL")} gp aan clangenoot ${entry.name} voor diens doel (${goal}).`, "activity");
      return moved;
    }
    return 0;
  }

  /** What its banked materials (not the supplies it uses up) fetch on the GE, roughly. */
  function bankedMaterialValue(player) {
    const keep = Trade.keepIds(player, core, { isFood });
    let total = 0;
    for (const bank of player.getBanks?.() ?? []) {
      for (const item of bank?.getItems?.() ?? []) {
        const id = item?.getId?.() ?? -1;
        if (!(id > 0) || keep.has(id) || need(player, id) === Infinity) continue;
        total += Value.itemValue(core, id, item.getAmount());
      }
    }
    return total;
  }

  /**
   * At the Grand Exchange's bank: what it banked to sell comes out as notes, as a player
   * withdraws as notes to sell. Returns how many stacks came out.
   */
  /** What it keeps at the exchange: its supplies, and the materials of the job it is on or buying for. */
  function keepAtExchange(player) {
    const keep = Trade.keepIds(player, core, { isFood });
    const entry = adventurers.get(player.getUsername?.());
    // Herblore with 127 kwuarm potions and limpwurt roots in the bank: sold them all at the
    // exchange, then bought 140 of each back for the same job.
    if (entry) {
      for (const id of workingMaterials(entry)) {
        keep.add(id);
        const noted = core.ItemDefinition.forId(id)?.getNoteId?.();
        if (Number.isInteger(noted) && noted > 0) keep.add(noted);
      }
    }
    return keep;
  }

  function withdrawToSell(player) {
    const keep = keepAtExchange(player);
    const inventory = player.getInventory();
    let taken = 0;
    // Saving up: it also sells materials it would keep (logs, gems, bars) until the sale covers
    // what it is short. Its supplies (runes, food, ammo) stay.
    let short = shortfall(player);
    for (const bank of player.getBanks?.() ?? []) {
      for (const item of [...(bank?.getItems?.() ?? [])]) {
        const id = item?.getId?.() ?? -1;
        const amount = item?.getAmount?.() ?? 0;
        if (!(id > 0) || !(amount > 0) || keep.has(id) || Value.itemValue(core, id, 1) <= 0) continue;
        // What it needs stays; only the surplus (or what it has outgrown) is sold.
        const wanted = need(player, id);
        let surplus = wanted === Infinity ? 0 : amount - wanted;
        if (wanted !== Infinity && short > 0 && surplus < amount) {
          const each = Value.itemValue(core, id, 1);
          const extra = Math.min(amount - Math.max(0, surplus), Math.ceil(short / each));
          surplus = Math.max(0, surplus) + extra;
          short -= extra * each;
        }
        if (surplus <= 0) continue;
        if (inventory.getFreeSlots() <= 1) return taken;
        const definition = core.ItemDefinition.forId(id);
        const noteId = definition.getNoteId?.() ?? -1;
        const outId = noteId > 0 && !definition.isNoted?.() ? noteId : id;
        if (outId === id && !definition.isStackable?.() && surplus > inventory.getFreeSlots() - 1) continue;
        bank.deleteNumber?.(id, surplus) ?? bank.delete?.(new core.Item(id, surplus));
        acquire(player, outId);
        inventory.add(new core.Item(outId, surplus), false);
        taken += 1;
      }
    }
    inventory.refreshItems?.();
    return taken;
  }

  /**
   * Better gear no shop near it sells, bought at the Grand Exchange instead (it is there anyway):
   * a bid a little over the guide, paid from its coins; it arrives on its next visit.
   */
  function bidForUpgrades(player) {
    const list = Shopping.shoppingList(player, core, {
      levelOf: (skill) => levelOf(player, skill), questDone: questDone(player), modes: ["woodcutting", "mining"],
      exchange: true,
    });
    const bids = [];
    // Bought once lately: not again (it sold it, or it is in a bank it did not look in): a
    // mid-level account bought the same vambraces and amulet three times over.
    const entry = adventurers.get(player.getUsername?.());
    const recent = (entry ? (entry.boughtGear ??= new Map()) : new Map());
    const fresh = (id) => (recent.get(id) ?? 0) < now();
    const remember = (id) => recent.set(id, now() + 6 * 60 * 60_000);
    for (const want of list) {
      if (!fresh(want.itemId)) continue;
      if (bid(player, core, emit, want.itemId, 1)) { remember(want.itemId); bids.push(want.name.toLowerCase().replace(/_/g, " ")); }
    }
    // For each style it fights with: a better bow or staff and its own armour (d'hide, robes),
    // one piece a visit, when it costs at most the gear share of what it has.
    const rules = { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) };
    for (const style of fightingStyles(player)) {
      for (const [slot, entries] of Object.entries(Shopping.gear.styles?.[style] ?? {})) {
        if (slot === "ammo") continue;
        // What it owns anywhere (its bank too): it bought gear it had in the bank.
        const ownedAt = entries.findIndex((entry) => Shopping.ownsAnywhere(player, Shopping.idOf(core, entry.item)));
        const better = (ownedAt < 0 ? entries : entries.slice(0, ownedAt)).filter((entry) => !entry.earned && Shopping.allowed(entry, rules));
        const want = better[0];
        const id = want ? Shopping.idOf(core, want.item) : null;
        if (!Number.isInteger(id)) continue;
        const price = Shopping.estimatedPrice(core, id, 1);
        if (price <= 0 || price > Shopping.coinsOf(player) * (Shopping.gear.budgetShare ?? 0.5) || !fresh(id)) continue;
        if (bid(player, core, emit, id, 1)) { remember(id); bids.push(want.item.toLowerCase().replace(/_/g, " ")); }
      }
    }
    if (bids.length > 0) note(player, `Biedt op de GE op: ${bids.join(", ")}.`, "activity");
  }

  /** Arrows for its bow, runes for its spells: bought when they run low (and it fights that way). */
  function bidForSupplies(player) {
    const styles = fightingStyles(player);
    const bids = [];
    const top = (name, amount) => {
      const id = Shopping.idOf(core, name);
      if (!Number.isInteger(id) || player.getInventory().getAmount(id) + banked(player, id) >= amount / 3) return;
      if (bid(player, core, emit, id, amount)) bids.push(`${amount} x ${itemName(id)}`);
    };
    // Saved up for a bow (its goal): the best one its Ranged allows, then arrows next visit.
    const bows = (Shopping.gear.styles?.ranged?.weapon ?? []).filter((entry) => levelOf(player, "RANGED") >= (entry.level ?? 1));
    if (!styles.includes("ranged") && bows.length > 0 && !bows.some((entry) => Shopping.owns(player, Shopping.idOf(core, entry.item)))
        && Shopping.coinsOf(player) >= Shopping.estimatedPrice(core, Shopping.idOf(core, bows[bows.length - 1].item), 1)
          + 300 * Shopping.estimatedPrice(core, Shopping.idOf(core, "IRON_ARROW"), 1) + 500) {
      top(bows[bows.length - 1].item, 1);
    }
    if (styles.includes("ranged") || (Shopping.gear.styles?.ranged?.weapon ?? []).some((entry) => Shopping.owns(player, Shopping.idOf(core, entry.item)))) {
      const level = levelOf(player, "RANGED");
      const arrow = (Shopping.gear.styles?.ranged?.ammo ?? []).find((entry) => level >= entry.level);
      if (arrow) top(arrow.item, 300);
    }
    if (styles.includes("magic")) {
      top("AIR_RUNE", 600);
      top("MIND_RUNE", 300);
    } else if (Shopping.coinsOf(player) >= MAGIC_START_BUDGET) {
      // The starter kit's few runes: a first supply to begin Magic with, as a player buys one.
      top("AIR_RUNE", 200);
      top("MIND_RUNE", 100);
    }
    // With coins to spare, a few teleport tablets for long walks (the errands break one when it
    // saves a long walk): the cheapest way round for an adventurer without the Magic for the spell.
    // With the Magic for the spells (Varrock 25 up to Camelot 45), law runes and the elements
    // instead: a player who can cast them does not buy tablets. More of them the richer it is.
    const wealth = Shopping.coinsOf(player);
    const stock = wealth >= 5_000_000 ? 100 : wealth >= 200_000 ? 40 : 15;
    if (levelOf(player, "MAGIC") >= 25 && wealth >= TABLET_BUDGET * 2) {
      top("LAW_RUNE", stock);
      top("AIR_RUNE", stock * 5);
      if (levelOf(player, "MAGIC") >= 31) top("EARTH_RUNE", stock * 2);
      if (levelOf(player, "MAGIC") >= 37) top("WATER_RUNE", stock);
      top("FIRE_RUNE", stock);
    } else if (Shopping.coinsOf(player) >= TABLET_BUDGET) {
      const held = TABLETS.reduce((sum, name) => sum + (Number.isInteger(Shopping.idOf(core, name))
        ? player.getInventory().getAmount(Shopping.idOf(core, name)) + banked(player, Shopping.idOf(core, name)) : 0), 0);
      // Each of the tablets, a few of each (more when it is rich), not one random kind.
      if (held < 4) for (const name of TABLETS) top(name, Math.max(3, Math.floor(stock / 5)));
    }
    if (Shopping.coinsOf(player) >= TABLET_BUDGET) {
      const owned = (name) => {
        const id = Shopping.idOf(core, name);
        return Number.isInteger(id) ? player.getInventory().getAmount(id) + banked(player, id) : 0;
      };
      if (JEWELLERY.reduce((sum, name) => sum + owned(name), 0) < 1) top(JEWELLERY[Math.floor(random() * JEWELLERY.length)], 1);
    }
    if (bids.length > 0) note(player, `Koopt voorraad op de GE: ${bids.join(", ")}.`, "activity");
  }

  function atExchange(player) {
    const entry = adventurers.get(player.getUsername?.());
    fillEmptySlots(player, { fromBank: true });
    const bag = sortBag(player);
    dropJunk(player, bag.junk);
    // The exchange has its bank: what it keeps for later goes in there, not up for sale.
    const stored = [...deposit(player, bag.keep), ...(entry ? [...bankUnusedSupplies(entry, player), ...bankUnusedTools(entry, player)] : [])];
    if (stored.length > 0) note(player, `Bewaart op de bank: ${stored.map((good) => itemName(good.itemId)).join(", ")}.`, "activity");
    const pulled = withdrawToSell(player);
    const goods = Trade.goodsToSell(player, core, keepAtExchange(player), { isFood });
    const { collectedCoins, offered } = Trade.sellAtExchange(player, core, emit, goods);
    if (collectedCoins > 0) {
      note(player, `Haalt ${collectedCoins.toLocaleString("nl-NL")} gp op bij de Grand Exchange.`, "activity");
    }
    if (offered.length > 0) {
      const names = offered.slice(0, 4).map((good) => `${good.amount > 1 ? `${good.amount} x ` : ""}${itemName(good.itemId)}`);
      const total = offered.reduce((sum, good) => sum + good.value, 0);
      note(player, `Zet te koop op de GE${pulled ? " (ook uit de bank)" : ""}: ${names.join(", ")}${offered.length > 4 ? ` en ${offered.length - 4} meer` : ""} (~${total.toLocaleString("nl-NL")} gp).`, "activity");
    }
    // Notes it took out to sell and could not offer (all slots taken, no price) go back in:
    // it does not walk about with a bag of notes.
    const notes = (player.getInventory().getItems() ?? [])
      .filter((item) => item && item.getId() > 0 && core.ItemDefinition.forId(item.getId())?.isNoted?.())
      .map((item) => ({ itemId: item.getId(), amount: item.getAmount() }));
    if (notes.length > 0) deposit(player, notes);
    bidForUpgrades(player);
    bidForSupplies(player);
    for (const name of Trade.wearBest(player, core, { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) })) {
      note(player, `Draagt nu ${name.toLowerCase().replace(/_/g, " ")} (gekocht op de GE).`, "activity");
    }
  }

  /**
   * Between stretches its bag is emptied of the last job's things, as a player does: into the
   * nearest bank, or sold at the Grand Exchange when that is about as near, when it carries a lot
   * (data.sellValue) or when earlier sales wait there. Small change (data.keepValue) stays.
   * True when it set off.
   */
  /**
   * An empty gear slot is filled from what it has (its bag, or its bank when it stands at one): a
   * bronze dagger beats bare fists, a wooden shield beats none. Not a tool (axe, pickaxe), a bow
   * or a staff (those are its other ways of fighting), nor arrows. Of several, the dearest.
   */
  /** Whether it owns a two-handed weapon from its gear lists (a scythe), worn or not. */
  function ownsTwoHander(player) {
    return (Shopping.gear.slots?.weapon ?? []).some((entry) => {
      const id = Shopping.idOf(core, entry.item);
      return Number.isInteger(id) && Shopping.ownsAnywhere(player, id) && core.ItemDefinition?.forId?.(id)?.isDoubleHanded?.() === true;
    });
  }

  function fillEmptySlots(player, { fromBank = false } = {}) {
    const equipment = player.getEquipment().getItems() ?? [];
    const skip = new Set([...Object.values(Shopping.gear.tools ?? {}).flat(), ...(Shopping.gear.styles?.ranged?.weapon ?? []),
      ...(Shopping.gear.styles?.magic?.weapon ?? [])].map((entry) => Shopping.idOf(core, entry.item)).filter(Number.isInteger));
    const ammoSlot = core.Equipment?.AMMUNITION_SLOT;
    const skillByIndex = new Map(core.Skill.values().map((skill) => [skill.getIndex(), skill]));
    const mayWear = (definition) => (definition.getRequirements?.() ?? []).every((needed, index) =>
      !(needed > 1) || player.getSkillManager().getMaxLevel(skillByIndex.get(index)) >= needed);
    const best = new Map();
    const consider = (id) => {
      if (!(id > 0) || skip.has(id)) return;
      const definition = core.ItemDefinition.forId(id);
      const slot = definition?.getEquipmentType?.()?.getSlot?.();
      if (!Number.isInteger(slot) || slot < 0 || slot === ammoSlot || equipment[slot]?.getId?.() > 0) return;
      // The shield slot stays empty beside a two-handed weapon (a scythe), also while the axe is
      // in its hand instead.
      if (slot === (core.Equipment?.SHIELD_SLOT ?? 5) && (Trade.twoHanded(player, core) || ownsTwoHander(player))) return;
      if (definition.isNoted?.() || !mayWear(definition)) return;
      const value = Value.itemValue(core, id, 1);
      if (!best.has(slot) || value > best.get(slot).value) best.set(slot, { id, value });
    };
    for (const item of player.getInventory().getItems() ?? []) consider(item?.getId?.() ?? -1);
    if (fromBank) for (const bank of player.getBanks?.() ?? []) for (const item of bank?.getItems?.() ?? []) consider(item?.getId?.() ?? -1);
    const worn = [];
    for (const { id } of best.values()) {
      if (player.getInventory().getAmount(id) <= 0 && !(fromBank && withdraw(player, id, 1) > 0)) continue;
      if (Shopping.wear(player, core, id)) worn.push(itemName(id));
    }
    if (worn.length > 0) note(player, `Trekt aan wat hij heeft: ${worn.join(", ").toLowerCase()}.`, "activity");
    return worn;
  }

  function trade(entry) {
    const { player } = entry;
    const rules = { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) };
    // Woodcutting or mining wields the axe or pickaxe: the weapon is not put back on mid-job
    // (that swapped battleaxe and rune axe back and forth all stretch).
    // Also on the way to the bank and back in the middle of that job (phase "errand"): the
    // battleaxe went on at every bank trip and the axe back on at the trees.
    const gathering = (plan) => ["woodcutting", "mining"].includes(plan?.mode);
    const toolInHand = (entry.phase === "training" || entry.phase === "errand") && (gathering(entry.plan) || gathering(entry.savedTask));
    for (const name of Trade.wearBest(player, core, rules, "melee", { skipWeapon: toolInHand })) {
      note(player, `Draagt nu ${name.toLowerCase().replace(/_/g, " ")}.`, "activity");
    }
    fillEmptySlots(player);
    buryLowBones(player);
    // Coin pouches are opened; junk goes at once, wherever it is.
    openPouches(player);
    useRewards(player);
    dropJunk(player, sortBag(player).junk);
    const keep = Trade.keepIds(player, core, { isFood });
    // The materials of the job it is about to do (logs it just took out to fletch): kept in the
    // bag, not counted as a full bag, never banked straight back (that was a loop of 260 trips).
    const working = workingMaterials(entry);
    for (const id of working) keep.add(id);
    const goods = Trade.goodsToSell(player, core, keep, { isFood });
    // Everything the last job left in the bag, priced or not: logs from woodcutting do not go
    // fishing with it.
    const stock = Trade.goodsToSell(player, core, keep, { isFood, worthless: true });
    const worth = goods.reduce((sum, good) => sum + good.value, 0);
    const workingSlots = (player.getInventory().getItems() ?? []).filter((item) => item && working.has(item.getId())).length;
    const full = player.getInventory().getFreeSlots() + workingSlots <= (data.fullSlots ?? 4);
    const cluttered = Trade.slotsOf(player, stock) >= (data.storeSlots ?? 6);
    const waiting = Trade.finishedOffers(player, emit) > 0;
    // Saving up and its banked logs, gems or bars would cover a good part of it: off to sell.
    const short = shortfall(player);
    const fund = short > 0 && now() >= (entry.fundAfter ?? 0) && !blockedPlace(entry, data.grandExchange) && bankedMaterialValue(player) + worth >= short / 4;
    if (fund) entry.fundAfter = now() + 20 * 60_000;
    if (!waiting && !fund && worth < (data.keepValue ?? 200) && !((full || cluttered) && stock.length > 0)) return false;
    const ge = { ...data.grandExchange, name: "de Grand Exchange" };
    const bank = nearestBank(player);
    const urgent = full || cluttered;
    const geOpen = !blockedPlace(entry, ge);
    // The exchange when it is about as near as a bank, or for a sale worth the detour (saving up,
    // offers to collect, a valuable bag) when it is not much further. Far off it banks, as a
    // player does in the middle of a woodcutting trip, and sells another time.
    const extra = bank ? distanceTo(player, ge) - bank.away : 0;
    const toExchange = geOpen && (!bank || extra <= 40 || ((fund || waiting || worth >= (data.sellValue ?? 5000)) && extra <= SELL_DETOUR_TILES));
    if (toExchange) return walkTo(entry, ge, { reason: "exchange", arrive: atExchange, urgent });
    // Saving up or offers waiting are reasons for the exchange only: to a bank it goes with
    // a bag to empty, else it would walk there for nothing, again and again.
    if (!bank || !(full || cluttered || worth >= (data.keepValue ?? 200))) return false;
    return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
      reason: "bank",
      urgent,
      arrive: (banker) => {
        // What it may wear from its bank goes on first, so it is not banked with the rest.
        fillEmptySlots(banker, { fromBank: true });
        // The materials of its job (oak logs to fletch) stay in the bag here too.
        const keepHere = Trade.keepIds(banker, core, { isFood });
        for (const id of workingMaterials(entry)) keepHere.add(id);
        const stored = [...deposit(banker, Trade.goodsToSell(banker, core, keepHere, { isFood, worthless: true })),
          ...bankUnusedSupplies(entry, banker), ...bankUnusedTools(entry, banker)];
        if (stored.length > 0) note(banker, `Zet op de bank in ${bank.name ?? bank.id}: ${stored.slice(0, 5).map((good) => itemName(good.itemId)).join(", ")}${stored.length > 5 ? ` en ${stored.length - 5} meer` : ""}. Bruikbaars bewaart hij; de rest verkoopt hij later op de GE.`, "activity");
        // Its means of travel back in the bag (it teleports only from there): law runes with the
        // elements when it has the Magic for the spells, its tablets and charged jewellery.
        const travelBack = [];
        const take = (name, amount) => {
          const id = Shopping.idOf(core, name);
          if (Number.isInteger(id) && banked(banker, id) > 0 && banker.getInventory().getFreeSlots() > 2 && withdraw(banker, id, amount) > 0) travelBack.push(itemName(id));
        };
        if (levelOf(banker, "MAGIC") >= 25) for (const name of ["LAW_RUNE", "AIR_RUNE", "EARTH_RUNE", "WATER_RUNE", "FIRE_RUNE"]) take(name, 1_000);
        // Some coins in the bag (the Al Kharid toll, a ferry, a shop on the way).
        const carried = banker.getInventory().getAmount(Trade.COINS);
        if (carried < 1_000 && banked(banker, Trade.COINS) > 0) withdraw(banker, Trade.COINS, 1_000 - carried);
        for (const name of [...TABLETS, ...JEWELLERY]) take(name, name.startsWith("AMULET") || name.startsWith("RING") || name.startsWith("GAMES") ? 1 : 20);
        if (travelBack.length > 0) note(banker, `Neemt mee om te reizen: ${travelBack.join(", ").toLowerCase()}.`, "activity");
      },
    });
  }

  /** The materials its current or next job uses up (a buy_ job's logs, bars, raw fish). */
  function workingMaterials(entry) {
    const ids = new Set();
    for (const plan of [entry.resume, entry.plan, entry.savedTask]) {
      const mode = String(plan?.mode ?? "");
      if (!mode.startsWith("buy_") || !plan.skill) continue;
      const buy = buyPlan(entry.player, plan.skill);
      for (const id of buy?.materials ?? []) ids.add(id);
    }
    return ids;
  }

  /**
   * With no bank in reach: drops the cheapest things it does not keep (worth less than
   * data.cheapValue a stack) until the bag has room. True when there is room now.
   */
  function clearBag(player) {
    const inventory = player.getInventory();
    const room = (data.fullSlots ?? 4) + 1;
    if (inventory.getFreeSlots() >= room) return true;
    const stock = Trade.goodsToSell(player, core, Trade.keepIds(player, core, { isFood }), { isFood, worthless: true })
      .sort((a, b) => a.value - b.value);
    const dropped = [];
    for (const good of stock) {
      if (inventory.getFreeSlots() >= room) break;
      if (good.value >= (data.cheapValue ?? 500)) break;
      inventory.deleteNumber?.(good.itemId, inventory.getAmount(good.itemId));
      dropped.push(itemName(good.itemId));
    }
    inventory.refreshItems?.();
    if (dropped.length > 0) note(player, `Kon geen bank bereiken; laat het goedkoopste vallen: ${dropped.slice(0, 4).join(", ")}.`, "activity");
    return inventory.getFreeSlots() >= room;
  }

  function itemName(itemId) {
    return String(core.ItemDefinition?.forId?.(itemId)?.getName?.() ?? itemId).toLowerCase();
  }

  /** Better gear and tools it can afford now, bought and worn before its next stretch. */
  function upgrade(entry) {
    const { player } = entry;
    const list = Shopping.shoppingList(player, core, {
      // Gear only: the tools for a skill are bought when it takes that skill up (startTraining),
      // not a hammer and a knife on every round while it fights bare-handed.
      levelOf: (skill) => levelOf(player, skill), questDone: questDone(player), modes: [],
    });
    if (list.length === 0) return false;
    // What only the exchange has (no shop near): every piece it can pay for in one visit, as a
    // player buys a whole set at once, not one walk to the GE per piece.
    const at = player.getLocation();
    const viaShop = (want) => {
      const shop = Shopping.nearestShop(want.itemId, { x: at.getX(), y: at.getY() });
      return shop && shop.distance <= (data.shopRadius ?? 80) && !((entry.emptyShops?.get(`${shop.shopId}:${want.itemId}`) ?? 0) > now());
    };
    const first = list[0];
    if (viaShop(first)) return shopFor(entry, first.itemId, first.name);
    const atExchange = list.filter((want) => !viaShop(want));
    return buyManyOnExchange(entry, atExchange) || list.some((want) => shopFor(entry, want.itemId, want.name));
  }

  /** To the Grand Exchange once for several pieces: each bought while the coins last. */
  function buyManyOnExchange(entry, wants) {
    const { player } = entry;
    const priced = wants.map((want) => ({ ...want, guide: Number(core.ItemDefinition?.forId?.(want.itemId)?.getGrandExchangeValue?.() ?? 0) }))
      .filter((want) => want.guide > 0);
    if (priced.length === 0 || Shopping.coinsOf(player) + banked(player, Trade.COINS) < Math.ceil(priced[0].guide * 1.05) + 50) return false;
    if (blockedPlace(entry, data.grandExchange)) return false;
    const plan = entry.plan;
    return walkTo(entry, { ...data.grandExchange, name: "de Grand Exchange" }, {
      reason: "buy_materials",
      arrive: (buyer) => {
        emit("ge:collect", { player: buyer });
        // The coins for the lot out of its bank first (the exchange has one).
        const total = priced.reduce((sum, want) => sum + Math.ceil(want.guide * 1.05), 0) + 50;
        if (total > Shopping.coinsOf(buyer)) withdraw(buyer, Trade.COINS, Math.min(total - Shopping.coinsOf(buyer), banked(buyer, Trade.COINS)));
        const bought = [];
        let spent = 0;
        for (const want of priced) {
          const cost = Math.ceil(want.guide * 1.05);
          if (Shopping.coinsOf(buyer) < cost + 50) continue;
          if (!bid(buyer, core, emit, want.itemId, 1)) continue;
          emit("ge:collect", { player: buyer });
          acquire(buyer, want.itemId);
          bought.push(String(want.name).toLowerCase().replace(/_/g, " "));
          spent += cost;
        }
        if (bought.length > 0) note(buyer, `Koopt op de GE: ${bought.join(", ")} (~${spent.toLocaleString("nl-NL")} gp).`, "activity");
        if (plan?.mode) entry.savedTask = { kind: "train", mode: plan.mode, skill: plan.skill, reason: plan.reason, target: plan.target ?? null, planActivity: plan.activity ?? null, remainingMs: 0, savedAt: now() };
      },
    });
  }

  /** Logs in the adventurers (or just `only`). */
  function spawn(only = null) {
    const at = data.spawn;
    for (const name of Clans.namesOf(data)) {
      if (adventurers.has(name) || (only && name !== only)) continue;
      const bot = runtime.spawnPvpBot(new core.Location(at.x, at.y, at.z ?? 0), {
        mode: "roaming", activity: "world", username: name, persistent: true, keepSavedLocation: true,
      });
      if (!bot) continue;
      // Bots get a generated name shown above them; an adventurer goes by its own.
      bot.setDisplayName?.(name);
      bot.getUpdateFlag?.()?.flag?.(core.Flag?.APPEARANCE);
      // Each starts its day a little apart (0-90 s), not fifteen at once to the same bank.
      adventurers.set(name, { name, player: bot, phase: "new", until: now() + Math.floor(random() * 90_000), plan: null, activity: null });
      // Honest: no conjured gear, tools, food or bait; it buys, finds or makes what it uses.
      const state = runtime.botStatesByName?.get?.(name);
      markHonest(bot);
      markAdventurer(bot);
      // Monsters attack it as they attack a player; like a new player's, its auto-retaliate is on.
      bot.setAutoRetaliate?.(true);
      if (state) {
        state.honest = true;
        // Its own planner trades for it (trade()); the world bots' upkeep leaves it alone.
        state.adventurer = true;
      }
      // An extra member that has no test start yet (it was made before the profiles) gets one now.
      if (Number(bot.getAttribute(GENERATION_ATTRIBUTE) ?? 0) < (data.generation ?? 1)
          || (testProfileOf(name) && !bot.getAttribute(TEST_PROFILE_ATTRIBUTE))) startOver(bot);
      // A test start from before its weapons came charged (a scythe that turned uncharged at its
      // first hit): charged once, everything it has, so it is not left with the rune scimitar.
      if (testProfileOf(name) && !bot.getAttribute(CHARGED_ATTRIBUTE)) {
        for (const container of [bot.getEquipment(), bot.getInventory(), ...(bot.getBanks?.() ?? [])]) {
          for (const item of container?.getItems?.() ?? []) {
            if (item?.getId?.() > 0) emit("item:fill-charges", { player: bot, item, handled: false });
          }
          container?.refreshItems?.();
        }
        bot.setAttribute(CHARGED_ATTRIBUTE, true);
        Trade.wearBest(bot, core, { levelOf: (skill) => levelOf(bot, skill), questDone: questDone(bot) }, "melee");
      }
      // It knows Death already: a death leaves a grave without the first-death tutorial.
      emit("gravestones:met-death", { player: bot });
      adventurers.get(name).savedTask = Tasks.freshTask(bot.getAttribute?.(TASK_ATTRIBUTE), Date.now());
    }
  }

  /**
   * Overwrites its saved job: at once for a new job, else at most every TASK_SAVE_MS. The save is
   * written to disk too, so a server that is killed (not stopped) loses at most that much.
   */
  function rememberTask(entry, nowMs) {
    const fresh = entry.plan !== entry.savedPlan;
    if (!fresh && nowMs - (entry.taskSavedAt ?? 0) < TASK_SAVE_MS) return;
    const record = Tasks.taskRecord(entry, nowMs, Date.now());
    if (!record) return;
    entry.savedPlan = entry.plan;
    entry.taskSavedAt = nowMs;
    entry.player.setAttribute(TASK_ATTRIBUTE, record);
    try {
      const persistence = core.GameConstants?.PLAYER_PERSISTENCE;
      (persistence?.requestSave ?? persistence?.save)?.call(persistence, entry.player, "adventurer-task");
    } catch (error) {
      world.log?.("adventurer_task_save_failed", { name: entry.name, error: String(error?.message ?? error) });
    }
  }

  /** After a restart: the saved job again, for the time it had left. False when it cannot. */
  function resumeTask(entry, nowMs) {
    const task = entry.savedTask;
    entry.savedTask = null;
    const plan = Tasks.planOf(task, (data.bosses ?? []).filter((boss) => boss.onFoot !== false));
    if (!plan) return false;
    // Already at the level the job was for (combat 10 at combat 25): something new instead.
    if (plan.target) {
      const level = plan.target.skill === "COMBAT" ? entry.player.getSkillManager().getCombatLevel() : levelOf(entry.player, plan.target.skill);
      if (level >= plan.target.level) return false;
    }
    const started = plan.kind === "boss" ? startBoss(entry, plan, nowMs) : startTraining(entry, plan, nowMs);
    if (!started) return false;
    // An errand first (food, a tool, its supplies from the bank): the job waits until it is back.
    if (entry.phase !== "training" && entry.phase !== "boss") {
      if ((task.tries = (task.tries ?? 0) + 1) < 3) entry.savedTask = task;
      return true;
    }
    // The same job, for what was left of it.
    entry.until = nowMs + Tasks.resumeMs(task);
    note(entry.player, `${task.afterTrip ? "Gaat verder met" : "Pakt na de herstart zijn klus weer op:"} ${String(task.activity ?? plan.mode ?? "").replace(/_/g, " ")}.`, "activity");
    return true;
  }

  function onLevelUp({ player, skill, newLevel }) {
    if (!player || !adventurers.has(player.getUsername?.())) return;
    // A test start set its levels (applyTestProfile): not levels it gained.
    if (settingProfile.has(player)) return;
    const name = String(skill?.getName?.() ?? skill ?? "").toLowerCase();
    note(player, `Level ${newLevel} ${name}!`, "skill");
  }

  function describeLocation(player, point = null) {
    const at = player.getLocation();
    const here = point ? { x: point.x, y: point.y } : { x: at.getX(), y: at.getY() };
    let best = null;
    for (const place of [...LANDMARKS, ...travelData.destinations, ...travelData.hangouts, ...travelData.minigames]) {
      const distance = Math.max(Math.abs(place.x - here.x), Math.abs(place.y - here.y));
      if (!best || distance < best.distance) best = { id: place.id, distance };
    }
    const name = best && best.distance < 120 ? best.id.replace(/_/g, " ") : "onderweg";
    return { x: here.x, y: here.y, z: at.getZ(), near: name };
  }

  /** Coins value (Grand Exchange) of a container's items. */
  function containerValue(container) {
    let value = 0;
    for (const item of container?.getItems?.() ?? []) {
      const id = item?.getId?.() ?? -1;
      const amount = item?.getAmount?.() ?? 0;
      if (id === COINS) value += amount;
      else if (id > 0 && amount > 0) value += Value.itemValue(core, id, amount);
    }
    return value;
  }

  /** The bank's most valuable stacks, for the page. */
  /** The stacks in containers, most valuable first: { itemId, name, amount, value }. */
  function stacksIn(containers, count = Infinity, byValue = true) {
    const stacks = [];
    for (const container of containers) {
      for (const item of container?.getItems?.() ?? []) {
        const id = item?.getId?.() ?? -1;
        const amount = item?.getAmount?.() ?? 0;
        if (!(id > 0) || !(amount > 0)) continue;
        const value = id === COINS ? amount : Value.itemValue(core, id, amount);
        stacks.push({ itemId: id, name: core.ItemDefinition?.forId?.(id)?.getName?.() ?? `item ${id}`, amount, value });
      }
    }
    return (byValue ? stacks.sort((a, b) => b.value - a.value) : stacks).slice(0, count);
  }

  function bankTop(player, count = 8) {
    return stacksIn(player.getBanks?.() ?? [], count);
  }

  function wealthOf(player) {
    const bank = (player.getBanks?.() ?? []).reduce((sum, tab) => sum + containerValue(tab), 0);
    const carried = containerValue(player.getInventory?.()) + containerValue(player.getEquipment?.());
    return { bank, carried, total: bank + carried };
  }

  /**
   * Who is doing best: total level, plus 2 per quest point, plus 1 per million coins of wealth.
   * The page shows the order and the score.
   */
  function scoreOf(report) {
    return (report.total ?? 0) + 2 * (report.questPoints ?? 0) + Math.floor((report.wealth?.total ?? 0) / 1_000_000);
  }

  /** What the page and ::adventurers show. */
  const ERRAND_REASONS = {
    grave: "om zijn spullen op te halen", bank: "om te banken", exchange: "om te verkopen en kopen", shop: "om te kopen", withdraw: "om spullen van de bank te halen",
    buy_materials: "om materialen te kopen", slayer: "voor een Slayer-taak", training: "om te trainen", station: "om te trainen", quest: "voor een quest",
  };

  /** What it is doing now, in words, for the page. */
  function doingText(entry) {
    if (entry.phase === "errand" && entry.errand) {
      const minutes = Math.floor((now() - entry.errand.since) / 60_000);
      return `Loopt naar ${entry.errand.to} ${ERRAND_REASONS[entry.errand.reason] ?? ""}${minutes > 0 ? ` (${minutes} min onderweg)` : ""}`.replace(/ +/g, " ").trim();
    }
    if (entry.phase === "waiting") return entry.resume || (entry.offersUntil ?? 0) > now() ? "Wacht op zijn bod op de GE" : "Wacht even (geen bank bereikbaar)";
    if (entry.phase === "boss") return `Boss: ${entry.plan?.boss?.name}`;
    if (entry.phase === "quest" && entry.questRun) return `Quest: ${entry.questRun.name} (stap ${entry.questRun.step + 1})`;
    if (entry.plan) return `Training: ${String(entry.activity).replace(/_/g, " ")} (${entry.plan.reason})`;
    return entry.idleReason ? `Zoekt iets om te doen: ${entry.idleReason}` : "Begint";
  }

  function report() {
    return [...adventurers.values()].map((entry) => {
      const { player } = entry;
      // A level-up may have moved it to a better tier since (Progression.PlayerBots.js).
      const root = runtime.entriesByUsername?.get?.(entry.name)?.brain?.currentRoot?.();
      if (root && entry.phase === "training") entry.activity = root.id;
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
        testProfile: online ? player.getAttribute(TEST_PROFILE_ATTRIBUTE) ?? null : null,
        clan: Clans.clanOf(data, entry.name)?.name ?? null,
        emblem: Clans.clanOf(data, entry.name)?.emblem ?? null,
        leader: Clans.clanOf(data, entry.name)?.leader === entry.name,
        online,
        combat: online ? player.getSkillManager().getCombatLevel() : null,
        total: online ? player.getSkillManager().getTotalLevel() : null,
        questPoints: view?.questPoints ?? 0,
        quests: view ? [...view.done] : [],
        questsTotal: questList().length,
        goal: online ? Goals.describe(player.getAttribute(GOAL_ATTRIBUTE) ?? null) : null,
        skills,
        doing: doingText(entry),
        group: entry.group === true,
        until: entry.until,
        location: online ? describeLocation(player) : null,
        wealth: online ? wealthOf(player) : null,
        bank: online ? bankTop(player) : [],
        carried: online ? stacksIn([player.getInventory()]) : [],
        // In slot order (head, cape, neck, weapon, body, shield, ...), as the equipment tab shows.
        worn: online ? stacksIn([player.getEquipment()], Infinity, false) : [],
        journal: online ? journal(player).slice().reverse() : [],
      };
    }).map((entry) => ({ ...entry, score: scoreOf(entry) }))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  /** Owner test hook: starts a quest with a playthrough for this adventurer now. */
  function forceQuest(name, questName, stage = null) {
    const entry = adventurers.get(name);
    if (!entry?.player?.isRegistered?.() || !questPlay.has(questName)) return false;
    errands.errands?.delete?.(entry.player);
    entry.questsAside?.delete(questName);
    // A test of one step: the quest set to that stage first (an owner's ::advquest name:quest:stage).
    if (Number.isInteger(stage) && stage >= 0) questPlay.questOf(questName)?.setStage?.(entry.player, stage);
    return startQuest(entry, { kind: "quest", quest: { name: questName } });
  }

  /**
   * An owner's quest sweep (::advquestall): every adventurer at once on a different quest, so one
   * run shows where each of them gets stuck (adventurer-quest-feedback.jsonl, quest_done). The
   * blocks are lifted for it. Each takes the first quest on the path it has not done and is ready
   * for (its levels, its quests), else the first it has not done; never one another already has.
   * Returns [[name, quest]].
   */
  /**
   * The sweep's state: quests tried in it (by anyone), while it runs (two hours). A quest done or
   * put aside sends its adventurer on to the next untried one (sweepNext), so one command tests
   * the whole path, not only thirty quests.
   */
  const sweep = { active: false, until: 0, tried: new Set() };

  function sweepPick(entry) {
    const path = (data.quests ?? []).filter((quest) => questPlay.has(quest.name));
    const view = snapshot(entry.player);
    const open = path.filter((quest) => !view.done.has(quest.name) && !sweep.tried.has(quest.name));
    return open.find((candidate) => isReady(candidate, view)) ?? open[0] ?? null;
  }

  function sweepNext(entry) {
    const quest = sweepPick(entry);
    if (!quest) return false;
    sweep.tried.add(quest.name);
    entry.questsAside?.delete?.(quest.name);
    const started = forceQuest(entry.name, quest.name);
    if (started) world.log?.("adventurer_quest_sweep_next", { bot: entry.name, quest: quest.name, tried: sweep.tried.size });
    return started;
  }

  function questSweep() {
    questsBlocked.clear();
    questFailuresAll.clear();
    Object.assign(sweep, { active: true, until: now() + 2 * 60 * 60_000, tried: new Set() });
    const out = [];
    for (const entry of adventurers.values()) {
      if (!entry.player?.isRegistered?.()) continue;
      entry.questsAside?.clear?.();
      const quest = sweepPick(entry);
      if (!quest) continue;
      sweep.tried.add(quest.name);
      if (forceQuest(entry.name, quest.name)) out.push([entry.name, quest.name]);
    }
    world.log?.("adventurer_quest_sweep", { assignments: out });
    return out;
  }

  /** Ends a running sweep (::advquestall stop): the adventurers go back to their own picks. */
  function stopSweep() {
    sweep.active = false;
    return sweep.tried.size;
  }

  /** An owner's test: this training mode now (::advtrain <name>:slayer). */
  function forceTraining(name, mode) {
    const entry = adventurers.get(name);
    if (!entry?.player?.isRegistered?.() || !mode) return false;
    errands.errands?.delete?.(entry.player);
    entry.questRun = null;
    const skill = mode === "slayer" ? "SLAYER" : String(mode).replace(/^combat_/, "").toUpperCase();
    startTraining(entry, { kind: "train", mode, skill, reason: "op verzoek" }, now());
    return true;
  }

  /**
   * On shutdown: a last metrics round, then the logs pushed to the bot-logs branch at once
   * (scripts/share-bot-logs.sh), so the last minutes of quests and adventurers are not lost.
   */
  const SHARE_SCRIPT = require("path").join(__dirname, "..", "..", "..", "..", "scripts", "share-bot-logs.sh");
  /** Off with ADVENTURER_SHARE_LOGS=0 (a test server that must not overwrite the real logs). */
  function sharingLogs() {
    return (process.env.ADVENTURER_SHARE_LOGS ?? process.env.ADVENTURER_SHARE_LOGS_ON_SHUTDOWN ?? "1") !== "0"
      && require("fs").existsSync(SHARE_SCRIPT);
  }

  /**
   * Every five minutes while the game runs, the logs go to the bot-logs branch (in the background,
   * never two at once). The server does it itself: a loop started beside it stopped with a restart.
   */
  let sharing = null;
  function shareLogsNow() {
    if (sharing || !sharingLogs()) return;
    try {
      sharing = require("child_process").spawn("bash", [SHARE_SCRIPT], { stdio: "ignore" });
      sharing.on("exit", (code) => {
        if (code) world.log?.("adventurer_logs_share_failed", { code });
        sharing = null;
      });
      sharing.on("error", () => { sharing = null; });
    } catch {
      sharing = null;
    }
  }

  function onShutdown() {
    try {
      writeMetrics(now());
      for (const stream of [activityLog, metricsLog]) stream.end?.();
    } catch {
      // A help, not a must.
    }
    if (!sharingLogs()) return;
    try {
      // The streams flush on end; a moment for that, then one push (at most 60 s).
      require("child_process").spawnSync("bash", ["-c", `sleep 1; bash "${SHARE_SCRIPT}"`], { stdio: "inherit", timeout: 60_000 });
    } catch (error) {
      world.log?.("adventurer_logs_share_failed", { error: String(error?.message ?? error) });
    }
  }

  return { adventurers, questFeedback, spawn, tick, onShutdown, onXpReward, shareLogsNow, questSweep, stopSweep, talkTick, forceQuest, forceTraining, onDeath, onLevelUp, onDrops, onNpcDeath, report, next, startGroup, acquire };
}

let bridgeStarting = 0;
/**
 * The bridge's state: "up" (health answers), "busy" (the port takes a connection but health does
 * not answer in time: a bridge working through quests in line) or "down" (nothing on the port).
 */
function bridgeState() {
  const url = process.env.QUEST_HELPER_URL || `http://127.0.0.1:${Number(process.env.QUEST_HELPER_PORT || 16471)}`;
  return fetch(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) }).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return "up";
  }).catch(() => new Promise((resolve) => {
    const socket = require("net").connect({ host: "127.0.0.1", port: Number(new URL(url).port || 80) });
    const done = (state) => { socket.destroy(); resolve(state); };
    socket.setTimeout(2000);
    socket.once("connect", () => done("busy"));
    socket.once("error", () => done("down"));
    socket.once("timeout", () => done("down"));
  }));
}
/** Starts the Quest Helper bridge when it is built and does not answer (see the startup hook). */
let bridgeDownSince = 0;
function keepBridgeUp(world) {
  if ((process.env.ADVENTURER_START_BRIDGE ?? "1") === "0" || Date.now() - bridgeStarting < 4 * 60_000) return;
  const path = require("path");
  const fs = require("fs");
  const root = path.join(__dirname, "..", "..", "..", "..");
  const bin = path.join(root, "tools", "quest-helper-bridge", "build", "install", "offline-quest-helper-bridge", "bin", "offline-quest-helper-bridge");
  if (!fs.existsSync(bin)) return;
  bridgeState().then((state) => {
    if (state === "busy") world?.log?.("adventurer_bridge_busy", {});
    if (state !== "down") {
      bridgeDownSince = 0;
      return;
    }
    // Not at the first miss: start.sh and `update` start one too, and Java takes its time to open
    // its port. Nothing on the port for 90 s: start it.
    bridgeDownSince ||= Date.now();
    if (Date.now() - bridgeDownSince < 90_000) return;
    bridgeDownSince = 0;
    startBridge(world, root, fs, path);
  });
}

function startBridge(world, root, fs, path) {
    if (Date.now() - bridgeStarting < 4 * 60_000) return;
    bridgeStarting = Date.now();
    try {
      fs.mkdirSync(path.join(process.cwd(), "logs"), { recursive: true });
      const out = fs.openSync(path.join(process.cwd(), "logs", "quest-helper-bridge.log"), "a");
      const child = require("child_process").spawn(process.execPath, [path.join(root, "scripts", "run-with-env.mjs"), "-", path.join(root, "scripts", "quest-helper-bridge.mjs")],
        { cwd: root, detached: true, stdio: ["ignore", out, out] });
      child.unref();
      world?.log?.("adventurer_bridge_started", { pid: child.pid });
      console.log("[adventurers] Quest Helper-bridge gestart (log: server/logs/quest-helper-bridge.log)");
    } catch (error) {
      world?.log?.("adventurer_bridge_start_failed", { error: String(error?.message ?? error) });
    }
}

/** Starts the adventurers on server start; serves /api/adventurers and the commands. */
const REPORT_CACHE_MS = 2000;

function startAdventurers({ api, runtime, world, registry }) {
  api.persistAttribute(LOG_ATTRIBUTE, []);
  api.persistAttribute(GENERATION_ATTRIBUTE, 0);
  api.persistAttribute(GOAL_ATTRIBUTE, null);
  api.persistAttribute(TASK_ATTRIBUTE, null);
  // Saved too: without it every restart started the test accounts over (applyTestProfile).
  api.persistAttribute(TEST_PROFILE_ATTRIBUTE, null);
  api.persistAttribute(CHARGED_ATTRIBUTE, false);
  const manager = createAdventurers({ api, runtime, world, registry });
  api.onPlayerLevelUp(manager.onLevelUp);
  api.onCustomEvent("npc-drops:roll", manager.onDrops);
  api.onNpcDeath(manager.onNpcDeath);
  api.onPlayerDeath?.(manager.onDeath);
  // Where an adventurer's things may come from (its audit, above).
  api.onCustomEvent("ge:offer-collected", ({ player, itemId }) => manager.acquire(player, itemId));
  api.onCustomEvent("skills:produced", ({ player, itemId }) => manager.acquire(player, itemId));
  api.onGroundItemPickup((event) => manager.acquire(event.player, event.groundItemId));
  // Every open page asks every 5 s; one report serves them all for 2 s.
  let cached = null;
  const achievements = require("./Achievements.PlayerBots").createAchievements({ generation: data.generation ?? 1 });
  api.registerContentEndpoint("adventurers", () => {
    if (!cached || Date.now() - cached.updated > REPORT_CACHE_MS) {
      const adventurers = manager.report();
      // Test accounts started high: they would take the firsts without having earned them.
      achievements.update(adventurers.filter((adventurer) => !adventurer.testProfile));
      cached = { updated: Date.now(), adventurers, achievements: achievements.view(), questFeedback: manager.questFeedback.slice(0, 30) };
    }
    return cached;
  });
  const rights = api.core.PlayerRights;
  api.registerCommand("adventurers", ({ player }) => {
    for (const a of manager.report()) {
      player.sendMessage(a.online
        ? `#${a.rank} ${a.name}: combat ${a.combat}, totaal ${a.total}, ${a.quests.length} quests, ${Math.round((a.wealth?.total ?? 0) / 1000).toLocaleString("nl-NL")}k. ${a.doing}. Bij ${a.location?.near}.`
        : `${a.name}: offline.`);
    }
    return true;
  }, rights.OWNER, "Show the adventurer bots: levels, quests and what they do");
  api.registerCommand("adventurer", ({ player, parts }) => {
    const name = parts.slice(1).join(" ").toLowerCase();
    const entry = [...manager.adventurers.values()].find((a) => a.name.toLowerCase() === name);
    if (!entry?.player?.isRegistered?.()) {
      player.sendMessage(`Geen avonturier "${name}". Kies uit: ${Clans.namesOf(data).join(", ")}.`);
      return true;
    }
    player.moveTo(entry.player.getLocation().clone());
    player.sendMessage(`Je staat bij ${entry.name}.`);
    return true;
  }, rights.OWNER, "Go to an adventurer bot: ::adventurer <name>");
  api.registerCommand("advquestall", ({ player, parts }) => {
    if (String(parts?.[1] ?? "").toLowerCase() === "stop") {
      player.sendMessage(`Quest-sweep gestopt (${manager.stopSweep()} quests geprobeerd).`);
      return true;
    }
    // The quests are played with the Quest Helper bridge: without it every one fails in two
    // minutes ("fetch failed"), so the sweep is refused with how to start it.
    bridgeState().then((state) => {
      if (state === "down") {
        player.sendMessage("De Quest Helper-bridge draait niet; start hem eerst (yarn bridge) en probeer het dan opnieuw.");
        return;
      }
      const out = manager.questSweep();
      player.sendMessage(`${state === "busy" ? "(De bridge is druk bezig; de quests komen op gang.) " : ""}${out.length} avonturiers proberen elk een andere quest: ${out.map(([name, quest]) => `${name} → ${quest}`).join("; ").slice(0, 400)}`);
    });
    return true;
  }, rights.OWNER, "Every adventurer at once on a different quest, each on to the next untried one when done or stuck (two hours; ::advquestall stop ends it): ::advquestall");
  api.registerCommand("advquest", ({ player, parts }) => {
    const [name, quest, stage] = parts.slice(1).join(" ").split(":").map((part) => part.trim());
    const entry = [...manager.adventurers.values()].find((a) => a.name.toLowerCase() === String(name).toLowerCase());
    player.sendMessage(entry && manager.forceQuest(entry.name, quest, stage === undefined || stage === "" ? null : Number(stage))
      ? `${entry.name} begint aan ${quest}.`
      : "Gebruik: ::advquest <naam>:<quest met een bot-playthrough>.");
    return true;
  }, rights.OWNER, "Start a quest with a bot playthrough for an adventurer, optionally at a stage: ::advquest <name>:<quest>[:<stage>]");
  api.registerCommand("advtrain", ({ player, parts }) => {
    const [name, mode] = parts.slice(1).join(" ").split(":").map((part) => part.trim());
    const entry = [...manager.adventurers.values()].find((a) => a.name.toLowerCase() === String(name).toLowerCase());
    player.sendMessage(entry && manager.forceTraining(entry.name, mode)
      ? `${entry.name} gaat ${mode} doen.` : "Gebruik: ::advtrain <naam>:<modus, bv. slayer>.");
    return true;
  }, rights.OWNER, "Start a training mode for an adventurer: ::advtrain <name>:<mode>");
  // The last minutes of logs out before the server goes down (manager.onShutdown).
  api.onServerShutdown?.(() => manager.onShutdown());
  // The Quest Helper bridge (the adventurers' quests need it): started by the game when it is built
  // but not running, and again if it stops (it ran beside the game only when start.sh started
  // it, and every quest failed after two minutes without it). Off with ADVENTURER_START_BRIDGE=0.
  api.onServerStartup?.(() => {
    const check = () => keepBridgeUp(world);
    setTimeout(check, 15_000).unref?.();
    setInterval(check, 60_000).unref?.();
  });
  // The logs to the bot-logs branch every five minutes, from the game itself (manager.shareLogsNow).
  api.onServerStartup?.(() => {
    const timer = setInterval(() => manager.shareLogsNow(), 5 * 60_000);
    timer.unref?.();
    setTimeout(() => manager.shareLogsNow(), 60_000).unref?.();
  });
  // An adventurer rubbing a lamp picks its skill as a player does (manager.onXpReward).
  api.onCustomEvent?.("xpreward:open", (event) => manager.onXpReward(event));
  api.onServerStartup?.(() => setTimeout(() => {
    // First in, one per tick; the world bots wait until they are in (SpawnPacing).
    runPaced(Clans.namesOf(data).map((name) => () => manager.spawn(name)));
    const { Task } = api.core;
    api.getTaskManager().submit(new (class extends Task {
      constructor() { super(CHECK_TICKS, "adventurers", false); }
      execute() {
        manager.tick();
        // The firsts are looked at every half minute too, not only when the page is open.
        if ((this.looks = (this.looks ?? 0) + 1) % 25 === 0) achievements.update(manager.report().filter((adventurer) => !adventurer.testProfile));
      }
    })());
    // Dialogue is clicked through a tick or so at a time, as a player reads it.
    api.getTaskManager().submit(new (class extends Task {
      constructor() { super(1, "adventurers-talk", false); }
      execute() { manager.talkTick(); }
    })());
  }, 2000));
  return manager;
}

module.exports = { createAdventurers, startAdventurers, unpackCoord, LOG_ATTRIBUTE, TASK_ATTRIBUTE };
