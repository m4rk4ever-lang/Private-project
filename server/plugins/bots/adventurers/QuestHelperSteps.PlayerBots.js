"use strict";

/**
 * The real Quest Helper (Zoinkwiz, BSD-2, run headless by the quest-helper bridge) as an
 * adventurer's guide: for a quest without a hand-written playthrough it asks the helper what the
 * current step is, from the bot's own view of the world (what a player's client sends), and turns
 * the answer into a step QuestPlay can do: talk to an NPC, use an object, or walk to a tile; with
 * the dialogue options to pick and the items the step needs.
 *
 * The helper is asked a few seconds apart and in the background (its answer comes back later); the
 * bot plays the last answer meanwhile. Nothing here changes the quest: the quest plugins do that
 * when the bot clicks, as for a player.
 */
const ASK_EVERY_MS = 3_000;
const SCENE_RADIUS = 24;

function runtime() {
  try {
    return require("../../quests/QuestHelper.plugin").getRuntime?.() ?? null;
  } catch {
    return null;
  }
}

/** What a client would show the helper around the bot: NPCs, objects and items on the ground. */
function sceneOf(core, player, radius = SCENE_RADIUS) {
  const here = player.getLocation();
  const area = player.getPrivateArea?.() ?? null;
  const npcs = core.World.getNpcsNear(here, radius, area).filter((npc) => npc.isRegistered?.() !== false).map((npc) => {
    const definition = npc.getCurrentDefinition?.(player) ?? npc.getDefinition?.();
    const at = npc.getLocation();
    return {
      index: npc.getIndex(), id: npc.getContentId?.(player) ?? definition?.getId?.() ?? npc.getId(), name: definition?.getName?.() ?? "",
      x: at.getX(), y: at.getY(), z: at.getZ(), combatLevel: definition?.getCombatLevel?.() ?? 0,
      interactingIndex: npc.getInteractingMobile?.()?.getIndex?.() ?? -1,
    };
  });
  const objects = [];
  for (let x = here.getX() - radius; x <= here.getX() + radius; x += 1) {
    for (let y = here.getY() - radius; y <= here.getY() + radius; y += 1) {
      for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, here.getZ())) ?? []) {
        const at = object.getLocation();
        if (at.getX() !== x || at.getY() !== y || object.getId() < 0) continue;
        objects.push({ id: object.getId(), x, y, z: at.getZ(), type: object.getType?.() ?? 10, orientation: object.getFace?.() ?? 0 });
      }
    }
  }
  return { npcs, objects, groundItems: [] };
}

function itemsOf(container) {
  return (container.getItems() ?? []).map((item, slot) => (item && item.getId() >= 0 && item.getAmount() > 0
    ? { slot, id: item.getId(), amount: item.getAmount() } : null)).filter(Boolean);
}

function skillsOf(core, player) {
  const manager = player.getSkillManager();
  const skills = {};
  for (const skill of core.Skill.values()) {
    skills[skill.getName().toUpperCase()] = { real: manager.getMaxLevel(skill), boosted: manager.getCurrentLevel(skill), xp: manager.getExperience(skill) };
  }
  return skills;
}

/** The helper's step as a bot step: { id, kind, ids, npc, at, prefer, needs, text }, or null. */
function toBotStep(core, step) {
  if (!step) return null;
  const target = (step.targets ?? []).find((entry) => entry.x !== undefined) ?? (step.targets ?? [])[0] ?? null;
  const ids = target ? [...new Set([...(target.ids ?? []), ...(target.id === undefined ? [] : [target.id])])] : [];
  const kind = target?.kind ?? "tile";
  let npc = null;
  if (kind === "npc" && ids.length > 0) {
    try {
      npc = core.NpcDefinition.forId(ids[0])?.getName?.() ?? null;
    } catch {
      npc = null;
    }
  }
  // Items the step needs and the bot does not have yet (the helper checked its bag).
  const needs = (step.requirements ?? []).filter((req) => req.met === false && Array.isArray(req.ids) && req.ids.length > 0)
    .map((req) => ({ ids: req.ids, amount: Math.max(1, Number(req.quantity) || 1), name: req.name }));
  return {
    id: step.id ?? null,
    kind,
    ids,
    npc,
    at: target && target.x !== undefined ? [target.x, target.y, target.plane ?? 0] : null,
    prefer: (step.dialogueChoices ?? []).map((choice) => String(choice?.text ?? choice ?? "")).filter(Boolean),
    needs,
    text: (step.text ?? []).join(" "),
  };
}

function createHelperSteps({ core, now = () => Date.now(), log = () => {} }) {
  const asked = new WeakMap();

  function available() {
    return runtime() !== null && typeof process.env.QUEST_HELPER_TOKEN === "string" && process.env.QUEST_HELPER_TOKEN.length >= 24;
  }

  /** The helper's key for a quest name, or null when it does not know the quest. */
  function keyOf(name) {
    const instance = runtime();
    if (!instance) return null;
    const wanted = String(name).toLowerCase();
    return instance.quests().find((quest) => String(quest.name).toLowerCase() === wanted)?.key ?? null;
  }

  /** Asks again when the last answer is old; returns the last answer's step (or null). */
  function current(player, questKey) {
    const state = asked.get(player) ?? { questKey, busy: false, at: 0, step: null, error: null };
    if (state.questKey !== questKey) Object.assign(state, { questKey, busy: false, at: 0, step: null, error: null });
    asked.set(player, state);
    const instance = runtime();
    if (instance && !state.busy && now() - state.at >= ASK_EVERY_MS) {
      state.busy = true;
      state.at = now();
      let snapshot = null;
      try {
        const { collectQuestHelperSnapshot } = require("../../quests/questhelper/Snapshot.QuestHelper");
        snapshot = collectQuestHelperSnapshot({
          nearby: (p) => sceneOf(core, p), items: itemsOf, skills: (p) => skillsOf(core, p), tick: () => core.World.getProcessCycle(),
        }, player, { radius: SCENE_RADIUS });
      } catch (error) {
        state.busy = false;
        state.error = String(error?.message ?? error);
        return state.step;
      }
      instance.evaluateHeadless(player, { questKey, snapshot }).then((result) => {
        state.step = result?.status === "complete" ? { id: "complete", kind: "complete" }
          : result?.status === "unavailable" ? {
            id: "unavailable", kind: "unavailable",
            reason: `quest helper unavailable here: ${(result.diagnostics ?? []).map((d) => d.message ?? d.code).join("; ") || "no step"}`,
          }
            : toBotStep(core, result?.activeStep);
        state.error = null;
      }, (error) => {
        state.error = String(error?.message ?? error);
        log("adventurer_quest_helper_error", { player: player.getUsername?.(), questKey, error: state.error });
      }).finally(() => {
        state.busy = false;
      });
    }
    return state.step;
  }

  return { available, keyOf, current };
}

module.exports = { createHelperSteps, toBotStep, sceneOf };
