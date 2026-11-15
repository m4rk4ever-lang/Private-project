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

/** Close enough to the NPC's spot to look for it. */
const NEAR_TILES = 8;
/** Talk-to tries per step before the quest is put aside (the NPC moved, a door stuck). */
const MAX_TRIES = 4;
/** The longest a step may take, the walk included. */
const STEP_MS = 20 * 60_000;
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

function createQuestPlay({ core, world, walkTo, note, now = () => Date.now(), quests = () => [], playthroughs = data.quests }) {
  const questOf = (name) => quests().find((quest) => String(quest.name).toLowerCase() === String(name).toLowerCase()) ?? null;

  function has(name) {
    return Boolean(playthroughs[name]) && Boolean(questOf(name));
  }

  /** Starts `name` for this adventurer. */
  function start(entry, name, nowMs = now()) {
    const playthrough = playthroughs[name];
    if (!playthrough || !questOf(name)) return false;
    entry.questRun = { name, step: 0, tries: 0, stepSince: nowMs, talkAt: 0 };
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
    world.emitObjectInteraction?.({
      player, object: ladder, objectId: ladder.getId(), clickType,
      location: { x: hop.x, y: hop.y, z: hop.z }, handled: false,
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
    const step = playthroughs[run.name]?.steps?.[run.step];
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
    while (run.step < steps.length && stepDone(quest, player, steps[run.step])) {
      run.step += 1;
      run.tries = 0;
      run.stepSince = nowMs;
    }
    const step = steps[run.step];
    if (!step) return quest.isComplete(player) ? "done" : "failed";
    if (nowMs - run.stepSince > STEP_MS || run.tries >= MAX_TRIES) return "failed";
    const at = player.getLocation();
    const here = { x: at.getX(), y: at.getY(), z: at.getZ() };
    const target = spot(step);
    const hop = nextHop(here, target);
    world.log?.("adventurer_quest_tick", { name: player.getUsername?.(), step: run.step, tries: run.tries, here, target, hop: hop.climb ? hop.climb.option : null,
      stairs: here.z !== target.z ? Boolean(stairsTo(here, target, nowMs)) : null });
    // Another floor (Duke Horacio upstairs): to the stairs that lead there, then climb them.
    if (!hop.climb && here.z !== target.z) {
      const stairs = stairsTo(here, target, nowMs);
      if (!stairs) return run.tries++ >= MAX_TRIES ? "failed" : "running";
      const at = stairs.getLocation();
      const away = Math.max(Math.abs(here.x - at.getX()), Math.abs(here.y - at.getY()));
      if (away <= 2) {
        if (nowMs >= (run.climbAt ?? 0)) {
          run.climbAt = nowMs + 4000;
          const { climbOption } = require("../brain/Climbing.PlayerBots");
          const clickType = climbOption(stairs.getId(), target.z > here.z ? 1 : -1);
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
      if (!walkTo(entry, { x: at.getX(), y: at.getY(), z: here.z, name: step.npc }, { reason: "quest", replan: false, say: false })) run.tries += 1;
      return "running";
    }
    if (hop.climb) {
      if (Math.max(Math.abs(here.x - hop.x), Math.abs(here.y - hop.y)) <= 1 && here.z === hop.z) {
        climb(player, hop);
        return "running";
      }
      if (!walkTo(entry, { x: hop.x, y: hop.y, z: hop.z, name: step.npc }, { reason: "quest", replan: false, say: false })) run.tries += 1;
      return "running";
    }
    const away = here.z === target.z ? Math.max(Math.abs(here.x - target.x), Math.abs(here.y - target.y)) : Infinity;
    if (away > NEAR_TILES) {
      if (!walkTo(entry, { ...target, name: step.npc }, { reason: "quest", replan: false, say: run.tries === 0 && !run.walking })) run.tries += 1;
      run.walking = true;
      return "running";
    }
    run.walking = false;
    if (nowMs < run.talkAt) return "running";
    const npc = findNpc(player, step);
    run.tries += 1;
    run.talkAt = nowMs + 8_000;
    if (!npc || !talkTo(player, npc)) {
      note?.(player, `Kan ${step.npc} niet vinden voor ${run.name}.`, "quest");
      return "running";
    }
    return "running";
  }

  return { start, tick, talkTick, has, questOf };
}

module.exports = { createQuestPlay, chooseOption, nextHop, placeOf, stepDone, data };
