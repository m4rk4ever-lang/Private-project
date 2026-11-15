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
const { createTravel } = require("../brain/Travel.PlayerBots");
const { startActivity } = require("../brain/BrainActivities.PlayerBots");
const travelData = require("../data/travel-destinations.json");

const LOG_ATTRIBUTE = "adventurers:journal";
/** Which start an adventurer belongs to; a lower one than data.generation starts it over. */
const GENERATION_ATTRIBUTE = "adventurers:generation";
const Shopping = require("./Shopping.PlayerBots");
const Trade = require("./Trade.PlayerBots");
/** A companion joins a group if its own stretch ends within this. */
const GROUP_JOIN_WINDOW_MS = 4 * 60_000;
const GROUP_MAX = 5;
const Value = require("../../interface/ValueWarning");
const COINS = 995;
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
      // Only quests a bot can really play (none yet): nothing is simulated.
      available: new Set(questList().filter((quest) => quest.playthrough === true && registered.has(normalize(quest.name)))
        .map((quest) => quest.name)),
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
      // Fighting on an empty stomach is how adventurers die: food first, if it can buy some.
      if (plan.mode === "combat_training" && !carriesFood(player)) {
        const food = Shopping.foodToBuy(player, core, levelOf(player, "HITPOINTS"));
        if (food && Shopping.coinsOf(player) >= Shopping.estimatedPrice(core, food.itemId, food.amount)) {
          shopFor(player, food.itemId, food.name, food.amount);
        }
      }
      // Fishing needs its net, rod or harpoon: bought first, or no fishing this time.
      for (const tool of Shopping.missingTools(player, core, id)) {
        if (!shopFor(player, tool.itemId, tool.name, tool.name === "FEATHER" || tool.name === "FISHING_BAIT" ? 200 : 1)) return false;
      }
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

  function startBoss(entry, plan, nowMs) {
    const { player } = entry;
    const { boss } = plan;
    if (!registry?.byId?.get(boss.id)) return false;
    teleport(player, boss);
    world.equipCombatGear?.(player, stateOf(player));
    startActivity(player, boss.id, { home: boss, nowMs });
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
      if (!startTraining(member, { ...plan, reason: `samen met ${entry.name}` }, nowMs) || !home) continue;
      // The same spot as the one who asked.
      teleport(member.player, home);
      startActivity(member.player, member.activity, { home, nowMs });
    }
    return true;
  }

  function next(entry, nowMs) {
    trade(entry);
    upgrade(entry.player);
    entry.group = false;
    if (random() < (data.groupChance ?? 0.3) && startGroup(entry, nowMs)) return;
    const view = snapshot(entry.player);
    const plan = chooseNext(view, questList(), {
      available: view.available, questChance: data.questChance, bosses: data.bosses, bossChance: data.bossChance, random,
    });
    const started = plan.kind === "quest" ? startQuest(entry, plan)
      : plan.kind === "boss" ? startBoss(entry, plan, nowMs)
      : startTraining(entry, plan, nowMs);
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
      // A full bag ends the stretch: off to sell (trade()), as a player banks or sells.
      if (nowMs >= entry.until || (entry.phase !== "new" && entry.player.getInventory().getFreeSlots() === 0)) next(entry, nowMs);
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
    for (const quest of QuestRuntime.getRegisteredQuests()) {
      if (quest.getStage(player) !== 0) quest.setStage(player, 0);
    }
    player.setAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE, 0);
    player.setAttribute(LOG_ATTRIBUTE, []);
    // What every new account gets on Tutorial Island.
    for (const [name, amount] of Shopping.gear.starterKit) {
      const id = Shopping.idOf(core, name);
      if (Number.isInteger(id)) player.getInventory().add(new core.Item(id, amount));
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

  /** Goes to the shop's keeper and buys, through the shop itself. True when it got the item. */
  function shopFor(player, itemId, name, amount = 1) {
    const at = player.getLocation();
    const shop = Shopping.nearestShop(itemId, { x: at.getX(), y: at.getY() });
    if (!shop) return false;
    teleport(player, { x: shop.keeper.x + 1, y: shop.keeper.y, z: shop.keeper.z });
    const coinsBefore = Shopping.coinsOf(player);
    const got = Shopping.buy(player, core, shop.shopId, itemId, amount);
    if (got <= 0) return false;
    const paid = coinsBefore - Shopping.coinsOf(player);
    note(player, `Gekocht: ${got > 1 ? `${got} x ` : ""}${name.toLowerCase().replace(/_/g, " ")} bij ${shop.name} (${paid.toLocaleString("nl-NL")} gp).`, "activity");
    return true;
  }

  function isFood(itemId) {
    return require("../../items/Food.plugin").isFoodItem(itemId);
  }

  /**
   * Its income: found gear it may wear goes on, the rest of its loot and produce is sold at the
   * Grand Exchange, and coins from earlier sales are collected. Between every two stretches,
   * so it starts each job with an empty bag, unless what it has is worth less than data.keepValue.
   */
  function trade(entry) {
    const { player } = entry;
    const rules = { levelOf: (skill) => levelOf(player, skill), questDone: questDone(player) };
    for (const name of Trade.wearBest(player, core, rules)) {
      note(player, `Draagt nu ${name.toLowerCase().replace(/_/g, " ")} (gevonden).`, "activity");
    }
    const goods = Trade.goodsToSell(player, core, Trade.keepIds(player, core, { isFood }));
    const worth = goods.reduce((sum, good) => sum + good.value, 0);
    const full = player.getInventory().getFreeSlots() <= (data.fullSlots ?? 4);
    const waiting = Trade.finishedOffers(player, emit) > 0;
    // Between stretches its bag is emptied of the last job's things, as a player banks or sells
    // before the next job: only small change (under data.keepValue) stays.
    if (!waiting && worth < (data.keepValue ?? 200) && !(full && goods.length > 0)) return;
    teleport(player, data.grandExchange);
    const { collectedCoins, offered } = Trade.sellAtExchange(player, core, emit, goods);
    if (collectedCoins > 0) {
      note(player, `Haalt ${collectedCoins.toLocaleString("nl-NL")} gp op bij de Grand Exchange.`, "activity");
    }
    if (offered.length > 0) {
      const names = offered.slice(0, 4).map((good) => `${good.amount > 1 ? `${good.amount} x ` : ""}${itemName(good.itemId)}`);
      const total = offered.reduce((sum, good) => sum + good.value, 0);
      note(player, `Zet te koop op de GE: ${names.join(", ")}${offered.length > 4 ? ` en ${offered.length - 4} meer` : ""} (~${total.toLocaleString("nl-NL")} gp).`, "activity");
    }
  }

  function itemName(itemId) {
    return String(core.ItemDefinition?.forId?.(itemId)?.getName?.() ?? itemId).toLowerCase();
  }

  /** Better gear and tools it can afford now, bought and worn before its next stretch. */
  function upgrade(player) {
    const list = Shopping.shoppingList(player, core, {
      levelOf: (skill) => levelOf(player, skill), questDone: questDone(player), modes: ["woodcutting", "mining"],
    });
    for (const want of list) {
      if (shopFor(player, want.itemId, want.name)) Shopping.wear(player, core, want.itemId);
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
      // Bots get a generated name shown above them; an adventurer goes by its own.
      bot.setDisplayName?.(name);
      bot.getUpdateFlag?.()?.flag?.(core.Flag?.APPEARANCE);
      adventurers.set(name, { name, player: bot, phase: "new", until: 0, plan: null, activity: null });
      // Honest: no conjured gear, tools, food or bait; it buys, finds or makes what it uses.
      const state = runtime.botStatesByName?.get?.(name);
      if (state) {
        state.honest = true;
        // Its own planner trades for it (trade()); the world bots' upkeep leaves it alone.
        state.adventurer = true;
      }
      if (Number(bot.getAttribute(GENERATION_ATTRIBUTE) ?? 0) < (data.generation ?? 1)) startOver(bot);
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
        online,
        combat: online ? player.getSkillManager().getCombatLevel() : null,
        total: online ? player.getSkillManager().getTotalLevel() : null,
        questPoints: view?.questPoints ?? 0,
        quests: view ? [...view.done] : [],
        questsTotal: questList().length,
        skills,
        doing: entry.phase === "boss" ? `Boss: ${entry.plan?.boss?.name}`
          : entry.plan ? `Training: ${String(entry.activity).replace(/_/g, " ")} (${entry.plan.reason})` : "Begint",
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

  return { adventurers, spawn, tick, onLevelUp, onDrops, onNpcDeath, report, next, startGroup };
}

/** Starts the adventurers on server start; serves /api/adventurers and the commands. */
const REPORT_CACHE_MS = 2000;

function startAdventurers({ api, runtime, world, registry }) {
  api.persistAttribute(LOG_ATTRIBUTE, []);
  api.persistAttribute(GENERATION_ATTRIBUTE, 0);
  const manager = createAdventurers({ api, runtime, world, registry });
  api.onPlayerLevelUp(manager.onLevelUp);
  api.onCustomEvent("npc-drops:roll", manager.onDrops);
  api.onNpcDeath(manager.onNpcDeath);
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
