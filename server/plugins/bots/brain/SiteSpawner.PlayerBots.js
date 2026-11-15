"use strict";

const { Location } = require("../../../src/main/typescript/elvarg/game/model/Location");
const { attachBrain } = require("./AttachBrain.PlayerBots");
const { runPaced } = require("../runtime/SpawnPacing.PlayerBots");
const { botActivityAllowed } = require("../behaviours/spawn/PlayerFactory.PlayerBots");
const { Skill } = require("../../../src/main/typescript/elvarg/game/model/Skill");
const { SkillManager } = require("../../../src/main/typescript/elvarg/game/content/skill/SkillManager");
const { Flag } = require("../../../src/main/typescript/elvarg/game/model/Flag");
const { Item } = require("../../../src/main/typescript/elvarg/game/model/Item");
const { Equipment } = require("../../../src/main/typescript/elvarg/game/model/container/impl/Equipment");
const { assignIronMode } = require("./Ironmen.PlayerBots");
const { generateAccount } = require("./Accounts.PlayerBots");
/** BOT_GENERATED_ACCOUNTS=0: world bots are provisioned as before (gear, food and bait on demand). */
const GENERATED_ACCOUNTS = (process.env.BOT_GENERATED_ACCOUNTS ?? "1") !== "0";
const { ItemIdentifiers } = require("../../../src/main/typescript/elvarg/util/ItemIdentifiers");

/**
 * A site's `levels` sets every skill (a number) or named skills ({ "all": 40,
 * "mining": 60 }) on a freshly spawned bot, so tiers can be tested without
 * levelling up. A [min, max] pair rolls a level in the band per skill, so a
 * site's crowd is not one flat level. Hitpoints never go below 10. Agility is
 * always 99 so every shortcut on a bot's route is usable.
 */
function rollLevel(value) {
  if (Array.isArray(value) && value.length === 2) {
    const min = Number(value[0]);
    const max = Number(value[1]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return Math.round(min + Math.random() * (max - min));
    }
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : null;
}

const COMBAT_SKILLS = [Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE, Skill.HITPOINTS, Skill.RANGED, Skill.MAGIC, Skill.PRAYER];

/** SkillManager.getCombatLevel over [attack, strength, defence, hitpoints, ranged, magic, prayer]. */
function combatLevelOf([attack, strength, defence, hp, ranged, magic, prayer]) {
  return SkillManager.calculateCombatLevel([attack, defence, strength, hp, ranged, prayer, magic]);
}

/**
 * Combat stats (COMBAT_SKILLS order) whose combat level lands in [min, max]: aim at a
 * level in the band, find the even stat level that reaches it, then jitter each stat a
 * little so a crowd isn't uniform. Falls back to the even stats if jitter leaves the band.
 */
function rollCombatStats([min, max]) {
  const clamp = (level, floor = 1) => Math.max(floor, Math.min(99, level));
  const even = (level) => COMBAT_SKILLS.map((skill) => clamp(level, skill === Skill.HITPOINTS ? 10 : 1));
  const target = min + Math.floor(Math.random() * (max - min + 1));
  let base = 1;
  while (base < 99 && combatLevelOf(even(base)) < target) base++;
  for (let attempt = 0; attempt < 20; attempt++) {
    const stats = even(base).map((level, index) =>
      clamp(level + Math.floor(Math.random() * 9) - 4, COMBAT_SKILLS[index] === Skill.HITPOINTS ? 10 : 1));
    const combat = combatLevelOf(stats);
    if (combat >= min && combat <= max) return stats;
  }
  return even(base);
}

function applyLevels(bot, levels) {
  if (levels == null) return;
  const manager = bot.getSkillManager?.();
  if (!manager) return;
  // `combat: [min, max]` is a combat level band; the combat stats are rolled to land in it.
  const combat = Array.isArray(levels.combat) ? rollCombatStats(levels.combat) : null;
  for (const skill of Skill.values()) {
    const name = String(skill.getName?.() ?? skill.toString?.() ?? "").toLowerCase();
    const combatIndex = combat ? COMBAT_SKILLS.indexOf(skill) : -1;
    let level = skill === Skill.AGILITY
      ? 99
      : combatIndex >= 0
        ? combat[combatIndex]
        : rollLevel(typeof levels === "number" ? levels : levels[name] ?? levels.all);
    if (!Number.isFinite(level)) continue;
    level = Math.max(skill === Skill.HITPOINTS ? 10 : 1, Math.min(99, Math.floor(level)));
    manager.setCurrentLevel(skill, level, false).setMaxLevels(skill, level, false)
      .setExperience(skill, SkillManager.getExperienceForLevel(level));
  }
  bot.getUpdateFlag?.()?.flag?.(Flag.APPEARANCE);
}

/**
 * What a bot wears, per outfit tier. Like real players, a bot leaves slots empty: each slot is
 * worn with its SLOT_CHANCE (an empty body or legs shows the bot's own clothes, whose colours
 * are rolled at spawn). Capes come from one shared pool (the colours, all 50 team capes and the
 * cloaks that fit the tier), so two bots rarely match.
 */
const COLOUR_CAPES = ["RED_CAPE", "BLUE_CAPE", "GREEN_CAPE", "YELLOW_CAPE", "ORANGE_CAPE", "PURPLE_CAPE", "BLACK_CAPE"];
const TEAM_CAPES = ["TEAM_1_CAPE", "TEAM_2_CAPE", "TEAM_3_CAPE", "TEAM_4_CAPE", "TEAM_5_CAPE", "TEAM_6_CAPE", "TEAM_7_CAPE", "TEAM_8_CAPE", "TEAM_9_CAPE", "TEAM_10_CAPE", "TEAM_11_CAPE", "TEAM_12_CAPE", "TEAM_13_CAPE", "TEAM_14_CAPE", "TEAM_15_CAPE", "TEAM_16_CAPE", "TEAM_17_CAPE", "TEAM_18_CAPE", "TEAM_19_CAPE", "TEAM_20_CAPE", "TEAM_21_CAPE", "TEAM_22_CAPE", "TEAM_23_CAPE", "TEAM_24_CAPE", "TEAM_25_CAPE", "TEAM_26_CAPE", "TEAM_27_CAPE", "TEAM_28_CAPE", "TEAM_29_CAPE", "TEAM_30_CAPE", "TEAM_31_CAPE", "TEAM_32_CAPE", "TEAM_33_CAPE", "TEAM_34_CAPE", "TEAM_35_CAPE", "TEAM_36_CAPE", "TEAM_37_CAPE", "TEAM_38_CAPE", "TEAM_39_CAPE", "TEAM_40_CAPE", "TEAM_41_CAPE", "TEAM_42_CAPE", "TEAM_43_CAPE", "TEAM_44_CAPE", "TEAM_45_CAPE", "TEAM_46_CAPE", "TEAM_47_CAPE", "TEAM_48_CAPE", "TEAM_49_CAPE", "TEAM_50_CAPE"];
const FREMENNIK_CLOAKS = ["FREMENNIK_BLUE_CLOAK", "FREMENNIK_RED_CLOAK", "FREMENNIK_GREEN_CLOAK", "FREMENNIK_BROWN_CLOAK"];
const HATS = ["CHEFS_HAT", "RED_BERET", "BLACK_BERET", "BLUE_BERET", "WHITE_BERET", "BEANIE", "RED_HEADBAND",
  "BLACK_HEADBAND", "BROWN_HEADBAND", "GREEN_HAT", "BLUE_HAT"];
const BOATERS = ["RED_BOATER", "ORANGE_BOATER", "GREEN_BOATER", "BLUE_BOATER", "BLACK_BOATER"];
const CAVALIERS = ["TAN_CAVALIER", "DARK_CAVALIER", "BLACK_CAVALIER", "HIGHWAYMAN_MASK"];
const FREMENNIK_HELMS = ["HELM_OF_NEITIZNOT", "BERSERKER_HELM", "WARRIOR_HELM", "ARCHER_HELM", "FARSEER_HELM"];

const SKILLING_OUTFITS = {
  novice: {
    head: ["LEATHER_COWL", "BRONZE_MED_HELM", "IRON_MED_HELM", "WIZARD_HAT", "BLUE_WIZARD_HAT", ...HATS],
    cape: [...COLOUR_CAPES, ...TEAM_CAPES],
    amulet: ["AMULET_OF_STRENGTH", "AMULET_OF_DEFENCE", "AMULET_OF_MAGIC", "AMULET_OF_ACCURACY", "HOLY_SYMBOL"],
    body: ["LEATHER_BODY", "BRONZE_PLATEBODY", "IRON_PLATEBODY", "BLUE_WIZARD_ROBE", "HAM_SHIRT", "MONKS_ROBE_TOP", "DRUIDS_ROBE_TOP"],
    legs: ["LEATHER_CHAPS", "BRONZE_PLATELEGS", "IRON_PLATELEGS", "BLUE_SKIRT", "BLACK_SKIRT", "PINK_SKIRT", "HAM_ROBE", "MONKS_ROBE", "DRUIDS_ROBE"],
    hands: ["LEATHER_GLOVES"],
    feet: ["LEATHER_BOOTS", "BRONZE_BOOTS", "IRON_BOOTS"],
    ring: [],
  },
  mid: {
    head: ["STEEL_MED_HELM", "MITHRIL_MED_HELM", "WIZARD_HAT", "BLUE_WIZARD_HAT", ...HATS, ...BOATERS, ...CAVALIERS],
    cape: [...COLOUR_CAPES, ...TEAM_CAPES, "ARDOUGNE_CLOAK_1"],
    amulet: ["AMULET_OF_STRENGTH", "AMULET_OF_DEFENCE", "AMULET_OF_MAGIC", "AMULET_OF_POWER", "HOLY_SYMBOL"],
    body: ["STUDDED_BODY", "STEEL_PLATEBODY", "MITHRIL_PLATEBODY", "GREEN_DHIDE_BODY", "BLUE_WIZARD_ROBE", "HAM_SHIRT", "MONKS_ROBE_TOP"],
    legs: ["STUDDED_CHAPS", "STEEL_PLATELEGS", "MITHRIL_PLATELEGS", "GREEN_DHIDE_CHAPS", "BLUE_SKIRT", "BLACK_SKIRT", "PINK_SKIRT", "MONKS_ROBE"],
    hands: ["LEATHER_GLOVES", "STEEL_GLOVES", "MITHRIL_GLOVES"],
    feet: ["STEEL_BOOTS", "MITHRIL_BOOTS", "LEATHER_BOOTS", "CLIMBING_BOOTS"],
    ring: ["EXPLORERS_RING_1"],
  },
  advanced: {
    head: ["ADAMANT_MED_HELM", "MITHRIL_MED_HELM", "MYSTIC_HAT", "SPLITBARK_HELM", "SPINED_HELM", ...BOATERS, ...CAVALIERS],
    cape: [...COLOUR_CAPES, ...TEAM_CAPES, ...FREMENNIK_CLOAKS, "ARDOUGNE_CLOAK_2", "OBSIDIAN_CAPE"],
    amulet: ["AMULET_OF_GLORY", "AMULET_OF_STRENGTH", "AMULET_OF_MAGIC", "AMULET_OF_POWER"],
    body: ["ADAMANT_PLATEBODY", "BLUE_DHIDE_BODY", "RED_DHIDE_BODY", "MYSTIC_ROBE_TOP", "SPLITBARK_BODY"],
    legs: ["ADAMANT_PLATELEGS", "BLUE_DHIDE_CHAPS", "RED_DHIDE_CHAPS", "MYSTIC_ROBE_BOTTOM", "SPLITBARK_LEGS"],
    hands: ["ADAMANT_GLOVES", "MITHRIL_GLOVES"],
    feet: ["ADAMANT_BOOTS", "CLIMBING_BOOTS", "FIGHTING_BOOTS", "BOOTS_OF_LIGHTNESS", "SNAKESKIN_BOOTS"],
    ring: ["EXPLORERS_RING_1"],
  },
  elite: {
    head: ["RUNE_MED_HELM", "ADAMANT_MED_HELM", "MYSTIC_HAT", "SPLITBARK_HELM", ...FREMENNIK_HELMS, ...CAVALIERS],
    cape: [...COLOUR_CAPES, ...TEAM_CAPES, ...FREMENNIK_CLOAKS, "ARDOUGNE_CLOAK_3", "OBSIDIAN_CAPE", "CAPE_OF_LEGENDS"],
    amulet: ["AMULET_OF_GLORY", "AMULET_OF_POWER", "HOLY_SYMBOL"],
    body: ["RUNE_PLATEBODY", "BLACK_DHIDE_BODY", "MYSTIC_ROBE_TOP", "SPLITBARK_BODY"],
    legs: ["RUNE_PLATELEGS", "BLACK_DHIDE_CHAPS", "MYSTIC_ROBE_BOTTOM", "SPLITBARK_LEGS"],
    hands: ["RUNE_GLOVES", "ADAMANT_GLOVES"],
    feet: ["RUNE_BOOTS", "ADAMANT_BOOTS", "FIGHTING_BOOTS", "BOOTS_OF_LIGHTNESS", "SNAKESKIN_BOOTS"],
    ring: ["RING_OF_WEALTH", "EXPLORERS_RING_1"],
  },
  master: {
    head: [...FREMENNIK_HELMS, "RUNE_MED_HELM", "MYSTIC_HAT", ...CAVALIERS],
    cape: [...TEAM_CAPES, ...FREMENNIK_CLOAKS, "ARDOUGNE_CLOAK_4", "OBSIDIAN_CAPE", "CAPE_OF_LEGENDS", "BLACK_CAPE"],
    amulet: ["AMULET_OF_GLORY", "AMULET_OF_POWER"],
    body: ["RUNE_PLATEBODY", "BLACK_DHIDE_BODY", "MYSTIC_ROBE_TOP", "SPLITBARK_BODY"],
    legs: ["RUNE_PLATELEGS", "BLACK_DHIDE_CHAPS", "MYSTIC_ROBE_BOTTOM", "SPLITBARK_LEGS"],
    hands: ["RUNE_GLOVES"],
    feet: ["RUNE_BOOTS", "BOOTS_OF_LIGHTNESS", "SNAKESKIN_BOOTS", "CLIMBING_BOOTS"],
    ring: ["RING_OF_WEALTH", "EXPLORERS_RING_1"],
  },
};
// Maxed bots dress like masters, and most of them show off a max cape.
SKILLING_OUTFITS.maxed = SKILLING_OUTFITS.master;
Object.freeze(SKILLING_OUTFITS);
const MAX_CAPE_CHANCE = 0.75;

/** How often each slot is worn at all. */
const SLOT_CHANCE = Object.freeze({ head: 0.5, cape: 0.35, amulet: 0.5, body: 0.85, legs: 0.85, hands: 0.3, feet: 0.6, ring: 0.2 });

/** The skill outfits, worn (piece by piece) by some bots of a mode from the advanced tier up. */
const MODE_OUTFITS = Object.freeze({
  woodcutting: { head: "LUMBERJACK_HAT", body: "LUMBERJACK_TOP", legs: "LUMBERJACK_LEGS", feet: "LUMBERJACK_BOOTS" },
  mining: { head: "PROSPECTOR_HELMET", body: "PROSPECTOR_JACKET", legs: "PROSPECTOR_LEGS", feet: "PROSPECTOR_BOOTS" },
  fishing: { head: "ANGLER_HAT", body: "ANGLER_TOP", legs: "ANGLER_WADERS", feet: "ANGLER_BOOTS" },
});
const GRACEFUL = Object.freeze({ head: "GRACEFUL_HOOD", cape: "GRACEFUL_CAPE", body: "GRACEFUL_TOP", legs: "GRACEFUL_LEGS",
  hands: "GRACEFUL_GLOVES", feet: "GRACEFUL_BOOTS" });
const MODE_OUTFIT_CHANCE = Object.freeze({ novice: 0, mid: 0.1, advanced: 0.3, elite: 0.45, master: 0.6, maxed: 0.6 });
const GRACEFUL_CHANCE = Object.freeze({ novice: 0, mid: 0.05, advanced: 0.15, elite: 0.25, master: 0.35, maxed: 0.4 });
const PIECE_CHANCE = 0.75;
/** A 99 in the mode's skill shows: most such bots wear that skill's cape. */
const SKILL_CAPES = Object.freeze({ woodcutting: ["WOODCUTTING", "WOODCUTTING_CAPE"], mining: ["MINING", "MINING_CAPE"],
  fishing: ["FISHING", "FISHING_CAPE"] });
const SKILL_CAPE_CHANCE = 0.7;

/** The outfit tier a site's level band implies (its lowest levels pick the kit). */
function outfitTier(levels) {
  let lowest = null;
  if (typeof levels === "number") {
    lowest = levels;
  } else if (levels && Array.isArray(levels.all)) {
    lowest = Number(levels.all[0]);
  } else if (levels && typeof levels.all === "number") {
    lowest = levels.all;
  }
  if (!Number.isFinite(lowest)) return "novice";
  if (lowest < 20) return "novice";
  if (lowest < 40) return "mid";
  if (lowest < 60) return "advanced";
  if (lowest < 80) return "elite";
  if (lowest < 99) return "master";
  return "maxed";
}

/** The outfit slots in the order they are filled; the weapon slot stays free for the tool. */
const OUTFIT_SLOTS = Object.freeze({
  head: Equipment.HEAD_SLOT,
  cape: Equipment.CAPE_SLOT,
  amulet: Equipment.AMULET_SLOT,
  body: Equipment.BODY_SLOT,
  legs: Equipment.LEG_SLOT,
  hands: Equipment.HANDS_SLOT,
  feet: Equipment.FEET_SLOT,
  ring: Equipment.RING_SLOT,
});

/** The item names a bot wears: slot key -> ItemIdentifiers name (absent: the slot is empty). */
function rollOutfit(tier, { mode = null, skillLevel = 0, random = Math.random } = {}) {
  const pool = SKILLING_OUTFITS[tier] ?? SKILLING_OUTFITS.novice;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const outfit = {};
  for (const key of Object.keys(OUTFIT_SLOTS)) {
    const list = pool[key];
    if (Array.isArray(list) && list.length > 0 && random() < SLOT_CHANCE[key]) outfit[key] = pick(list);
  }
  const overlay = (pieces) => {
    for (const [key, name] of Object.entries(pieces)) if (random() < PIECE_CHANCE) outfit[key] = name;
  };
  if (random() < (GRACEFUL_CHANCE[tier] ?? 0)) overlay(GRACEFUL);
  if (MODE_OUTFITS[mode] && random() < (MODE_OUTFIT_CHANCE[tier] ?? 0)) overlay(MODE_OUTFITS[mode]);
  if (SKILL_CAPES[mode] && skillLevel >= 99 && random() < SKILL_CAPE_CHANCE) outfit.cape = SKILL_CAPES[mode][1];
  if (tier === "maxed" && random() < MAX_CAPE_CHANCE) outfit.cape = "MAX_CAPE";
  return outfit;
}

/** The bot's real level in a mode's skill (0 for modes without one). */
function modeSkillLevel(bot, mode) {
  const skill = SKILL_CAPES[mode] ? Skill[SKILL_CAPES[mode][0]] : null;
  return skill ? Number(bot.getSkillManager?.()?.getMaxLevel?.(skill) ?? 0) : 0;
}

/**
 * Dresses the bot for its tier (and mode: skill outfits, a skill cape at 99); empty rolls clear
 * their slot, so a re-dress after travelling leaves nothing stale. The weapon slot stays free.
 */
function applyOutfit(bot, tier, options = {}) {
  const equipment = bot.getEquipment?.();
  if (!equipment) return;
  const outfit = rollOutfit(tier, { ...options, skillLevel: options.skillLevel ?? modeSkillLevel(bot, options.mode) });
  for (const [key, slot] of Object.entries(OUTFIT_SLOTS)) {
    const id = outfit[key] ? ItemIdentifiers[outfit[key]] : null;
    equipment.set(slot, new Item(Number.isInteger(id) ? id : -1, 1));
  }
  equipment.refreshItems();
  bot.getUpdateFlag?.()?.flag?.(Flag.APPEARANCE);
}

const WEAR_SLOTS = Object.freeze({ ...OUTFIT_SLOTS, weapon: Equipment.WEAPON_SLOT, shield: Equipment.SHIELD_SLOT });

/**
 * Puts on a set outfit (a minigame's: Pyromancer at Wintertodt, Raiments of the Eye at the
 * Guardians of the Rift): slot key -> ItemIdentifiers name. Slots it leaves out stay as they are.
 */
function wearItems(bot, items = {}) {
  const equipment = bot?.getEquipment?.();
  if (!equipment) return;
  for (const [key, name] of Object.entries(items)) {
    const slot = WEAR_SLOTS[key];
    const id = name ? ItemIdentifiers[name] : null;
    if (slot === undefined || (name && !Number.isInteger(id))) continue;
    equipment.set(slot, new Item(Number.isInteger(id) ? id : -1, 1));
  }
  equipment.refreshItems();
  bot.getUpdateFlag?.()?.flag?.(Flag.APPEARANCE);
}

/** Re-dresses a skilling bot for a new mode (after travelling), by its level in that skill. */
function dressForMode(bot, mode) {
  if (!SKILL_CAPES[mode]) return;
  applyOutfit(bot, outfitTier(modeSkillLevel(bot, mode)), { mode });
}

const SPAWN_ATTEMPTS = 16;

/**
 * Spawns the skilling sites in bot-sites.json as brain-driven bots. Only sites with
 * "enabled": true spawn (temporary until /host controls them).
 */
function startBotSites(options = {}) {
  // The sites are part of the world's population ("PlayerBots:allowedActivities").
  if (!botActivityAllowed("world")) return null;
  const { api, botApi, runtime, registry, world, resetMovementState } = options;
  if (!runtime || !registry || !Array.isArray(registry.sites) || registry.sites.length === 0) {
    return null;
  }
  const RegionManager = api?.getRegionManager?.() ?? null;

  function spawn(site, index) {
    const anchor = site.anchor ?? null;
    // Start on a random site activity that still has a capacity slot.
    const open = site.activities.filter((activity) => registry.hasRoom(activity.id));
    const activity = open[Math.floor(Math.random() * open.length)];
    if (!anchor || !activity) {
      return false;
    }
    RegionManager?.loadMapFiles?.(anchor.x, anchor.y);
    const radius = Math.max(0, Math.min(24, Number(site.spawnRadius ?? 6)));
    let location = null;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS && !location; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.floor(Math.random() * Math.max(1, radius));
      const candidate = new Location(
        anchor.x + Math.round(Math.cos(angle) * distance),
        anchor.y + Math.round(Math.sin(angle) * distance),
        anchor.z ?? 0
      );
      if (!RegionManager || !RegionManager.blocked(candidate, null)) {
        location = candidate;
      }
    }
    if (!location) {
      location = new Location(anchor.x, anchor.y, anchor.z ?? 0);
    }

    const bot = runtime.spawnPvpBot(location, { mode: activity.mode, activity: "world" });
    if (!bot) {
      return false;
    }
    applyLevels(bot, site.levels);
    // Some are Ironmen, Ultimates or Hardcores (Ironmen.PlayerBots.js).
    assignIronMode(bot);
    applyOutfit(bot, site.outfit ?? outfitTier(site.levels), { mode: activity.mode });
    const attached = attachBrain({
      runtime,
      registry,
      world,
      bot,
      activity,
      rotation: site.rotation,
      home: anchor,
      resetMovementState,
    });
    // Not every bot starts its job at the site: most set off for a place where it is done, so a
    // site's twenty miners do not all go to the nearest mine.
    const state = runtime.botStatesByName?.get?.(bot.getUsername?.());
    // An account of its own, as if it had played before; honest from here on (Accounts.PlayerBots.js).
    if (attached && world.core && GENERATED_ACCOUNTS) {
      generateAccount(bot, state, { core: world.core, mode: activity.mode, equipCombatGear: world.equipCombatGear });
    }
    if (attached) world.travel?.(bot, state, activity, Date.now());
    return attached;
  }

  function start() {
    // Round-robin over the sites so they all fill in together, paced a few per tick.
    const sites = registry.sites
      .filter((site) => site.enabled)
      .map((site) => ({ site, requested: Math.max(0, Math.floor(Number(site.count ?? 0))), spawned: 0 }));
    const jobs = [];
    for (let index = 0; sites.some((entry) => index < entry.requested); index++) {
      for (const entry of sites) {
        if (index < entry.requested) {
          jobs.push(() => {
            if (spawn(entry.site, index)) entry.spawned++;
          });
        }
      }
    }
    runPaced(jobs, () => {
      for (const { site, requested, spawned } of sites) {
        botApi?.log?.("bot_site_spawned", {
          site: site.id,
          activities: site.activities.map((activity) => activity.id),
          requested,
          spawned,
        });
      }
      const spawned = sites.reduce((sum, entry) => sum + entry.spawned, 0);
      if (spawned > 0) {
        botApi?.log?.("bot_sites_started", { spawned });
      }
    });
  }

  if (typeof api?.onServerStartup === "function") {
    api.onServerStartup(() => setTimeout(start, 1000));
  }
  return { start };
}

module.exports = {
  wearItems,
  WEAR_SLOTS,
  applyLevels,
  applyOutfit,
  dressForMode,
  rollOutfit,
  combatLevelOf,
  outfitTier,
  startBotSites,
};
