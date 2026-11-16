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
const HELPER_STEP_MS = 6 * 60_000;
/** What a closed door, gate or passage on the way offers (caves, gaps, stiles too). */
const PASSAGE_OPTIONS = ["open", "enter", "climb-through", "squeeze-through", "climb-over", "pass", "go-through", "walk-through"];
/** How far around it looks for such a passage. */
const PASSAGE_RADIUS = 8;
const REFUSAL = /^(no\b|no,|no thank|actually|nevermind|never mind|nothing|bye|goodbye|i'?m not|i don'?t)|not interested|no thanks/i;

/**
 * Options a player picks to take on a quest or help, when the guide names none: "I'm looking for
 * a quest", "Perhaps I could help to find her for you?", "Can I help?". Without them the first
 * option that is not a refusal was taken ("Yes, I have seen her actually!"), and the quest never
 * started.
 */
const QUEST_OPTIONS = ["looking for a quest", "i'm looking for a quest", "could help", "can i help", "i can help", "help you",
  "i'll help", "i will help", "what's wrong", "what is wrong", "what's the matter", "any quests", "quest"];

/** The option to pick: the first preferred word that matches, else the first that is not a refusal. */
function chooseOption(options, prefer = []) {
  const lower = options.map((option) => String(option).toLowerCase());
  for (const word of [...prefer, ...QUEST_OPTIONS]) {
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
    entry.questRun = { name, step: 0, tries: 0, stepSince: nowMs, startedAt: nowMs, talkAt: 0, helperKey };
    return true;
  }

  /** The Quest Helper's current step for a guided run, its tries counted afresh on a new step. */
  function helperStep(run, player, nowMs) {
    const step = helper.current(player, run.helperKey);
    if (step && step.id !== run.helperStepId) {
      // The timeline for the feedback log: each step, when it came and what it said.
      (run.history ??= []).push({ at: new Date(nowMs).toISOString(), step: step.id, kind: step.kind, text: step.text ?? null, target: step.at ?? null });
      if (run.history.length > 20) run.history.shift();
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
    // On that tile or near it, nearest first: eggs, flour and the like spawn a few tiles from
    // where the helper points (the farm's eggs lie all over the coop).
    // The whole pen or field (14 tiles): with many players about the nearest egg is often gone,
    // another lies further on, as a player walking round the coop finds.
    for (let radius = 0; radius <= 14; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const at = new core.Location(x + dx, y + dy, z);
          for (const id of step.ids) {
            const ground = manager.getOperableGroundItem?.(player, id, at, manager.takeOperation?.(id) ?? 3);
            if (!ground) continue;
            const Loot = require("../brain/Loot.PlayerBots");
            Loot.takeStep(core, player, ground, { state: stateOf(player), nowMs });
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Click an object of the step at its tile: the option the step's text names, else its first. */
  function useObject(player, step, nowMs) {
    const [x, y, z] = step.at;
    // The object on that tile, or the nearest of its ids around it (a big object, such as the
    // castle staircase, has its anchor on another tile than the one the helper names).
    let object = null;
    let best = Infinity;
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dy = -3; dy <= 3; dy += 1) {
        for (const candidate of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x + dx, y + dy, z)) ?? []) {
          if (!step.ids.includes(candidate.getId())) continue;
          const away = Math.max(Math.abs(dx), Math.abs(dy));
          if (away < best) { best = away; object = candidate; }
        }
      }
    }
    if (!object) return false;
    const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((o) => String(o ?? ""));
    const text = String(step.text ?? "").toLowerCase();
    let index = options.findIndex((o) => o && text.includes(o.toLowerCase().replace(/-/g, " ").split(" ")[0]));
    if (index < 0) index = options.findIndex((o) => o && o.toLowerCase() !== "examine");
    if (index < 0) return false;
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, objectId: object.getId(), clickType: index + 1,
        location: { x: object.getLocation().getX(), y: object.getLocation().getY(), z: object.getLocation().getZ() }, handled: false,
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
  function findNpc(player, step, recentNpcs = null) {
    const target = spot(step);
    const near = core.World.getNpcsNear(new core.Location(target.x, target.y, target.z), NEAR_TILES + 6, player.getPrivateArea?.() ?? null);
    const wanted = String(step.npc).toLowerCase();
    const ids = new Set(step.ids ?? []);
    const matches = near.filter((npc) => npc.isRegistered?.() !== false
      && (String(npc.getCurrentDefinition?.(player)?.getName?.() ?? npc.getDefinition?.()?.getName?.() ?? "").toLowerCase() === wanted
        || ids.has(npc.getContentId?.(player) ?? npc.getId())));
    // A step done on many of them (shear twenty sheep): not the same one again and again.
    const recent = new Set(recentNpcs ?? []);
    const here = player.getLocation();
    const away = (npc) => Math.max(Math.abs(npc.getLocation().getX() - here.getX()), Math.abs(npc.getLocation().getY() - here.getY()));
    return matches.filter((npc) => !recent.has(npc.getIndex())).sort((a, b) => away(a) - away(b))[0]
      ?? matches.sort((a, b) => away(a) - away(b))[0] ?? null;
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

  function talkTo(player, npc, step = null) {
    const actions = (npc.getCurrentDefinition?.(player)?.getActions?.() ?? npc.getDefinition?.()?.getActions?.() ?? [])
      .map((action) => String(action ?? "").toLowerCase());
    // The option the step names ("Shear sheep in the nearby field": Shear), else Talk-to, else
    // the NPC's own first option (a sheep has no Talk-to).
    const verb = String(step?.text ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    let clickType = verb && verb !== "talk" ? actions.findIndex((action) => action === verb) + 1 : 0;
    if (!clickType) clickType = actions.findIndex((action) => action === "talk-to") + 1;
    if (!clickType) clickType = actions.findIndex((action) => action && action !== "examine" && action !== "null") + 1;
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
      // A helper step that does not move on in 6 minutes is stuck (logged, put aside).
      if (nowMs - run.stepSince > HELPER_STEP_MS || run.tries >= MAX_TRIES) return "failed";
      // The helper's first answer comes back a moment later; one that never comes is a reason.
      if (!step) {
        const said = helper.status?.(player);
        if (said?.error) run.reason = `quest helper error: ${said.error}`;
        else if (nowMs - run.stepSince > 60_000) run.reason = "quest helper gave no step for a minute";
        if (nowMs - run.stepSince > 2 * 60_000) return "failed";
        return "running";
      }
      if (step.kind === "complete") return "done";
      // The guide asks for the quest journal to be opened to read its state (Pirate's Treasure):
      // nothing a bot can answer; stopped at once with that reason, not tried for six minutes.
      if (/quest journal to sync/i.test(step.text ?? "")) {
        run.reason = "quest helper needs the quest journal opened to sync (not supported for bots)";
        return "failed";
      }
      // The helper cannot answer here (missing cache data): stop now, with the reason logged.
      if (step.kind === "unavailable") {
        run.reason = step.reason;
        return "failed";
      }
      // What the guide recommends bringing (food for the fights, a teleport, an antipoison):
      // each fetched or bought once at the start, as a player packs before setting off; one it
      // cannot get (too dear, sold nowhere) is left out, not a reason to stop.
      const recommended = (helper.recommended?.(player) ?? []).filter((rec) => !(run.recTried ??= new Set()).has(rec.name));
      if (recommended.length > 0 && run.recTried.size < 4 && nowMs >= (run.recAt ?? 0)) {
        const rec = recommended[0];
        run.recTried.add(rec.name);
        run.recAt = nowMs + 5_000;
        if (acquire(entry, rec.ids, rec.amount, rec.name)) {
          note?.(player, `Haalt ${rec.amount > 1 ? `${rec.amount} x ` : ""}${rec.name} voor ${run.name} (aangeraden).`, "quest");
          return "running";
        }
      }
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
        if (buyNamed(entry, purchase[1])) {
          // Buying is the step (a shop or the exchange): it does not also talk to the keeper.
          run.talkAt = nowMs + 30_000;
          return "running";
        }
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
      // A closed door between it and the object or item (Lumbridge castle's rooms): open it first.
      const goal = { x: step.at[0], y: step.at[1] };
      if (!canReachAt(player, new core.Location(goal.x, goal.y, step.at[2] ?? here.z), 1)
          && (brainDoor(player, goal) || openWayTo(player, goal, nowMs))) {
        run.talkAt = nowMs + 3_000;
        run.reason = "opening a door on the way";
        return "running";
      }
      run.tries += 1; run.reason = run.reason ?? `${step.kind} step did not advance`;
      run.talkAt = nowMs + 8_000;
      if (step.kind === "object" && !useObject(player, step, nowMs)) run.reason = `object not found at ${step.at.join(",")} (ids ${step.ids.join("/")})`;
      else if (step.kind === "object") run.reason = "object used, but the step did not advance";
      if (step.kind === "item" && !takeItem(player, step, nowMs)) {
        // Not lying there (another took it, it has not spawned again yet): it waits for the
        // respawn as a player does, up to 90 seconds, without counting that as failing.
        run.itemWaitSince ??= nowMs;
        if (nowMs - run.itemWaitSince < 90_000) {
          run.tries = Math.max(0, run.tries - 1);
          run.reason = `waiting for the item to appear at ${step.at.join(",")}`;
          run.talkAt = nowMs + 3_000;
          return "running";
        }
        // Still none: fetched from its bank or bought instead.
        run.reason = `item not on the ground at ${step.at.join(",")}`;
        if (acquire(entry, step.ids, 1, step.text)) return "running";
      } else if (step.kind === "item") {
        run.itemWaitSince = null;
      }
      return "running";
    }
    const npc = findNpc(player, step, run.lastNpcs);
    // A closed door between it and the NPC (Duke Horacio's room): open the way first.
    const npcAt = npc ? { x: npc.getLocation().getX(), y: npc.getLocation().getY() } : null;
    if (npc && !canReach(player, npc) && (brainDoor(player, npcAt) || openWayTo(player, npcAt, nowMs))) {
      run.talkAt = nowMs + 3_000;
      return "running";
    }
    run.tries += 1; run.reason = npc ? "talked, but the step did not advance" : `npc not found: ${step.npc}`;
    run.talkAt = nowMs + 8_000;
    if (npc) run.lastNpcs = [...(run.lastNpcs ?? []), npc.getIndex()].slice(-6);
    if (!npc || !talkTo(player, npc, step)) {
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
    const helperState = run.helperKey ? helper?.status?.(player) : null;
    const startedAt = run.history?.[0]?.at ?? null;
    return {
      quest: run.name, guide: run.helperKey ? "quest-helper" : "playthrough", stage: Number(quest?.getStage?.(player) ?? -1),
      // How long the run and its last step took, the helper's own state, and every step it saw.
      runSeconds: run.startedAt ? Math.round((Date.now() - run.startedAt) / 1000) : null,
      stepSeconds: Math.round((Date.now() - run.stepSince) / 1000),
      helper: helperState, startedAt, history: run.history ?? [], lastReasonAt: run.reasonAt ?? null,
      step: run.step, kind: step?.kind ?? (step?.npc ? "npc" : null), text: step?.text ?? null, npc: step?.npc ?? null,
      ids: step?.ids ?? null, target: step?.at ?? null, here: [at.getX(), at.getY(), at.getZ()],
      reason: run.reason ?? (Date.now() - run.stepSince > STEP_MS ? "step took too long" : "too many tries"), tries: run.tries,
    };
  }

  return { start, tick, talkTick, has, ready, questOf, describeFailure };
}

module.exports = { createQuestPlay, chooseOption, nextHop, placeOf, stepDone, data };
