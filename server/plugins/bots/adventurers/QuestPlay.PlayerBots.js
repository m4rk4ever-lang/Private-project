"use strict";

/**
 * Adventurers play quests for real, as a player does (data/quest-playthroughs.json): walk to the
 * NPC, click Talk-to, read the dialogue and pick an answer, step by step until the quest's own
 * stage says the step is done. Nothing is set or given by this code: the quest plugin moves the
 * stage and hands out items and rewards when the dialogue reaches that point.
 *
 * The dialogue is answered a tick or two at a time (as a player clicks through it): preferred
 * options first (`prefer`), otherwise the first that is not a refusal ("No", "Actually...").
 * A basement is reached by its ladder (`places`): the long-route walk stays on one plane.
 */
const data = require("../data/quest-playthroughs.json");

/** Close enough to click stairs or a ladder (the click walks the rest), past an errand's arrival. */
const CLICK_TILES = 4;
/** Close enough to the NPC's spot to look for it. */
const NEAR_TILES = 8;
/** Talk-to tries per step before the quest is put aside (the NPC moved, a door stuck). */
const MAX_TRIES = 4;
/** The longest a step may take, the walk included. */
const STEP_MS = 20 * 60_000;
/** What a closed door, gate or passage on the way offers (caves, gaps, stiles too). */
const PASSAGE_OPTIONS = ["open", "enter", "climb-through", "squeeze-through", "climb-over", "pass", "go-through", "walk-through"];
/** How far around it looks for such a passage. */
const PASSAGE_RADIUS = 8;
const REFUSAL = /^(no\b|no,|no thank|actually|nevermind|never mind|nothing|bye|goodbye|i'?m not|i don'?t)|not interested|no thanks/i;

/** The option to pick: the first preferred word that matches, else the first that is not a refusal. */
function chooseOption(options, prefer = []) {
  const lower = options.map((option) => String(option).toLowerCase());
  for (const word of prefer) {
    const index = lower.findIndex((option) => option.includes(String(word).toLowerCase()));
    if (index >= 0) return index;
  }
  const index = options.findIndex((option) => !REFUSAL.test(String(option).trim()));
  return index >= 0 ? index : 0;
}

/** The step's target as { x, y, z }. */
function spot(step) {
  const [x, y, z = 0] = step.at;
  return { x, y, z };
}

/** The underground place a tile is in, if any. */
function placeOf(at, places = data.places) {
  return places.find((place) => {
    const [minX, minY, maxX, maxY] = place.area;
    return at.x >= minX && at.x <= maxX && at.y >= minY && at.y <= maxY && (at.z ?? 0) === (place.down.z ?? 0);
  }) ?? null;
}

/**
 * Where to go next for a target: the ladder out of the place it is in, the ladder into the
 * place the target is in, or the target itself. { x, y, z, climb?: { object, option } }.
 */
function nextHop(here, target, places = data.places) {
  const from = placeOf(here, places);
  const to = placeOf(target, places);
  if (from && from !== to) return { ...from.up, climb: from.up };
  if (to && from !== to) return { ...to.down, climb: to.down };
  return { ...target, climb: null };
}

/** Whether the quest has reached the step's `until`. */
function stepDone(quest, player, step) {
  if (!quest) return false;
  if (step.until === "complete") return quest.isComplete(player) === true;
  return quest.isComplete(player) === true || Number(quest.getStage(player)) >= Number(step.until);
}

let routeFinder = null;

function createQuestPlay({ core, world, walkTo, note, now = () => Date.now(), quests = () => [], playthroughs = data.quests, stateOf = () => null,
  helper = null, acquire = () => false, buyNamed = () => false }) {
  /**
   * The brain's own door opener (DoorOpening.PlayerBots.js): it clicks a door only when opening
   * it provably shortens the way to the target (it lifts the door's clipping and routes again).
   * True while it is busy with one.
   */
  function brainDoor(player, target) {
    const state = stateOf(player);
    if (!state) return false;
    const { maybeOpenDoor } = require("../brain/DoorOpening.PlayerBots");
    const here = player.getLocation();
    const request = { x: target.x, y: target.y, z: here.getZ(), lastSegmentX: target.x, lastSegmentY: target.y };
    try {
      return maybeOpenDoor({ player, state, world, request, select: !state.doorAttempt }) === true || Boolean(state.doorAttempt);
    } catch {
      return false;
    }
  }

  const questOf = (name) => quests().find((quest) => String(quest.name).toLowerCase() === String(name).toLowerCase()) ?? null;

  function has(name) {
    if (!questOf(name)) return false;
    return Boolean(playthroughs[name]) || Boolean(helper?.available?.() && helper.keyOf(name));
  }

  /**
   * Offered to the planner: a hand-written playthrough a bot has finished in game (verified: false
   * is not), or a quest on the Quest Helper list (quest-playthroughs.json helperQuests) while the
   * helper runs.
   */
  function ready(name) {
    if (!has(name)) return false;
    if (playthroughs[name]?.verified !== false && playthroughs[name]) return true;
    // helperAll: every quest the helper knows is tried (a stuck one is put aside and logged).
    return (data.helperAll === true || (data.helperQuests ?? []).includes(name)) && Boolean(helper?.available?.());
  }

  /** Starts `name` for this adventurer. */
  function start(entry, name, nowMs = now()) {
    if (!questOf(name)) return false;
    // A hand-written playthrough first; else the Quest Helper guides it step by step.
    // An unverified hand-written playthrough gives way to the helper when it runs.
    const own = playthroughs[name] && playthroughs[name].verified !== false ? playthroughs[name] : null;
    const helperKey = !own && helper?.available?.() ? helper.keyOf(name) : null;
    if (!playthroughs[name] && !helperKey) return false;
    entry.questRun = { name, step: 0, tries: 0, stepSince: nowMs, talkAt: 0, helperKey };
    return true;
  }

  /** The Quest Helper's current step for a guided run, its tries counted afresh on a new step. */
  function helperStep(run, player, nowMs) {
    const step = helper.current(player, run.helperKey);
    if (step && step.id !== run.helperStepId) {
      run.helperStepId = step.id;
      run.tries = 0;
      run.reason = null;
      run.stepSince = nowMs;
      run.step += step.id === "complete" ? 0 : 1;
      run.lastHelperStep = step;
    }
    return step;
  }

  /** Take the step's item from the ground at its tile (Take, as a player clicks it). */
  function takeItem(player, step, nowMs) {
    const manager = core.ItemOnGroundManager;
    if (!manager) return false;
    const [x, y, z] = step.at;
    const at = new core.Location(x, y, z);
    for (const id of step.ids) {
      const ground = manager.getOperableGroundItem?.(player, id, at, manager.takeOperation?.(id) ?? 3);
      if (!ground) continue;
      const Loot = require("../brain/Loot.PlayerBots");
      Loot.takeStep(core, player, ground, { state: stateOf(player), nowMs });
      return true;
    }
    return false;
  }

  /** Click an object of the step at its tile: the option the step's text names, else its first. */
  function useObject(player, step, nowMs) {
    const [x, y, z] = step.at;
    const objects = core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, z)) ?? [];
    const object = objects.find((o) => step.ids.includes(o.getId())) ?? objects[0];
    if (!object) return false;
    const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((o) => String(o ?? ""));
    const text = String(step.text ?? "").toLowerCase();
    let index = options.findIndex((o) => o && text.includes(o.toLowerCase().replace(/-/g, " ").split(" ")[0]));
    if (index < 0) index = options.findIndex((o) => o && o.toLowerCase() !== "examine");
    if (index < 0) return false;
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, objectId: object.getId(), clickType: index + 1,
        location: { x, y, z }, handled: false,
      }),
    });
    return true;
  }

  /** One dialogue click: continue, or pick an option. True while a dialogue is open. */
  function answer(player, step) {
    const prompt = core.MultiChatboxPrompt?.getPending?.(player);
    if (prompt) {
      const index = chooseOption(prompt.options, step?.prefer);
      core.MultiChatboxPrompt.handleInterfaceActionClick({ player, buttonId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID,
        groupId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID >>> 16, slot: index + 1, action: index + 1 });
      return true;
    }
    const manager = player.getDialogueManager?.();
    if (!manager?.isActive?.()) return false;
    const current = manager.getCurrent?.();
    if (current instanceof core.OptionDialogue) {
      manager.handleOption(chooseOption(current.getOptions(), step?.prefer) + 1);
      return true;
    }
    // An automatic action (a cutscene beat, Aubury pouring tea) moves on by itself.
    if (core.ActionDialogue && current instanceof core.ActionDialogue) return true;
    manager.advance();
    return true;
  }

  /** The NPC by name near the spot, or null. */
  function findNpc(player, step) {
    const target = spot(step);
    const near = core.World.getNpcsNear(new core.Location(target.x, target.y, target.z), NEAR_TILES + 6, player.getPrivateArea?.() ?? null);
    const wanted = String(step.npc).toLowerCase();
    return near.find((npc) => npc.isRegistered?.() !== false
      && String(npc.getCurrentDefinition?.(player)?.getName?.() ?? npc.getDefinition?.()?.getName?.() ?? "").toLowerCase() === wanted) ?? null;
  }

  /** Whether it can walk up to the NPC as things stand (doors closed count as walls). */
  function canReach(player, npc) {
    return canReachAt(player, npc.getLocation(), Math.max(1, Math.floor(npc.getSize?.() ?? 1)));
  }

  /** A route to that tile (a ladder, stairs) with no closed door in between. */
  function canReachAt(player, to, size = 1) {
    if (!core.RsmodRouteFinding) return true;
    routeFinder ??= new core.RsmodRouteFinding();
    const from = player.getLocation();
    if (from.getZ() !== to.getZ()) return false;
    return routeFinder.findRoute({
      level: from.getZ(), srcX: from.getX(), srcY: from.getY(), srcSize: 1, destX: to.getX(), destY: to.getY(),
      destWidth: size, destLength: size, locAngle: 0, locShape: -2, moveNear: false, blockAccessFlags: 0, maxWaypoints: 25,
      privateArea: player.getPrivateArea?.() ?? null,
    }).success === true;
  }

  /**
   * The closed door, gate or passage (a cave entrance, a gap) between it and where it wants to be:
   * of those around it that offer a way through, the one that lies best between the two. Clicked
   * as a player does; true when it clicked one.
   */
  function openWayTo(player, target, nowMs) {
    if (nowMs < (openWayTo.until?.get(player) ?? 0)) return false;
    (openWayTo.until ??= new WeakMap()).set(player, nowMs + 3000);
    const here = player.getLocation();
    let best = null;
    for (let dx = -PASSAGE_RADIUS; dx <= PASSAGE_RADIUS; dx += 1) {
      for (let dy = -PASSAGE_RADIUS; dy <= PASSAGE_RADIUS; dy += 1) {
        const x = here.getX() + dx;
        const y = here.getY() + dy;
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, here.getZ())) ?? []) {
          const loc = object.getLocation();
          if (loc.getX() !== x || loc.getY() !== y) continue;
          const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((o) => String(o ?? "").toLowerCase());
          const index = options.findIndex((o) => PASSAGE_OPTIONS.includes(o));
          if (index < 0) continue;
          // "Open" is a door's or a gate's (a wall object, or so named), not a chest's or drawers'.
          const name = String(core.ObjectDefinition.forId(object.getId())?.getName?.() ?? "");
          const wall = Number(object.getType?.() ?? 10) <= 3 || Number(object.getType?.()) === 9;
          if (options[index] === "open" && !wall && !/door|gate/i.test(name)) continue;
          const score = Math.max(Math.abs(x - here.getX()), Math.abs(y - here.getY()))
            + Math.max(Math.abs(x - target.x), Math.abs(y - target.y));
          if (!best || score < best.score) best = { object, clickType: index + 1, score, x, y };
        }
      }
    }
    world.log?.("adventurer_quest_door", { name: player.getUsername?.(), at: `${here.getX()},${here.getY()},${here.getZ()}`,
      target, door: best ? `${core.ObjectDefinition.forId(best.object.getId())?.getName?.()}@${best.x},${best.y} click ${best.clickType}` : null });
    if (!best) return false;
    player.getMovementQueue().walkToObject(best.object, {
      execute: () => world.emitObjectInteraction?.({
        player, object: best.object, objectId: best.object.getId(), clickType: best.clickType,
        location: { x: best.x, y: best.y, z: here.getZ() }, handled: false,
      }),
    });
    return true;
  }

  function talkTo(player, npc) {
    const actions = npc.getCurrentDefinition?.(player)?.getActions?.() ?? npc.getDefinition?.()?.getActions?.() ?? [];
    const clickType = actions.findIndex((action) => String(action ?? "").toLowerCase() === "talk-to") + 1;
    if (!clickType) return false;
    // The same click a player's client sends: its walk, then the NPC's handler, the quest
    // dialogue among them (NpcInteractionManager), not only the plugins' hooks.
    if (core.operateNpc) {
      world.log?.("adventurer_quest_talk", { name: player.getUsername?.(), npc: npc.getIndex(), clickType,
        busy: player.busy?.() === true, interfaceId: player.getInterfaceId?.() ?? null, status: String(player.getStatus?.() ?? "") });
      core.operateNpc(player, npc.getIndex(), clickType);
      return true;
    }
    player.getMovementQueue().walkToEntity(npc, () => {
      const at = npc.getLocation();
      player.setPositionToFace?.(at);
      world.emitNpcInteraction?.({
        player, npc, npcId: npc.getContentId?.(player) ?? npc.getId(), npcIndex: npc.getIndex(), clickType,
        location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      });
    }, 1);
    return true;
  }

  /** The stairs from this floor that lead toward the target's floor (Climbing's own search). */
  function stairsTo(here, target, nowMs) {
    const { findStairs } = require("../brain/Climbing.PlayerBots");
    const ClimbLinks = require("../../objects/ClimbLinks");
    return findStairs(here, target, target.z > here.z ? ClimbLinks.UP : ClimbLinks.DOWN, nowMs) ?? null;
  }

  function climb(player, hop) {
    const objects = core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(hop.x, hop.y, hop.z)) ?? [];
    const ladder = objects.find((object) => String(core.ObjectDefinition?.forId?.(object.getId())?.getName?.() ?? "") === hop.climb.object);
    if (!ladder) return false;
    const options = (core.ObjectDefinition.forId(ladder.getId())?.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
    const clickType = options.indexOf(hop.climb.option.toLowerCase()) + 1;
    if (!clickType) return false;
    // As a click: walk up to the ladder, then climb.
    player.getMovementQueue().walkToObject(ladder, {
      execute: () => world.emitObjectInteraction?.({
        player, object: ladder, objectId: ladder.getId(), clickType,
        location: { x: hop.x, y: hop.y, z: hop.z }, handled: false,
      }),
    });
    return true;
  }

  /**
   * Every tick: answers an open dialogue. Returns true while it is busy talking (so the slower
   * planning tick leaves it alone).
   */
  function talkTick(entry) {
    const run = entry.questRun;
    if (!run) return false;
    const step = run.helperKey ? run.lastHelperStep : playthroughs[run.name]?.steps?.[run.step];
    return answer(entry.player, step);
  }

  /**
   * The planning tick: "running", "done" (the quest is complete) or "failed" (put aside).
   * Walks, climbs and talks; the quest plugin does the rest.
   */
  function tick(entry, nowMs = now(), { busy = false } = {}) {
    const run = entry.questRun;
    if (!run) return "failed";
    const player = entry.player;
    const quest = questOf(run.name);
    const steps = playthroughs[run.name]?.steps ?? [];
    if (!quest) return "failed";
    if (quest.isComplete(player)) return "done";
    if (busy || player.getDialogueManager?.()?.isActive?.() || core.MultiChatboxPrompt?.getPending?.(player)) return "running";
    let step;
    if (run.helperKey) {
      step = helperStep(run, player, nowMs);
      if (nowMs - run.stepSince > STEP_MS || run.tries >= MAX_TRIES) return "failed";
      // The helper's first answer comes back a moment later.
      if (!step) return "running";
      if (step.kind === "complete") return "done";
      // What the step needs that it does not have: fetched or bought first (an errand).
      // (Not what this very step picks up: the egg in the chicken coop is taken, not bought.)
      const needs = step.kind === "item" ? step.needs.filter((need) => !need.ids.some((id) => step.ids.includes(id))) : step.needs;
      if (needs.length > 0 && nowMs >= (run.needsAt ?? 0)) {
        run.needsAt = nowMs + 60_000;
        const need = needs[0];
        if (acquire(entry, need.ids, need.amount, need.name)) return "running";
        run.tries += 1; run.reason = `item missing: ${need.name}`;
        note?.(player, `Mist ${need.name} voor ${run.name} en kan het nu niet krijgen.`, "quest");
      }
      // "Purchase a bucket from the General Store": a purchase, not a chat (an errand to the shop).
      const purchase = /^(?:purchase|buy)\s+(?:an?\s+|some\s+|\d+\s*x?\s*)?(.+?)\s+(?:from|at)\b/i.exec(step.text ?? "");
      if (purchase && nowMs >= (run.buyAt ?? 0)) {
        run.buyAt = nowMs + 30_000;
        if (buyNamed(entry, purchase[1])) return "running";
        run.tries += 1; run.reason = `could not buy: ${purchase[1]}`;
      }
      // A step with no place (read a book, use an item): nothing it can do yet, it asks again.
      if (!step.at) {
        if (nowMs >= (run.waitAt ?? 0)) {
          run.waitAt = nowMs + 15_000;
          run.tries += 1; run.reason = "step without a place (helper gives no tile)";
        }
        return "running";
      }
    } else {
      while (run.step < steps.length && stepDone(quest, player, steps[run.step])) {
        run.step += 1;
        run.tries = 0;
        run.stepSince = nowMs;
      }
      step = steps[run.step];
      if (!step) return quest.isComplete(player) ? "done" : "failed";
      if (nowMs - run.stepSince > STEP_MS || run.tries >= MAX_TRIES) return "failed";
    }
    const at = player.getLocation();
    const here = { x: at.getX(), y: at.getY(), z: at.getZ() };
    const target = spot(step);
    const hop = nextHop(here, target);
    world.log?.("adventurer_quest_tick", { name: player.getUsername?.(), step: run.step, tries: run.tries, here, target, hop: hop.climb ? hop.climb.option : null,
      stairs: here.z !== target.z ? Boolean(stairsTo(here, target, nowMs)) : null });
    // Another floor (Duke Horacio upstairs): to the stairs that lead there, then climb them.
    // The ladder of the next hop on another floor too (down from the Duke to the Wizards' Tower).
    const floorGoal = hop.climb ? { x: hop.x, y: hop.y, z: hop.z } : target;
    if (here.z !== floorGoal.z) {
      const stairs = stairsTo(here, floorGoal, nowMs);
      if (!stairs) { run.reason = `no stairs/ladder found to floor ${floorGoal.z}`; return run.tries++ >= MAX_TRIES ? "failed" : "running"; }
      const at = stairs.getLocation();
      const away = Math.max(Math.abs(here.x - at.getX()), Math.abs(here.y - at.getY()));
      // Within an errand's arrival (3 tiles) it clicks the stairs and walks the last steps itself:
      // a walk to the stairs from there "arrived" at once and started again, round and round.
      if (away <= 12 && !canReachAt(player, at, Math.max(1, Number(core.ObjectDefinition?.forId?.(stairs.getId())?.getSizeX?.() ?? 1)))
          && (brainDoor(player, { x: at.getX(), y: at.getY() }) || openWayTo(player, { x: at.getX(), y: at.getY() }, nowMs))) {
        return "running";
      }
      if (away <= CLICK_TILES) {
        if (nowMs >= (run.climbAt ?? 0)) {
          run.climbAt = nowMs + 4000;
          const { climbOption } = require("../brain/Climbing.PlayerBots");
          const clickType = climbOption(stairs.getId(), floorGoal.z > here.z ? 1 : -1);
          if (clickType) {
            player.getMovementQueue().walkToObject(stairs, {
              execute: () => world.emitObjectInteraction?.({
                player, object: stairs, objectId: stairs.getId(), clickType,
                location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
              }),
            });
          }
        }
        return "running";
      }
      // A walk that could not start (that way was blocked a moment ago) counts as a try.
      if (!walkTo(entry, { x: at.getX(), y: at.getY(), z: here.z, name: step.npc }, { reason: "quest", replan: false, say: false })) { run.tries += 1; run.reason = "walk to the stairs refused"; }
      return "running";
    }
    if (hop.climb) {
      if (here.z === hop.z && !canReachAt(player, new core.Location(hop.x, hop.y, hop.z))
          && Math.max(Math.abs(here.x - hop.x), Math.abs(here.y - hop.y)) <= 12) {
        // A closed door between it and the ladder (the Wizards' Tower): open it first.
        if (brainDoor(player, { x: hop.x, y: hop.y }) || openWayTo(player, { x: hop.x, y: hop.y }, nowMs)) return "running";
      }
      if (Math.max(Math.abs(here.x - hop.x), Math.abs(here.y - hop.y)) <= CLICK_TILES && here.z === hop.z) {
        climb(player, hop);
        return "running";
      }
      if (!walkTo(entry, { x: hop.x, y: hop.y, z: hop.z, name: step.npc }, { reason: "quest", replan: false, say: false })) { run.tries += 1; run.reason = "walk to the ladder refused"; }
      return "running";
    }
    const away = here.z === target.z ? Math.max(Math.abs(here.x - target.x), Math.abs(here.y - target.y)) : Infinity;
    if (away > NEAR_TILES) {
      if (!walkTo(entry, { ...target, name: step.npc }, { reason: "quest", replan: false, say: run.tries === 0 && !run.walking })) { run.tries += 1; run.reason = "walk to the step refused (blocked recently)"; }
      run.walking = true;
      return "running";
    }
    run.walking = false;
    if (nowMs < run.talkAt) return "running";
    if (run.helperKey && step.kind !== "npc") {
      run.tries += 1; run.reason = run.reason ?? `${step.kind} step did not advance`;
      run.talkAt = nowMs + 8_000;
      if (step.kind === "object" && !useObject(player, step, nowMs)) run.reason = `object not found at ${step.at.join(",")} (ids ${step.ids.join("/")})`;
      else if (step.kind === "object") run.reason = "object used, but the step did not advance";
      if (step.kind === "item" && !takeItem(player, step, nowMs)) {
        // Not lying there (taken, not spawned yet): fetched from its bank or bought instead.
        run.reason = `item not on the ground at ${step.at.join(",")}`;
        if (acquire(entry, step.ids, 1, step.text)) return "running";
      }
      return "running";
    }
    const npc = findNpc(player, step);
    // A closed door between it and the NPC (Duke Horacio's room): open the way first.
    const npcAt = npc ? { x: npc.getLocation().getX(), y: npc.getLocation().getY() } : null;
    if (npc && !canReach(player, npc) && (brainDoor(player, npcAt) || openWayTo(player, npcAt, nowMs))) {
      run.talkAt = nowMs + 3_000;
      return "running";
    }
    run.tries += 1; run.reason = npc ? "talked, but the step did not advance" : `npc not found: ${step.npc}`;
    run.talkAt = nowMs + 8_000;
    if (!npc || !talkTo(player, npc)) {
      note?.(player, `Kan ${step.npc} niet vinden voor ${run.name}.`, "quest");
      return "running";
    }
    return "running";
  }

  /** Why a run stopped, for the quest feedback log: its step, where and why. */
  function describeFailure(entry) {
    const run = entry.questRun;
    if (!run) return null;
    const player = entry.player;
    const quest = questOf(run.name);
    const step = run.helperKey ? run.lastHelperStep : playthroughs[run.name]?.steps?.[run.step];
    const at = player.getLocation();
    return {
      quest: run.name, guide: run.helperKey ? "quest-helper" : "playthrough", stage: Number(quest?.getStage?.(player) ?? -1),
      step: run.step, kind: step?.kind ?? (step?.npc ? "npc" : null), text: step?.text ?? null, npc: step?.npc ?? null,
      ids: step?.ids ?? null, target: step?.at ?? null, here: [at.getX(), at.getY(), at.getZ()],
      reason: run.reason ?? (Date.now() - run.stepSince > STEP_MS ? "step took too long" : "too many tries"), tries: run.tries,
    };
  }

  return { start, tick, talkTick, has, ready, questOf, describeFailure };
}

module.exports = { createQuestPlay, chooseOption, nextHop, placeOf, stepDone, data };
