"use strict";

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
const { chooseNext, bestActivity } = require("./Planner.PlayerBots");
const { createQuestList } = require("./Quests.PlayerBots");
const Goals = require("./Goals.PlayerBots");
const { createTravel } = require("../brain/Travel.PlayerBots");
const { startActivity } = require("../brain/BrainActivities.PlayerBots");
const travelData = require("../data/travel-destinations.json");

const LOG_ATTRIBUTE = "adventurers:journal";
/** Its current goal (Goals.PlayerBots.js), kept across restarts. */
const GOAL_ATTRIBUTE = "adventurers:goal";
/** Which start an adventurer belongs to; a lower one than data.generation starts it over. */
const GENERATION_ATTRIBUTE = "adventurers:generation";
/**
 * Its current job ({ kind, mode, skill, reason, style, bossId, activity, remainingMs, savedAt }),
 * one record that is overwritten, never appended: when a job starts and every TASK_SAVE_MS while
 * it runs. After a restart it takes the job up again with the time it had left.
 */
const TASK_ATTRIBUTE = "adventurers:task";
const TASK_SAVE_MS = 3 * 60_000;
const Tasks = require("./Tasks.PlayerBots");
const Shopping = require("./Shopping.PlayerBots");
const Trade = require("./Trade.PlayerBots");
const Slayer = require("./Slayer.PlayerBots");
const Clans = require("./Clans.PlayerBots");
const npcSpawns = require("../../../data/definitions/npc-spawns.json");
const { markHonest } = require("../brain/Honest.PlayerBots");
const { errandsFor } = require("../brain/Errands.PlayerBots");
/** A companion joins a group if its own stretch ends within this. */
const GROUP_JOIN_WINDOW_MS = 4 * 60_000;
const GROUP_MAX = 5;
const Value = require("../../interface/ValueWarning");
const COINS = 995;
const CHECK_TICKS = 10;
/** How long it waits at the exchange for a bid on training materials to fill. */
const BID_WAIT_MS = 3 * 60_000;
/** No XP and no step for this long while training: it is stuck, it picks something else. */
const STUCK_MS = 2 * 60_000;
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
  const travel = createTravel({
    core,
    log: world.log,
    // No outfits, capes or job clothes: an adventurer wears only what it bought, found or made.
    dress: null,
    equipCombatGear: (player, state) => world.equipCombatGear?.(player, state),
    chance: 1,
    hangoutChance: 0,
    // Adventurers walk (walkTo below), and so prefer places near them: a far one is a long walk.
    moveTo: () => {},
    nearness: (here, place, player) => (here ? 1 / (1 + walkTiles(here, place, player) / 150) : 1),
    minigameChance: 0,
    random,
    // Adventurers only go where their quests and levels let them.
    meets: (player, requires) => !requires || (
      (requires.quests ?? []).every((name) => questsByName().get(normalize(name))?.isComplete(player) === true)
      && Object.entries(requires.skills ?? {}).every(([skill, level]) => (core.Skill[skill] ? player.getSkillManager().getMaxLevel(core.Skill[skill]) : 0) >= level)),
  });
  /** name -> { name, player, phase, until, plan, startedAt } */
  const adventurers = new Map();

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
      levels: skillLevels(player),
      combat: player.getSkillManager().getCombatLevel(),
      questPoints: Number(player.getAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE)) || 0,
      done,
      buyable: buyableSkills(player),
      stocked: stockedSkills(player),
      styles: fightingStyles(player),
      slayer: slayerView(player),
      // Only quests a bot can really play (none yet): nothing is simulated.
      available: new Set(questList().filter((quest) => quest.playthrough === true && registered.has(normalize(quest.name)))
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

  /** The materials it would buy for a skill now: { skill, recipe, itemId, name, amount, cost }, or null. */
  function buyPlan(player, skill) {
    const recipe = data.buyToTrain?.[skill];
    if (!recipe) return null;
    const level = levelOf(player, skill);
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
    const coins = Shopping.coinsOf(player);
    const done = questDone(player);
    return Object.keys(data.buyToTrain ?? {}).filter((skill) => {
      // Herblore needs Druidic Ritual first, as for a player.
      if (data.buyToTrain[skill].quest && !done(data.buyToTrain[skill].quest)) return false;
      const plan = buyPlan(player, skill);
      // Its own stock (the logs it chopped, the ore it smelted) is enough; else coins to buy.
      return plan && (hasStock(player, plan) || coins >= plan.cost + 200);
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
      levelOf: (skill) => levelOf(player, skill),
      owns: (id) => Number.isInteger(id) && (player.getInventory().contains(id) || banked(player, id) > 0),
      worn: (id) => worn.has(id),
      priceOf: (id) => {
        const guide = Number(core.ItemDefinition?.forId?.(id)?.getGrandExchangeValue?.() ?? 0);
        return guide > 0 ? Math.ceil(guide * 1.05) : 0;
      },
      questDone: questDone(player),
      idOf: (name) => Shopping.idOf(core, name),
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
      goal = null;
    }
    if (!goal) {
      goal = Goals.pickGoal(helpers, random);
      if (goal) note(player, `Nieuw doel: ${Goals.describe(goal)}.`, "activity");
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
    if ((ranged.weapon ?? []).some((entry) => has(entry.item)) && (ranged.ammo ?? []).some((entry) => has(entry.item, 20))) styles.push("ranged");
    if (has("AIR_RUNE", 20) && has("MIND_RUNE", 10)) styles.push("magic");
    return styles;
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



  function runtimeEntry(player) {
    return runtime.entriesByUsername?.get?.(player.getUsername?.());
  }

  const BLOCKED_MS = 15 * 60_000;
  const placeKey = (to) => `${to.x},${to.y},${to.z ?? 0}`;
  function blockedPlace(entry, to) {
    return (entry?.blockedPlaces?.get(placeKey(to)) ?? 0) > now();
  }

  function placeName(to) {
    return String(to.name ?? to.id ?? `${to.x}, ${to.y}`).replace(/_/g, " ");
  }

  /**
   * Walks there (Errands.PlayerBots.js) and runs `arrive` on arrival. With `replan` the planner
   * looks again once it is there (after a sale or a purchase); without it the job it started
   * goes on (a walk to the trees is part of the stretch). False when it cannot go now.
   */
  function walkTo(entry, to, { reason, arrive = () => {}, replan = true, say = true, urgent = false } = {}) {
    const run = runtimeEntry(entry.player);
    // `urgent`: a full bag to bank goes even while other errands rest after a failed one.
    if (!run || errands.busy(entry.player) || (replan && !urgent && (entry.noErrandUntil ?? 0) > now())) return false;
    if (blockedPlace(entry, to)) return false;
    const started = errands.go(run, to, {
      reason,
      arrive: (player) => {
        entry.errand = null;
        try {
          arrive(player);
        } finally {
          if (replan) entry.until = 0;
        }
      },
      fail: (player) => {
        entry.errand = null;
        note(player, `Kwam niet bij ${placeName(to)}: de weg was versperd.`, "activity");
        // That place is out for a while; the next bank or shop is still fine.
        (entry.blockedPlaces ??= new Map()).set(placeKey(to), now() + BLOCKED_MS);
        if (replan) {
          if (!["bank", "exchange"].includes(reason)) entry.noErrandUntil = now() + 10 * 60_000;
          entry.until = 0;
        }
      },
    });
    if (!started) return false;
    // What the page shows while it walks.
    entry.errand = { to: placeName(to), reason, since: now() };
    if (replan) {
      entry.phase = "errand";
      entry.until = Infinity;
    }
    if (say) note(entry.player, `Loopt naar ${placeName(to)}.`, "activity");
    return true;
  }

  function startTraining(entry, plan, nowMs) {
    const { player } = entry;
    const view = snapshot(player);
    // Only a Slayer task narrows what it fights; any other job fights what it finds.
    const own = runtimeEntry(player);
    if (own?.state && plan.mode !== "slayer") own.state.onlyNames = null;
    if (plan.mode === "slayer") return startSlayer(entry, plan, nowMs);
    if (plan.mode.startsWith("buy_")) {
      return startBuyTraining(entry, plan, nowMs);
    }
    if (plan.mode === "combat_ranged" || plan.mode === "combat_magic") {
      const style = plan.mode === "combat_ranged" ? "ranged" : "magic";
      const run = runtimeEntry(player);
      if (run?.state) run.state.honestStyle = style;
      // Its bow and arrows, or runes, out of the bank if they are there.
      const supplies = style === "ranged" ? [...(Shopping.gear.styles.ranged.weapon ?? []), ...(Shopping.gear.styles.ranged.ammo ?? [])].map((entry) => entry.item)
        : ["AIR_RUNE", "MIND_RUNE", "WATER_RUNE", "EARTH_RUNE", "FIRE_RUNE", "CHAOS_RUNE", ...(Shopping.gear.styles.magic.weapon ?? []).map((entry) => entry.item)];
      for (const name of supplies) {
        const id = Shopping.idOf(core, name);
        if (Number.isInteger(id) && banked(player, id) > 0 && player.getInventory().getFreeSlots() > 2) withdraw(player, id, 10_000);
      }
      return startTraining(entry, { ...plan, mode: "combat_training", style }, nowMs);
    }
    if (plan.mode === "combat_training" && !plan.style) {
      const run = runtimeEntry(player);
      if (run?.state) run.state.honestStyle = "melee";
    }
    if (plan.mode === "agility") {
      const level = levelOf(player, "AGILITY");
      const course = (data.agilityCourses ?? []).find((entry) => level >= entry.level);
      if (!course || !registry?.byId?.get(`agility_${course.course}`)) return false;
      startActivity(player, `agility_${course.course}`, { home: course, nowMs });
      walkTo(entry, course, { reason: "agility", replan: false });
      entry.activity = `agility_${course.course}`;
      entry.phase = "training";
      entry.plan = plan;
      entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
      note(player, `Loopt rondjes op de ${course.name}.`);
      return true;
    }
    if (plan.mode === "wintertodt") {
      startActivity(player, "wintertodt", { home: WINTERTODT, nowMs });
      walkTo(entry, { ...WINTERTODT, name: "Wintertodt" }, { reason: "wintertodt", replan: false });
      entry.activity = "wintertodt";
    } else {
      const level = plan.mode === "combat_training" ? view.combat : view.levels[plan.skill] ?? 1;
      const id = bestActivity(plan.mode, level, definitions);
      // Fighting on an empty stomach is how adventurers die: food first, if it can buy some.
      if (plan.mode === "combat_training" && !carriesFood(player)) {
        const food = Shopping.foodToBuy(player, core, levelOf(player, "HITPOINTS"));
        if (food && Shopping.coinsOf(player) >= Shopping.estimatedPrice(core, food.itemId, food.amount)
            && shopFor(entry, food.itemId, food.name, food.amount)) return true;
      }
      // Fishing needs its net, rod or harpoon: bought first (a walk to the shop), or no fishing now.
      const tool = Shopping.missingTools(player, core, id)[0];
      if (tool) return shopFor(entry, tool.itemId, tool.name, tool.name === "FEATHER" || tool.name === "FISHING_BAIT" ? 200 : 1);
      const activity = id ? registry?.byId?.get(id) ?? null : null;
      if (!activity) return false;
      const place = travel(player, stateOf(player), activity, nowMs);
      const home = stateOf(player)?.home ?? null;
      startActivity(player, id, { home, nowMs });
      if (place && home) walkTo(entry, { ...home, name: place.id }, { reason: "training", replan: false });
      entry.activity = id;
    }
    entry.phase = "training";
    entry.plan = plan;
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
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
    const toolId = buy.recipe.tool ? Shopping.idOf(core, buy.recipe.tool) : null;
    if (Number.isInteger(toolId) && !Shopping.owns(player, toolId)) return shopFor(entry, toolId, buy.recipe.tool, 1);
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
        const missing = buy.materials.filter((id) => buyer.getInventory().getAmount(id) <= 0);
        if (missing.length === 0) return;
        if (!missing.every((id) => Trade.buyAtExchange(buyer, core, emit, id, buy.amount))) {
          note(buyer, `Kon niet op alles bieden (${missing.map(itemName).join(", ")}).`, "activity");
          return;
        }
        note(buyer, `Biedt op ${buy.amount} x ${missing.map(itemName).join(" en ")} (~${buy.cost.toLocaleString("nl-NL")} gp) om ${plan.skill.toLowerCase()} te trainen.`, "activity");
        entry.resume = plan;
        entry.waitingSince = now();
      },
    });
  }

  function startBoss(entry, plan, nowMs) {
    const { player } = entry;
    const { boss } = plan;
    if (!registry?.byId?.get(boss.id)) return false;
    startActivity(player, boss.id, { home: boss, nowMs });
    walkTo(entry, boss, { reason: "boss", replan: false });
    entry.phase = "boss";
    entry.plan = plan;
    entry.activity = boss.id;
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
    note(player, `Gaat ${boss.name} bevechten${entry.group ? " (samen)" : ""}.`, "boss");
    return true;
  }

  /**
   * A quest with a bot playthrough. None is built yet, so the planner never offers one
   * (snapshot().available is empty); when one is, it starts here.
   */
  function startQuest(entry, plan) {
    note(entry.player, `${plan.quest.name} heeft nog geen bot-playthrough; overgeslagen.`, "quest");
    return false;
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
    if (firemakers.length >= 2) {
      for (const member of firemakers) {
        member.group = true;
        startTraining(member, { kind: "train", mode: "wintertodt", skill: "FIREMAKING", reason: "Wintertodt samen" }, nowMs);
      }
      return true;
    }
    const view = snapshot(entry.player);
    const plan = chooseNext(view, questList(), { available: view.available, questChance: 0, random });
    if (plan.kind !== "train") return false;
    entry.group = true;
    if (!startTraining(entry, { ...plan, reason: `${plan.reason}, samen` }, nowMs)) return false;
    const home = stateOf(entry.player)?.home;
    for (const member of companions) {
      member.group = true;
      if (!startTraining(member, { ...plan, reason: `samen met ${entry.name}` }, nowMs) || !home || member.phase !== "training") continue;
      // The same spot as the one who asked: its job's home moves there, and it walks over.
      startActivity(member.player, member.activity, { home, nowMs });
      if (!walkTo(member, { ...home, name: `${entry.name}` }, { reason: "group", replan: false, say: false })) {
        const run = runtimeEntry(member.player);
        if (run?.state) run.state.home = home;
      }
    }
    return true;
  }

  function next(entry, nowMs) {
    if (errands.busy(entry.player)) return;
    // Waiting at the exchange for its materials: collect once they are in, then to work.
    if (entry.resume) {
      const waiting = Trade.finishedOffers(entry.player, emit) > 0;
      if (waiting) emit("ge:collect", { player: entry.player });
      const resume = entry.resume;
      const buy = buyPlan(entry.player, resume.skill);
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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const plan = chooseNext(view, questList(), {
        available: view.available, questChance: data.questChance, bosses: data.bosses, bossChance: attempt === 0 ? data.bossChance : 0, random,
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
    const known = acquired.get(entry.name) ?? new Set();
    for (const [id, amount] of now) {
      if (amount <= (before.get(id) ?? 0) || known.has(id)) continue;
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

  function tick() {
    const nowMs = now();
    for (const entry of adventurers.values()) {
      if (!entry.player?.isRegistered?.()) continue;
      watchGear(entry);
      joinClan(entry);
      if (entry.phase === "training" && entry.buying && entry.player.getInventory().getAmount(entry.buying) <= 0
          && !errands.busy(entry.player)) {
        entry.buying = null;
        entry.until = 0;
      }
      if (stuck(entry, nowMs)) {
        note(entry.player, `Kon bij ${String(entry.activity ?? "zijn klus").replace(/_/g, " ")} niets doen; kiest iets anders.`, "activity");
        entry.until = 0;
      }
      // A finished Slayer task ends the stretch: back to a master, or something else.
      if (entry.phase === "training" && entry.activity === "slayer_task" && !Slayer.currentTask(emit, entry.player)) {
        note(entry.player, "Slayer-taak klaar.", "skill");
        entry.until = 0;
      }
      // A full bag ends the stretch: off to sell (trade()), as a player banks or sells.
      if (nowMs >= entry.until || (entry.phase === "training" && entry.player.getInventory().getFreeSlots() === 0)) next(entry, nowMs);
      rememberTask(entry, nowMs);
    }
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
    note(player, "Een nieuw avontuur begint in Lumbridge, met alleen de spullen van Tutorial Island.");
  }

  function carriesFood(player) {
    const Food = require("../../items/Food.plugin");
    return (player.getInventory().getItems() ?? []).some((item) => item && Food.isFoodItem(item.getId()));
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
  function shopFor(entry, itemId, name, amount = 1) {
    const { player } = entry;
    const at = player.getLocation();
    const shop = Shopping.nearestShop(itemId, { x: at.getX(), y: at.getY() });
    if (!shop || shop.distance > (data.shopRadius ?? 80)) return false;
    const label = name.toLowerCase().replace(/_/g, " ");
    return walkTo(entry, { x: shop.keeper.x, y: shop.keeper.y, z: shop.keeper.z, name: shop.name }, {
      reason: "shop",
      arrive: (buyer) => {
        const coinsBefore = Shopping.coinsOf(buyer);
        const got = Shopping.buy(buyer, core, shop.shopId, itemId, amount);
        if (got <= 0) {
          note(buyer, `${shop.name} had geen ${label} voor hem.`, "activity");
          entry.noErrandUntil = now() + 10 * 60_000;
          return;
        }
        acquire(buyer, itemId);
        const paid = coinsBefore - Shopping.coinsOf(buyer);
        note(buyer, `Gekocht: ${got > 1 ? `${got} x ` : ""}${label} bij ${shop.name} (${paid.toLocaleString("nl-NL")} gp).`, "activity");
        Shopping.wear(buyer, core, itemId);
      },
    });
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
    const mates = Clans.matesOf(data, entry.name).map((name) => adventurers.get(name)).filter((mate) => mate?.player?.isRegistered?.());
    const given = Clans.gift(mates, itemId, wanted, {
      spare: (mate, id) => banked(mate.player, id) - Math.min(need(mate.player, id), data.clanReserve ?? 500),
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
      if (!wearable && each < (data.junkValue ?? 3) && !Trade.keepIds(player, core, { isFood }).has(id)) junk.push(id);
    }
    return { keep, sell, junk: [...new Set(junk)] };
  }

  /** Junk out of the bag, as a player drops it. */
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
    for (const bank of data.banks ?? []) {
      if (blockedPlace(entry, bank)) continue;
      const away = walkTiles({ x: at.getX(), y: at.getY() }, bank, player);
      if (!best || away < best.away) best = { ...bank, away };
    }
    return best;
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
      bank.add(new core.Item(itemId, held), false);
      inventory.deleteNumber?.(itemId, held);
      stored.push({ itemId, amount: held });
    }
    inventory.refreshItems?.();
    return stored;
  }

  /** Out of its bank, unnoted, as many as fit (up to `amount`). Returns how many. */
  function withdraw(player, itemId, amount) {
    const inventory = player.getInventory();
    let wanted = Math.min(amount, inventory.getFreeSlots());
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
      const master = Slayer.nearest(Slayer.MASTERS, (place) => walkTiles(here, place, player));
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
    const spot = Slayer.nearest(targets, (place) => walkTiles(here, place, player));
    if (!spot) {
      note(player, `Kan zijn Slayer-taak (${String(task.name).toLowerCase()}) hier nog niet doen; laat Slayer even liggen.`, "activity");
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
    entry.until = nowMs + randomBetween(data.trainMinutes, random) * 60_000;
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
  function withdrawToSell(player) {
    const keep = Trade.keepIds(player, core, { isFood });
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
    for (const want of list) {
      if (Trade.buyAtExchange(player, core, emit, want.itemId, 1)) bids.push(want.name.toLowerCase().replace(/_/g, " "));
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
      if (Trade.buyAtExchange(player, core, emit, id, amount)) bids.push(`${amount} x ${itemName(id)}`);
    };
    if (styles.includes("ranged") || (Shopping.gear.styles?.ranged?.weapon ?? []).some((entry) => Shopping.owns(player, Shopping.idOf(core, entry.item)))) {
      const level = levelOf(player, "RANGED");
      const arrow = (Shopping.gear.styles?.ranged?.ammo ?? []).find((entry) => level >= entry.level);
      if (arrow) top(arrow.item, 300);
    }
    if (styles.includes("magic")) {
      top("AIR_RUNE", 600);
      top("MIND_RUNE", 300);
    }
    if (bids.length > 0) note(player, `Koopt voorraad op de GE: ${bids.join(", ")}.`, "activity");
  }

  function atExchange(player) {
    const bag = sortBag(player);
    dropJunk(player, bag.junk);
    // The exchange has its bank: what it keeps for later goes in there, not up for sale.
    const stored = deposit(player, bag.keep);
    if (stored.length > 0) note(player, `Bewaart op de bank: ${stored.map((good) => itemName(good.itemId)).join(", ")}.`, "activity");
    const pulled = withdrawToSell(player);
    const goods = Trade.goodsToSell(player, core, Trade.keepIds(player, core, { isFood }), { isFood });
    const { collectedCoins, offered } = Trade.sellAtExchange(player, core, emit, goods);
    if (collectedCoins > 0) {
      note(player, `Haalt ${collectedCoins.toLocaleString("nl-NL")} gp op bij de Grand Exchange.`, "activity");
    }
    if (offered.length > 0) {
      const names = offered.slice(0, 4).map((good) => `${good.amount > 1 ? `${good.amount} x ` : ""}${itemName(good.itemId)}`);
      const total = offered.reduce((sum, good) => sum + good.value, 0);
      note(player, `Zet te koop op de GE${pulled ? " (ook uit de bank)" : ""}: ${names.join(", ")}${offered.length > 4 ? ` en ${offered.length - 4} meer` : ""} (~${total.toLocaleString("nl-NL")} gp).`, "activity");
    }
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
  function trade(entry) {
    const { player } = entry;
    const rules = { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) };
    for (const name of Trade.wearBest(player, core, rules)) {
      note(player, `Draagt nu ${name.toLowerCase().replace(/_/g, " ")} (gevonden).`, "activity");
    }
    // Junk goes at once, wherever it is.
    dropJunk(player, sortBag(player).junk);
    const keep = Trade.keepIds(player, core, { isFood });
    const goods = Trade.goodsToSell(player, core, keep, { isFood });
    // Everything the last job left in the bag, priced or not: logs from woodcutting do not go
    // fishing with it.
    const stock = Trade.goodsToSell(player, core, keep, { isFood, worthless: true });
    const worth = goods.reduce((sum, good) => sum + good.value, 0);
    const full = player.getInventory().getFreeSlots() <= (data.fullSlots ?? 4);
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
    const toExchange = geOpen && (fund || waiting || worth >= (data.sellValue ?? 5000) || !bank || distanceTo(player, ge) <= bank.away + 40);
    if (toExchange) return walkTo(entry, ge, { reason: "exchange", arrive: atExchange, urgent });
    if (!bank) return false;
    return walkTo(entry, { ...bank, name: bank.name ?? bank.id }, {
      reason: "bank",
      urgent,
      arrive: (banker) => {
        const stored = deposit(banker, Trade.goodsToSell(banker, core, Trade.keepIds(banker, core, { isFood }), { isFood, worthless: true }));
        if (stored.length > 0) note(banker, `Zet op de bank in ${bank.name ?? bank.id}: ${stored.slice(0, 5).map((good) => itemName(good.itemId)).join(", ")}${stored.length > 5 ? ` en ${stored.length - 5} meer` : ""}. Bruikbaars bewaart hij; de rest verkoopt hij later op de GE.`, "activity");
      },
    });
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
      levelOf: (skill) => levelOf(player, skill), questDone: questDone(player), modes: ["woodcutting", "mining"],
    });
    // One purchase per walk; the next is looked at when it is back.
    return list.some((want) => shopFor(entry, want.itemId, want.name));
  }

  function spawn() {
    const at = data.spawn;
    for (const name of Clans.namesOf(data)) {
      if (adventurers.has(name)) continue;
      const bot = runtime.spawnPvpBot(new core.Location(at.x, at.y, at.z ?? 0), {
        mode: "roaming", activity: "world", username: name, persistent: true,
      });
      if (!bot) continue;
      // Bots get a generated name shown above them; an adventurer goes by its own.
      bot.setDisplayName?.(name);
      bot.getUpdateFlag?.()?.flag?.(core.Flag?.APPEARANCE);
      adventurers.set(name, { name, player: bot, phase: "new", until: 0, plan: null, activity: null });
      // Honest: no conjured gear, tools, food or bait; it buys, finds or makes what it uses.
      const state = runtime.botStatesByName?.get?.(name);
      markHonest(bot);
      if (state) {
        state.honest = true;
        // Its own planner trades for it (trade()); the world bots' upkeep leaves it alone.
        state.adventurer = true;
      }
      if (Number(bot.getAttribute(GENERATION_ATTRIBUTE) ?? 0) < (data.generation ?? 1)) startOver(bot);
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
    const plan = Tasks.planOf(task, data.bosses ?? []);
    if (!plan) return false;
    const started = plan.kind === "boss" ? startBoss(entry, plan, nowMs) : startTraining(entry, plan, nowMs);
    if (!started) return false;
    // An errand first (food, a tool, its supplies from the bank): the job waits until it is back.
    if (entry.phase !== "training" && entry.phase !== "boss") {
      if ((task.tries = (task.tries ?? 0) + 1) < 3) entry.savedTask = task;
      return true;
    }
    // The same job, for what was left of it.
    entry.until = nowMs + Tasks.resumeMs(task);
    note(entry.player, `Pakt na de herstart zijn klus weer op: ${String(task.activity ?? plan.mode ?? "").replace(/_/g, " ")}.`, "activity");
    return true;
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
    bank: "om te banken", exchange: "om te verkopen en kopen", shop: "om te kopen", withdraw: "om spullen van de bank te halen",
    buy_materials: "om materialen te kopen", slayer: "voor een Slayer-taak", training: "om te trainen", station: "om te trainen",
  };

  /** What it is doing now, in words, for the page. */
  function doingText(entry) {
    if (entry.phase === "errand" && entry.errand) {
      const minutes = Math.floor((now() - entry.errand.since) / 60_000);
      return `Loopt naar ${entry.errand.to} ${ERRAND_REASONS[entry.errand.reason] ?? ""}${minutes > 0 ? ` (${minutes} min onderweg)` : ""}`.replace(/ +/g, " ").trim();
    }
    if (entry.phase === "waiting") return entry.resume ? "Wacht op zijn bod op de GE" : "Wacht even (geen bank bereikbaar)";
    if (entry.phase === "boss") return `Boss: ${entry.plan?.boss?.name}`;
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
        clan: Clans.clanOf(data, entry.name)?.name ?? null,
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

  return { adventurers, spawn, tick, onLevelUp, onDrops, onNpcDeath, report, next, startGroup, acquire };
}

/** Starts the adventurers on server start; serves /api/adventurers and the commands. */
const REPORT_CACHE_MS = 2000;

function startAdventurers({ api, runtime, world, registry }) {
  api.persistAttribute(LOG_ATTRIBUTE, []);
  api.persistAttribute(GENERATION_ATTRIBUTE, 0);
  api.persistAttribute(GOAL_ATTRIBUTE, null);
  api.persistAttribute(TASK_ATTRIBUTE, null);
  const manager = createAdventurers({ api, runtime, world, registry });
  api.onPlayerLevelUp(manager.onLevelUp);
  api.onCustomEvent("npc-drops:roll", manager.onDrops);
  api.onNpcDeath(manager.onNpcDeath);
  // Where an adventurer's things may come from (its audit, above).
  api.onCustomEvent("ge:offer-collected", ({ player, itemId }) => manager.acquire(player, itemId));
  api.onCustomEvent("skills:produced", ({ player, itemId }) => manager.acquire(player, itemId));
  api.onGroundItemPickup((event) => manager.acquire(event.player, event.groundItemId));
  // Every open page asks every 5 s; one report serves them all for 2 s.
  let cached = null;
  api.registerContentEndpoint("adventurers", () => {
    if (!cached || Date.now() - cached.updated > REPORT_CACHE_MS) {
      cached = { updated: Date.now(), adventurers: manager.report() };
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

module.exports = { createAdventurers, startAdventurers, unpackCoord, LOG_ATTRIBUTE, TASK_ATTRIBUTE };
