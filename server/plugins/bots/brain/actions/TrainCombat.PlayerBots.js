"use strict";

const { isHonest } = require("../Honest.PlayerBots");

const { playerState } = require("../ActionState.PlayerBots");
const { nearestClusters, npcClustersFor } = require("../NpcClusterIndex.PlayerBots");
const { canReachSpot } = require("../../behaviours/navigation/LongRoutes.PlayerBots");
const Loot = require("../Loot.PlayerBots");
const HouseParty = require("../HouseParty.PlayerBots");
const isFood = (itemId) => require("../../../items/Food.plugin").isFoodItem(itemId);

/** The strike or bolt spell it can cast now with the runes it carries, best first. */
const HONEST_SPELLS = ["FIRE_BOLT", "WIND_BOLT", "FIRE_STRIKE", "EARTH_STRIKE", "WATER_STRIKE", "WIND_STRIKE"];
function castableSpell(player, core) {
  const magic = player.getSkillManager().getCurrentLevel(core.Skill.MAGIC);
  for (const key of HONEST_SPELLS) {
    const spell = core.CombatSpells?.[key];
    if (!spell || magic < (spell.levelRequired?.() ?? 99)) continue;
    const runes = spell.itemsRequired?.(player) ?? [];
    if (runes.every((rune) => player.getInventory().getAmount(rune.getId()) >= rune.getAmount() * 5)) return spell;
  }
  return null;
}

/** Whether it has arrows to shoot: in its ammunition slot, or in its bag to put on. */
function wornAmmo(player, core) {
  const slot = core.Equipment?.AMMUNITION_SLOT;
  const worn = Number.isInteger(slot) ? player.getEquipment?.()?.getItems?.()?.[slot] : null;
  if (worn && worn.getId?.() > 0 && worn.getAmount?.() > 0) return true;
  return (player.getInventory?.()?.getItems?.() ?? []).some((item) => item && item.getId?.() > 0
    && core.ItemDefinition?.forId?.(item.getId())?.getEquipmentType?.()?.getSlot?.() === slot);
}

/** An honest bot puts on the best fighting gear it carries (Trade.wearBest's lists and rules). */
function wearOwnGear(player, core, style = "melee") {
  const Trade = require("../../adventurers/Trade.PlayerBots");
  const QuestRuntime = require("../../../quests/QuestRuntime");
  const levelOf = (name) => (core.Skill[name] ? player.getSkillManager().getMaxLevel(core.Skill[name]) : 1);
  const norm = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
  const questDone = (name) => QuestRuntime.getRegisteredQuests().find((quest) => norm(quest.name) === norm(name))?.isComplete(player) === true;
  Trade.wearBest(player, core, { levelOf, questDone }, style);
  if (style === "magic") core.Autocasting?.setAutocast(player, castableSpell(player, core));
}
const Value = require("../../../interface/ValueWarning");
const { requestMovement, clearMovementRequest, peekMovementRequest, randomInRange } =
  require("../../behaviours/navigation/Navigation.PlayerBots");

const TARGET_RETRY_MS = 1800;
/** An honest bot buries a bone this often between fights (a Bury click's delay is 1.2 s). */
const BURY_EVERY_MS = 1800;
const TARGET_SPREAD = 4;
// ...of those, only ones at most this much further than the nearest.
const TARGET_SPREAD_TILES = 3;
const ATTACK_DISTANCE = 20;
const RESERVATION_MS = 10000;
const TARGET_STALL_MS = 45000;
const SITE_STALL_MS = 120000;
// Targets must be this close (Chebyshev) to the chosen cluster's centre.
const SITE_RADIUS = 24;
// Within this of the centre a trainer stops walking and waits for targets there.
const SITE_ARRIVE = 8;
// A cluster this bot could not reach or train at is skipped for this long.
const SITE_AVOID_MS = 10 * 60 * 1000;
// Settled at a cluster with nothing it can attack (caged jail NPCs, all claimed):
// move on after this long instead of idling out SITE_STALL_MS.
const EMPTY_SITE_MS = 45000;
// A pending movement request with no tile change this long is a dead dispatch
// (blocked route); drop the target/site and let the next tick re-route.
const MOVEMENT_STALL_MS = 8000;
// ...and at least this many brain ticks without moving: far-from-players bots tick
// every ~7-18 s (LOD + task budget), so time alone would call every fresh walk frozen
// before its dispatch had a chance to move the bot.
const MOVEMENT_STALL_TICKS = 3;
// A combat target that lands no hit this long is being blocked (fence/gate):
// fall back to a walked brain route so doors get opened.
const ATTACK_STUCK_MS = 6000;
// Walking at monsters behind a fence this long without getting in: they are given up on.
const APPROACH_GIVE_UP_MS = 30_000;
const RANGED_AMMO_AMOUNT = 1000;
const MAGIC_RUNE_AMOUNT = 3000;
// Shared across action instances: two trainers must not claim the same idle NPC.
const CLAIMS = new WeakMap();
// Shared across action instances: cluster key -> trainers there, so trainers fill
// the nearest NPC clusters up to capacity and fan out from there.
const SITE_OCCUPANTS = new Map();

function occupants(siteId) {
  let players = SITE_OCCUPANTS.get(siteId);
  if (!players) SITE_OCCUPANTS.set(siteId, (players = new Set()));
  for (const player of players) if (player.isRegistered?.() === false) players.delete(player);
  return players;
}

/** Stable per-bot seed so each trainer keeps its random low-gear outfit. */
/**
 * A stable, well-mixed hash of a string: FNV-1a, then the murmur3 finaliser. Each bot keeps its
 * own gear (the hash of its username and the slot), and bots with near-identical usernames
 * (PlayerBot5, PlayerBot41) or the same bot's different slots no longer pick in lockstep, as
 * the low bits of a plain `hash * 31` did.
 */
function hashSeed(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function createTrainCombatAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] trainCombat requires api.core");
  const { Skill, Equipment, Item, ItemIdentifiers, Flag, FightStyle,
    WeaponInterfaceManager, CombatFactory, CanAttackResponse,
    RsmodRouteFinding } = core;
  const skills = [Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE];
  const styles = [FightStyle.ACCURATE, FightStyle.AGGRESSIVE, FightStyle.DEFENSIVE];
  const skillByIndex = new Map(Skill.values().map((skill) => [skill.getIndex(), skill]));
  const stages = [...(spec.stages ?? [])].sort((a, b) => a.minLevel - b.minLevel);
  if (!stages.length || stages[0].minLevel !== 1 || stages.some((stage) => !stage.id ||
      !(stage.npcLevels?.min >= 1) || !(stage.npcLevels.max >= stage.npcLevels.min))) {
    throw new Error("[bot activities] trainCombat requires stages starting at level 1 with npcLevels { min, max }");
  }
  // Opponents are attackable NPCs in the stage's combat-level band; excludeNames drops
  // ones that cannot be fought where they stand (ducks on water).
  const excludedNames = new Set((spec.excludeNames ?? []).map((name) => String(name).toLowerCase()));
  // `onlyNames`: fight these and nothing else (a boss: the Giant Mole, Sarachnis).
  const onlyNames = new Set((spec.onlyNames ?? []).map((name) => String(name).toLowerCase()));
  const opponentLevel = (definition) => {
    const level = definition?.getCombatLevel?.() ?? 0;
    const name = String(definition?.getName?.() ?? "").toLowerCase();
    if (onlyNames.size > 0 && !onlyNames.has(name)) return null;
    return definition?.isAttackable?.() === true && level > 0 && !excludedNames.has(name) ? level : null;
  };
  // A bot's own target list (state.onlyNames: a Slayer task's monsters) narrows it further,
  // per bot; its clusters are indexed apart, keyed by those names.
  const ownLevels = new Map();
  const targetsFor = (state) => {
    const names = state?.onlyNames;
    if (!Array.isArray(names) || names.length === 0) return { key: "", level: opponentLevel };
    const key = names.map((name) => String(name).toLowerCase()).sort().join("|");
    let level = ownLevels.get(key);
    if (!level) {
      const own = new Set(key.split("|"));
      level = (definition) => (own.has(String(definition?.getName?.() ?? "").toLowerCase())
        && definition?.isAttackable?.() === true && (definition?.getCombatLevel?.() ?? 0) > 0
        ? definition.getCombatLevel() : null);
      if (ownLevels.size > 64) ownLevels.clear();
      ownLevels.set(key, level);
    }
    return { key, level };
  };
  const levelKeys = (stage) => Array.from(
    { length: stage.npcLevels.max - stage.npcLevels.min + 1 }, (_, index) => stage.npcLevels.min + index);
  // Tiles of extra walking worth one more trainer per NPC at a cluster: lower keeps
  // trainers close and crowded, higher spreads them further out.
  const spreadDistance = Math.max(1, Number(spec.spreadDistance ?? 150));
  const routeExists = world.routes?.canReachSpot ?? canReachSpot;
  const resolveItem = (key) => {
    const id = ItemIdentifiers[key];
    if (!Number.isInteger(id)) throw new Error(`[bot activities] unknown training item '${key}'`);
    return id;
  };
  const buildTiers = (tiers) => (tiers ?? []).map((tier) => ({
    minLevel: tier.minLevel,
    weapons: (tier.weapons ?? []).map(resolveItem),
    ammo: (tier.ammo ?? []).map(resolveItem),
    spells: (tier.spells ?? []).map((key) => {
      const spell = core.CombatSpells?.[key];
      if (!spell) throw new Error(`[bot activities] unknown training spell '${key}'`);
      return spell;
    }),
    armour: Object.entries(tier.armour ?? {}).map(([slot, keys]) => {
      if (!Number.isInteger(Equipment[slot])) throw new Error(`[bot activities] unknown equipment slot '${slot}'`);
      return [Equipment[slot], (Array.isArray(keys) ? keys : [keys])
        .map((key) => (key === null ? null : resolveItem(key)))];
    }),
  })).sort((a, b) => a.minLevel - b.minLevel);
  const meleeTiers = buildTiers(spec.gearTiers);
  const rangedTiers = buildTiers(spec.rangedTiers);
  const magicTiers = buildTiers(spec.magicTiers);
  const combatStyles = (spec.styles ?? ["melee"]).filter((style) =>
    style === "ranged" ? rangedTiers.length > 0
      : style === "magic" ? magicTiers.length > 0
        : meleeTiers.length > 0);
  // This many targets (or frozen routes) in a row without landing damage fails the
  // site; crowded sites lose targets to other trainers, so keep it generous.
  const maxFailedTargets = Math.max(1, Math.floor(Number(spec.maxFailedTargets ?? 6)));
  const foodId = resolveItem(spec.food ?? "TROUT");
  // A stage may bring its own food (sharks for high-level monsters); the spec's is the default.
  const stageFoodIds = new Map(stages.filter((stage) => stage.food).map((stage) => [stage.id, resolveItem(stage.food)]));
  const allFoodIds = [...new Set([foodId, ...stageFoodIds.values()])];
  const foodAmount = Math.max(1, Math.min(28, Number(spec.foodAmount ?? 16)));
  const minSeconds = Math.max(1, Number(spec.durationSeconds?.min ?? 300));
  const maxSeconds = Math.max(minSeconds, Number(spec.durationSeconds?.max ?? 720));
  const stateFor = (player) => playerState(action, player, () => ({
    target: null, site: null, stageId: null, previousSiteId: null,
    endsAt: 0, retryAt: 0, lastProgressAt: 0, position: null, targetHp: null,
    claimedAt: 0, failedTargets: 0, progressFlag: false, avoided: new WeakMap(), avoidedSites: new Map(),
  }));
  const styleFor = (player, state) => {
    if (state.honestStyle) return state.honestStyle;
    if (!state.combatStyle) {
      const index = combatStyles.length
        ? hashSeed(`${player.getUsername?.() ?? "bot"}:style`) % combatStyles.length
        : 0;
      state.combatStyle = combatStyles[index] ?? "melee";
    }
    return state.combatStyle;
  };
  const tiersFor = (style) =>
    style === "ranged" ? rangedTiers : style === "magic" ? magicTiers : meleeTiers;
  const offenseSkillFor = (style) =>
    style === "ranged" ? Skill.RANGED : style === "magic" ? Skill.MAGIC : Skill.ATTACK;
  const levelFor = (player, state) => {
    const style = styleFor(player, state);
    if (style === "ranged") return player.getSkillManager().getMaxLevel(Skill.RANGED);
    if (style === "magic") return player.getSkillManager().getMaxLevel(Skill.MAGIC);
    return Math.min(...skills.map((skill) => player.getSkillManager().getMaxLevel(skill)));
  };
  // An honest bot (an adventurer) also fights the stage below its own (combat 37: barbarians of
  // 10-17 beside the 20-45 band), as a player does: its own planner may send it to a place
  // whose monsters are a little under its band, and it must not stand there with nothing to hit.
  const widened = new Map();
  const stageFor = (player, state) => {
    const own = stages.filter((stage) => levelFor(player, state) >= stage.minLevel);
    const stage = own[own.length - 1];
    if (!stage || !(state?.honest || isHonest(player)) || own.length < 2) return stage;
    // Not too far below its own level, though: at least 45% of it (a combat 70 does not fight
    // level-26 jail guards; a combat 37 still fights barbarians of 17).
    const below = own[own.length - 2];
    const floor = Math.max(below.npcLevels.min, Math.floor(levelFor(player, state) * 0.45));
    const min = Math.min(stage.npcLevels.min, floor);
    const key = `${stage.id}:${min}`;
    if (!widened.has(key)) widened.set(key, { ...stage, npcLevels: { min, max: stage.npcLevels.max } });
    return widened.get(key);
  };
  const routeFinder = new RsmodRouteFinding();
  // Wall-aware reach (entity strategy, no moveNear): a tile touching the NPC across
  // a fence or closed gate does not count. Unreachable NPCs are walked towards
  // instead, which lets the brain open the gate.
  const reachable = (player, npc) => {
    const from = player.getLocation();
    const to = npc.getLocation();
    if (from.getZ() !== to.getZ()) return false;
    const size = Math.max(1, Math.floor(npc.getSize?.() ?? 1));
    const route = routeFinder.findRoute({
      level: from.getZ(), srcX: from.getX(), srcY: from.getY(),
      srcSize: Math.max(1, Math.floor(player.getSize?.() ?? 1)),
      destX: to.getX(), destY: to.getY(),
      destWidth: size, destLength: size, locAngle: 0, locShape: -2,
      moveNear: false, blockAccessFlags: 0, maxWaypoints: 25,
      privateArea: player.getPrivateArea?.() ?? null,
    });
    return route.success === true;
  };
  const live = (npc) => !!npc && npc.isNpc?.() === true && npc.isRegistered?.() === true &&
    npc.getHitpoints() > 0 && npc.isDyingFunction?.() !== true;

  function release(player, bot) {
    if (bot.target && CLAIMS.get(bot.target)?.player === player) CLAIMS.delete(bot.target);
    bot.target = null;
    bot.targetHp = null;
  }

  /**
   * Melee trains the lowest of Attack, Strength and Defence: the weapon's accurate, aggressive or
   * defensive style, as a player switches on the combat tab. Its weapon may lack that style (no
   * defensive on some): then the next lowest it has. Done between fights, so it switches as the
   * levels change.
   */
  // An honest bot's own taste in melee (from its name, so it keeps it): how much it favours
  // Attack, Strength and Defence, as players do ("strength first", "a bit of defence").
  const TASTES = [[1, 1.25, 0.8], [1.2, 1, 0.85], [1, 1, 1], [0.9, 1.3, 0.7], [1.1, 1.1, 0.9], [1, 0.9, 1.15]];
  const tasteOf = (player) => TASTES[hashSeed(`${player.getUsername?.() ?? "bot"}:melee`) % TASTES.length];
  const meleeChoice = new WeakMap();

  function meleeStyleForLowest(player) {
    const manager = player.getSkillManager();
    const fightTypes = Object.values(player.getWeapon()?.getFightType?.() ?? {}).filter(Boolean);
    // One skill well behind (3+ levels): that one, at once. Close together: its own taste and a
    // little chance, kept a while (5-15 minutes), as a player does not switch after every kill.
    const levels = skills.map((skill) => manager.getMaxLevel(skill));
    const spread = Math.max(...levels) - Math.min(...levels);
    const nowMs = Date.now();
    const kept = meleeChoice.get(player);
    if (spread >= 3) meleeChoice.delete(player);
    else if (kept && nowMs < kept.until) {
      const fightType = fightTypes.find((type) => type?.getStyle?.() === styles[kept.index]);
      if (fightType) {
        if (player.getFightType?.() !== fightType) WeaponInterfaceManager.changeCombatStyle(player, fightType.getChildId());
        return styles[kept.index];
      }
    }
    // The skill furthest behind its own taste, with a little chance on top.
    const taste = tasteOf(player);
    const order = skills.map((skill, index) => ({ index, level: spread >= 3 ? levels[index] : levels[index] / taste[index] * (0.9 + Math.random() * 0.2) }))
      .sort((a, b) => a.level - b.level || a.index - b.index);
    if (spread < 3) meleeChoice.set(player, { index: order[0].index, until: nowMs + (5 + Math.random() * 10) * 60_000 });
    for (const { index } of order) {
      const fightType = fightTypes.find((type) => type?.getStyle?.() === styles[index]);
      if (!fightType) continue;
      if (player.getFightType?.() !== fightType) WeaponInterfaceManager.changeCombatStyle(player, fightType.getChildId());
      return styles[index];
    }
    return null;
  }

  /**
   * Ranged and magic train Defence too when it lags: longrange (Ranged and Defence XP) or
   * defensive casting (Magic and Defence XP), as the combat tab offers; otherwise a style that
   * gives all its XP to Ranged or Magic. Hitpoints XP comes with every hit, whatever the style.
   */
  function rangedOrMagicStyle(player, style) {
    const manager = player.getSkillManager();
    const offence = manager.getMaxLevel(style === "ranged" ? Skill.RANGED : Skill.MAGIC);
    const defensive = manager.getMaxLevel(Skill.DEFENCE) < offence;
    const fightTypes = Object.values(player.getWeapon()?.getFightType?.() ?? {}).filter(Boolean);
    const wanted = defensive ? FightStyle.DEFENSIVE : style === "ranged" ? FightStyle.AGGRESSIVE : FightStyle.ACCURATE;
    const fightType = fightTypes.find((type) => type?.getStyle?.() === wanted)
      ?? (defensive ? null : fightTypes.find((type) => type?.getStyle?.() !== FightStyle.DEFENSIVE));
    if (!fightType || player.getFightType?.() === fightType) return;
    if (style === "ranged") {
      WeaponInterfaceManager.changeCombatStyle(player, fightType.getChildId());
      return;
    }
    // Choosing a style turns autocast off; defensive casting keeps the spell and sets the
    // staff's defensive style under it, as the autocast selector does.
    player.setFightType?.(fightType);
    core.Autocasting?.refreshIndicators?.(player);
  }

  function prepare(player, state) {
    // An honest bot (an adventurer) fights in what it owns and eats what it carries.
    if (state?.honest || isHonest(player)) {
      // Into the best weapon and armour it owns and may wear (an axe it chopped with goes back
      // in the bag for its scimitar): through the game's own equip. Its way of fighting is its
      // own choice (state.honestStyle: melee, a bow, or spells with its runes).
      // Out of arrows or runes mid-stretch: on with melee, as a player does, until it restocks.
      if (state && state.honestStyle === "ranged" && !wornAmmo(player, core)) state.honestStyle = "melee";
      if (state && state.honestStyle === "magic" && !castableSpell(player, core)) state.honestStyle = "melee";
      wearOwnGear(player, core, state?.honestStyle ?? "melee");
      const honestStyle = state?.honestStyle ?? "melee";
      if (honestStyle === "melee") meleeStyleForLowest(player);
      else rangedOrMagicStyle(player, honestStyle);
      return false;
    }
    let changed = false;
    const equipment = player.getEquipment();
    const manager = player.getSkillManager();
    const inventory = player.getInventory();
    const style = styleFor(player, state);
    const tiers = tiersFor(style);
    const offenseTier = tiers.filter((entry) =>
      manager.getCurrentLevel(offenseSkillFor(style)) >= entry.minLevel).pop();
    // Melee armour follows Defence like the old loadout; ranged/magic armour follows its skill.
    const armourTier = style === "melee"
      ? tiers.filter((entry) => manager.getCurrentLevel(Skill.DEFENCE) >= entry.minLevel).pop()
      : offenseTier;
    const seedBase = player.getUsername?.() ?? "bot";
    const pick = (pool, seed) => {
      if (!pool?.length) return null;
      const start = hashSeed(`${seedBase}:${seed}`) % pool.length;
      for (let index = 0; index < pool.length; index += 1) {
        const id = pool[(start + index) % pool.length];
        if (id === null) return null;
        const requirements = new Item(id, 1).getDefinition().getRequirements() ?? [];
        if (requirements.some((required, i) => required > manager.getCurrentLevel(skillByIndex.get(i)))) continue;
        return id;
      }
      return null;
    };
    const items = [];
    const weapon = offenseTier ? pick(offenseTier.weapons, `weapon:${offenseTier.minLevel}`) : null;
    if (offenseTier) {
      items.push([Equipment.WEAPON_SLOT, weapon]);
      if (style === "ranged") {
        const ammo = pick(offenseTier.ammo, `ammo:${offenseTier.minLevel}`);
        if (Number.isInteger(ammo)) items.push([Equipment.AMMUNITION_SLOT, ammo, RANGED_AMMO_AMOUNT]);
      }
    }
    for (const [slot, keys] of armourTier?.armour ?? []) {
      items.push([slot, pick(keys, `slot:${slot}:${armourTier.minLevel}`)]);
    }
    // Last write wins: a two-handed weapon vacates the shield the armour roll chose.
    if (Number.isInteger(weapon) && new Item(weapon, 1).getDefinition().isDoubleHanded?.() === true) {
      items.push([Equipment.SHIELD_SLOT, null]);
    }
    for (const [slot, id, amount] of items) {
      const existing = equipment.getItems()[slot];
      if (!Number.isInteger(id)) {
        // An empty roll vacates the slot instead of keeping stale gear.
        if (existing?.getId() > 0) {
          equipment.set(slot, new Item(-1, 1));
          changed = true;
        }
        continue;
      }
      if (existing?.getId() === id && (amount === undefined || existing.getAmount() >= amount)) continue;
      const item = new Item(id, amount ?? 1);
      // A weapon with charges (scythe, blowpipe, trident ...) comes fully charged, as the PvP
      // load-outs hand them out: its plugin answers "item:fill-charges".
      core.PluginManager?.emitCustomEvent?.("item:fill-charges", { player, item, handled: false });
      equipment.set(slot, item);
      changed = true;
    }
    if (changed) {
      equipment.refreshItems();
      WeaponInterfaceManager.assign(player);
      world.refreshEquipment(player);
      player.getUpdateFlag().flag(Flag.APPEARANCE);
    }
    if (style === "magic" && offenseTier) {
      const level = manager.getCurrentLevel(Skill.MAGIC);
      const available = offenseTier.spells.filter((spell) => level >= (spell.levelRequired?.() ?? 1));
      const spell = available.length
        ? available[hashSeed(`${seedBase}:spell:${offenseTier.minLevel}`) % available.length]
        : null;
      if (spell) {
        core.Autocasting?.setAutocast(player, spell);
        for (const rune of spell.itemsRequired?.(player) ?? []) {
          const missing = MAGIC_RUNE_AMOUNT - inventory.getAmount(rune.getId());
          if (missing > 0) inventory.adds(rune.getId(), missing);
          (stateFor(player).runeIds ??= new Set()).add(rune.getId());
        }
      }
    }
    if (style === "melee") meleeStyleForLowest(player);
    // Match equipTool/ensureItem: simulated bots are provisioned, but earn XP
    // exclusively through the normal combat engine. Refill only between fights.
    const food = stageFoodIds.get(stageFor(player, state)?.id) ?? foodId;
    for (const other of allFoodIds) {
      const stale = other === food ? 0 : inventory.getAmount(other);
      if (stale > 0) inventory.deleteNumber?.(other, stale);
    }
    const missing = foodAmount - inventory.getAmount(food);
    if (missing > 0) inventory.adds(food, missing);
    state.virtualFoodChargesRemaining = inventory.getAmount(food);
  }

  // Travel puts a high-level bot in its fighting gear at a raid or boss entrance.
  world.equipCombatGear = (player, state) => prepare(player, state ?? {});

  /**
   * Picks an NPC cluster from the index (no hand-drawn areas) by the lowest
   * trainers-per-NPC + distance / spreadDistance, so trainers fill near, roomy
   * clusters first and spill outward in proportion. Skips the last visit and
   * clusters this bot failed at.
   */
  function selectSite(player, bot, stage, nowMs, state = null) {
    const loc = player.getLocation();
    const own = targetsFor(state);
    const clusters = nearestClusters(npcClustersFor(world, `trainCombat:${[...excludedNames]}:${[...onlyNames]}:${own.key}`, own.level),
      levelKeys(stage), { x: loc.getX(), y: loc.getY(), z: loc.getZ() })
      .filter((cluster) => (bot.avoidedSites.get(cluster.key) ?? 0) <= nowMs);
    const fresh = clusters.filter((cluster) => cluster.key !== bot.previousSiteId);
    const pool = fresh.length ? fresh : clusters;
    if (!pool.length) return false;
    const score = (cluster) => occupants(cluster.key).size / cluster.count + cluster.distance / spreadDistance;
    // Best-scoring cluster the route planner can reach (jail, desert pass, island are
    // skipped by this bot). null: still planning, try again next tick.
    // An honest bot (an adventurer) does not always take the very best spot: it picks among the
    // few best it can reach, and leans to stronger monsters in its band, so it sees more of the
    // world than the rats and men next to it.
    const honest = state?.honest || isHonest(player);
    const strength = (cluster) => {
      const band = stage.npcLevels.max - stage.npcLevels.min;
      return band > 0 && Number.isFinite(cluster.level) ? (cluster.level - stage.npcLevels.min) / band : 0;
    };
    const rank = (cluster) => score(cluster) - (honest ? strength(cluster) * 0.6 : 0);
    const choices = [];
    for (const entry of [...pool].sort((a, b) => rank(a) - rank(b))) {
      const reachable = routeExists(player, entry, nowMs);
      // Not planned yet (planning budget spent): pick next tick, never walk blind.
      if (reachable === undefined) {
        if (choices.length === 0) return null;
        break;
      }
      if (reachable === true) {
        choices.push(entry);
        if (!honest || choices.length >= 3) break;
        continue;
      }
      bot.avoidedSites.set(entry.key, nowMs + SITE_AVOID_MS);
    }
    const cluster = choices[Math.floor(Math.random() * choices.length)] ?? null;
    if (!cluster) return false;
    occupants(cluster.key).add(player);
    bot.site = { id: cluster.key, npcLevels: stage.npcLevels, anchor: { x: cluster.x, y: cluster.y, z: cluster.z } };
    bot.previousSiteId = cluster.key;
    bot.stageId = stage.id;
    bot.endsAt = nowMs + randomInRange(minSeconds, maxSeconds) * 1000;
    bot.lastProgressAt = nowMs;
    bot.settled = false;
    world.regionManager.loadMapFiles?.(cluster.x, cluster.y);
    world.log?.("bot_combat_training_site", {
      username: player.getUsername(), stage: stage.id, site: cluster.key, x: cluster.x, y: cluster.y,
    });
    return true;
  }

  /** Leaves the current cluster; `avoidMs` keeps this bot from picking it again soon. */
  function leaveSite(player, bot, nowMs = 0, avoidMs = 0) {
    if (!bot.site) return;
    if (avoidMs) bot.avoidedSites.set(bot.site.id, nowMs + avoidMs);
    occupants(bot.site.id).delete(player);
    bot.previousSiteId = bot.site.id;
    bot.site = null;
    bot.approachNpc = null;
  }

  /** Stops fighting/claiming the current target; `avoidMs` bars re-picking it. */
  function dropTarget(player, bot, nowMs, avoidMs = 0) {
    if (bot.target) {
      if (avoidMs) bot.avoided.set(bot.target, nowMs + avoidMs);
      if (player.getCombat().getTarget() === bot.target) player.getCombat().reset();
    }
    player.setCombatFollowing?.(null);
    release(player, bot);
  }

  function available(player, npc, bot, nowMs, state = null) {
    if (!live(npc) || npc.getPrivateArea?.() !== player.getPrivateArea?.()) return false;
    const at = npc.getLocation();
    const anchor = bot.site.anchor;
    if (at.getZ() !== anchor.z ||
        Math.max(Math.abs(at.getX() - anchor.x), Math.abs(at.getY() - anchor.y)) > SITE_RADIUS) return false;
    const level = targetsFor(state).level(npc.getCurrentDefinition(player));
    if (level === null || level < bot.site.npcLevels.min || level > bot.site.npcLevels.max) return false;
    if ((bot.avoided.get(npc) ?? 0) > nowMs) return false;
    const combat = npc.getCombat();
    if ((combat.getTarget() && combat.getTarget() !== player) ||
        (combat.getAttacker() && combat.getAttacker() !== player)) return false;
    const claim = CLAIMS.get(npc);
    return !claim || claim.player === player || claim.until <= nowMs || claim.player.isRegistered?.() === false;
  }

  const action = {
    id: spec.id ?? "trainCombat",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = stateFor(player);
      if (player.getHitpoints() <= 0 || player.isDyingReturn?.()) {
        release(player, bot);
        leaveSite(player, bot);
        return "running";
      }
      if (player.isTeleportingReturn?.() || player.getForceMovement?.() || player.busy?.()) return "running";
      const location = player.getLocation();
      const position = `${location.getX()},${location.getY()},${location.getZ()}`;
      bot.stillTicks = position === bot.position ? (bot.stillTicks ?? 0) + 1 : 0;
      if (position !== bot.position) {
        bot.position = position;
        bot.lastProgressAt = nowMs;
        bot.progressFlag = true;
      }
      const hp = bot.target?.getHitpoints();
      if (bot.target && Number.isFinite(bot.targetHp) && hp < bot.targetHp) {
        // Damage landed: this target is not a failure, keep it fresh.
        bot.lastProgressAt = nowMs;
        bot.progressFlag = true;
        bot.claimedAt = nowMs;
        bot.failedTargets = 0;
      }
      bot.targetHp = hp ?? null;
      const combat = player.getCombat();
      // Reactive player-combat overlays own PvP; this activity only attacks NPCs.
      if (combat.getTarget()?.isPlayer?.() || combat.getAttacker()?.isPlayer?.()) return "running";
      // A dispatch that cannot resolve (no route, no door that helps) leaves its
      // request pending forever; after a short frozen window drop the target and
      // site and count the failure, so repeated stalls fail the activity instead
      // of hopping sites forever.
      if (peekMovementRequest(player) && nowMs - bot.lastProgressAt >= MOVEMENT_STALL_MS &&
          bot.stillTicks >= MOVEMENT_STALL_TICKS) {
        clearMovementRequest(player);
        bot.retryAt = nowMs;
        bot.failedTargets += 1;
        const blockedNpc = bot.target ?? bot.approachNpc;
        const anchor = bot.site?.anchor;
        const fromAnchor = anchor
          ? Math.max(Math.abs(location.getX() - anchor.x), Math.abs(location.getY() - anchor.y)) : 0;
        if (blockedNpc) {
          // Could not get to this NPC (fence without a gate, water): skip it, keep the cluster.
          bot.avoided.set(blockedNpc, nowMs + SITE_STALL_MS);
          dropTarget(player, bot, nowMs);
          bot.approachNpc = null;
        } else if (anchor && fromAnchor <= SITE_RADIUS) {
          // As close to the centre as the map allows (centre on water/a fence): train from here.
          bot.settled = true;
        } else if (anchor) {
          // Never got near: this bot skips the cluster for a while. Not shared: a slow
          // or blocked walk says nothing about the cluster (the planner knows islands).
          leaveSite(player, bot, nowMs, SITE_AVOID_MS);
        }
      }
      if (bot.target && !live(bot.target)) {
        dropTarget(player, bot, nowMs);
        bot.failedTargets = 0;
        bot.retryAt = nowMs + randomInRange(600, TARGET_RETRY_MS);
      }
      if (bot.target) {
        const stalled = nowMs - bot.claimedAt >= TARGET_STALL_MS;
        if (stalled || !available(player, bot.target, bot, nowMs, state)) {
          if (stalled) bot.failedTargets += 1;
          dropTarget(player, bot, nowMs, SITE_STALL_MS);
          clearMovementRequest(player);
        } else {
          CLAIMS.set(bot.target, { player, until: nowMs + RESERVATION_MS });
          if (combat.getTarget() === bot.target) {
            // Combat pathing cannot open doors; when a held fight lands no hit
            // (fence between us), keep a walked route alive so the brain's
            // dispatch opens the blocking gate.
            if (nowMs - bot.claimedAt >= ATTACK_STUCK_MS) {
              const destination = bot.target.getLocation();
              requestMovement(player, destination.getX?.() ?? destination.x, destination.getY?.() ?? destination.y,
                { state, nowMs, z: destination.getZ?.() ?? destination.z ?? 0, reason: "brain_combat_training", basicPather: true });
            }
            return "running";
          }
        }
      }
      const honest = state.honest || isHonest(player);
      if (honest && !bot.target && player.getHitpoints() * 2 < player.getSkillManager().getMaxLevel(Skill.HITPOINTS) &&
          !(player.getInventory().getItems() ?? []).some((item) => item && isFood(item.getId()))) {
        // Hurt and out of food: an honest bot stops before it dies, and restocks first
        // (Upkeep.PlayerBots.js, or an adventurer's planner).
        leaveSite(player, bot, nowMs, SITE_AVOID_MS);
        return "failed";
      }
      if (!bot.target && honest) {
        // An honest bot (an adventurer) takes its own loot between fights: its income.
        const ground = bot.loot ?? Loot.lootNear(world.core, player, { valueOf: (id, amount) => Value.itemValue(world.core, id, amount) });
        if (ground) {
          const step = Loot.takeStep(world.core, player, ground, { state, nowMs });
          bot.loot = step === "walking" ? ground : null;
          if (step !== "gone") {
            bot.lastProgressAt = nowMs;
            return "running";
          }
        }
        // Then it buries the bones it picked up, one a click, as a player does between kills.
        const boneSlot = (player.getInventory().getItems() ?? [])
          .findIndex((item) => item && /bones$/i.test(String(world.core.ItemDefinition.forId(item.getId())?.getName?.() ?? "")));
        // While a house party is on (HouseParty.PlayerBots.js) it keeps them for the altar.
        if (boneSlot >= 0 && !HouseParty.isOpen() && nowMs >= (bot.buryAt ?? 0) && world.useItem) {
          bot.buryAt = nowMs + BURY_EVERY_MS;
          if (world.useItem(player, boneSlot, "Bury")) {
            bot.lastProgressAt = nowMs;
            return "running";
          }
        }
      }
      if (!bot.target) {
        const stage = stageFor(player, state);
        if (bot.site && (bot.stageId !== stage.id || nowMs >= bot.endsAt)) return "success";
        if (bot.failedTargets >= maxFailedTargets) {
          world.log?.("bot_combat_training_stalled", {
            username: player.getUsername?.() ?? null, site: bot.site?.id ?? null,
            failures: bot.failedTargets, x: location.getX(), y: location.getY(),
          });
          leaveSite(player, bot, nowMs, SITE_AVOID_MS);
          return "failed";
        }
        const home = state.home;
        if (!bot.site && home && Number.isFinite(home.z) && location.getZ() !== home.z) {
          // Left upstairs (a bank floor): NPC clusters are found per floor, go back down first.
          if (!peekMovementRequest(player)) {
            requestMovement(player, home.x, home.y, { state, nowMs, z: home.z, reason: "brain_combat_training", basicPather: true });
          }
          return "running";
        }
        if (!bot.site) {
          const selected = selectSite(player, bot, stage, nowMs, state);
          if (selected === null) return "running";
          if (!selected) return "failed";
        }
        if (nowMs - bot.lastProgressAt >= SITE_STALL_MS) {
          leaveSite(player, bot, nowMs, SITE_AVOID_MS);
          return "failed";
        }
        if (nowMs < bot.retryAt) return "running";
        bot.retryAt = nowMs + TARGET_RETRY_MS;
        prepare(player, state);
        // Every NPC near the cluster, not just those in regions active around real players.
        const candidates = world.core.World.getNpcsNear(location, SITE_RADIUS + ATTACK_DISTANCE, player.getPrivateArea?.() ?? null)
          .filter((npc) => available(player, npc, bot, nowMs, state))
          .sort((a, b) => location.getDistance(a.getLocation()) - location.getDistance(b.getLocation()))
          .slice(0, TARGET_SPREAD * 2);
        // The near ones first (a little variety among those within a few tiles of the nearest),
        // then the further ones by distance: not a walk past three guards to a far fourth, but
        // the far one still when the near ones are taken or behind a fence.
        const nearest = candidates.length ? location.getDistance(candidates[0].getLocation()) : 0;
        const nearCount = candidates.filter((npc) => location.getDistance(npc.getLocation()) <= nearest + TARGET_SPREAD_TILES).length;
        const offset = randomInRange(0, Math.max(0, nearCount - 1));
        bot.approachNpc = null;
        for (let index = 0; index < candidates.length; index += 1) {
          const npc = index < nearCount ? candidates[(index + offset) % nearCount] : candidates[index];
          if (CombatFactory.canAttackPermission(player, npc, false, CombatFactory.getMethod(player)) !==
              CanAttackResponse.CAN_ATTACK) continue;
          if (!reachable(player, npc)) {
            // Behind a fence/gate: walk at it so the dispatch opens the way in; but not for ever
            // (Draynor Manor's fence has no gate on that side): after 30 s the ones behind it are
            // skipped, and with none it can reach the site is left.
            bot.approachSince ??= nowMs;
            if (nowMs - bot.approachSince > APPROACH_GIVE_UP_MS) {
              bot.avoided.set(npc, nowMs + SITE_STALL_MS);
              continue;
            }
            bot.approachNpc ??= npc;
            continue;
          }
          bot.approachSince = null;
          bot.target = npc;
          bot.targetHp = npc.getHitpoints();
          bot.claimedAt = nowMs;
          CLAIMS.set(npc, { player, until: nowMs + RESERVATION_MS });
          break;
        }
        if (!bot.target && !bot.approachNpc && bot.approachSince && nowMs - bot.approachSince > APPROACH_GIVE_UP_MS) {
          bot.approachSince = null;
          leaveSite(player, bot, nowMs, SITE_AVOID_MS);
          return "running";
        }
        if (bot.target || bot.approachNpc || !bot.settled) {
          bot.emptySince = null;
        } else if (nowMs - (bot.emptySince ??= nowMs) >= EMPTY_SITE_MS) {
          bot.emptySince = null;
          leaveSite(player, bot, nowMs, SITE_AVOID_MS);
          return "running";
        }
      }
      if (bot.target && location.getDistance(bot.target.getLocation()) <= ATTACK_DISTANCE) {
        clearMovementRequest(player);
        if (styleFor(player, state) !== "magic") {
          combat.setAutocastSpell?.(null);
          combat.setCastSpell?.(null);
        }
        combat.attack(bot.target);
        return "running";
      }
      if (player.getMovementQueue().size() > 0 || peekMovementRequest(player)) return "running";
      const anchor = bot.site.anchor;
      if (!bot.target && !bot.approachNpc &&
          (bot.settled || Math.max(Math.abs(location.getX() - anchor.x), Math.abs(location.getY() - anchor.y)) <= SITE_ARRIVE)) {
        // At the cluster: wait for a target here instead of re-walking onto the centre
        // (a walk to where we stand never completes and would read as a stall).
        bot.settled = true;
        return "running";
      }
      const destination = bot.target?.getLocation() ?? bot.approachNpc?.getLocation() ?? anchor;
      requestMovement(player, destination.getX?.() ?? destination.x, destination.getY?.() ?? destination.y,
        { state, nowMs, z: destination.getZ?.() ?? destination.z ?? 0, reason: "brain_combat_training", basicPather: true });
      return "running";
    },
    stop(ctx) {
      const bot = stateFor(ctx.player);
      // Food and runes are provisioned for training only: take them back, so a bot
      // switching to skilling has a free inventory (the next fight re-provisions).
      const inventory = ctx.player.getInventory?.();
      for (const itemId of ctx.state?.honest || isHonest(ctx.player) ? [] : [...allFoodIds, ...(bot.runeIds ?? [])]) {
        const amount = inventory?.getAmount(itemId) ?? 0;
        if (amount > 0) inventory.deleteNumber?.(itemId, amount);
      }
      bot.runeIds = null;
      dropTarget(ctx.player, bot, ctx.nowMs);
      clearMovementRequest(ctx.player);
      leaveSite(ctx.player, bot);
      bot.position = null;
      bot.retryAt = 0;
      bot.failedTargets = 0;
      if (ctx.state) ctx.state.doorAttempt = null;
    },
    describe(ctx) {
      const bot = stateFor(ctx.player);
      const at = (loc) => (loc ? `${loc.getX?.() ?? loc.x},${loc.getY?.() ?? loc.y}` : "none");
      return `train site=${bot.site ? `${bot.site.id}@${at(bot.site.anchor)}` : "none"} ` +
        `target=${bot.target ? `${bot.target.getDefinition?.()?.getName?.()}@${at(bot.target.getLocation())}` : "none"} ` +
        `approach=${at(bot.approachNpc?.getLocation())} settled=${!!bot.settled} failed=${bot.failedTargets} idle=${Math.round((ctx.nowMs - bot.lastProgressAt) / 1000)}s`;
    },
    madeProgress(ctx) {
      const bot = stateFor(ctx.player);
      if (!bot.progressFlag) return false;
      bot.progressFlag = false;
      return true;
    },
  };
  return action;
}

module.exports = { createTrainCombatAction };
