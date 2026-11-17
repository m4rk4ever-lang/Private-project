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

/** The cache definitions of the scene's objects, as the client builds them (QuestHelperDefinitions). */
function objectDefinitions(core, objects) {
  const out = {};
  const describe = (type) => ({
    id: type.id, name: type.name, sizeX: type.sizeX, sizeY: type.sizeY,
    impostorIds: type.transforms ? [...type.transforms] : null, actions: type.actions ? [...type.actions] : undefined,
    animationId: type.seqId, mapSceneId: type.mapSceneId, mapIconId: type.mapFunctionId,
  });
  for (const id of new Set((objects ?? []).map((object) => object.id))) {
    if (Object.keys(out).length >= 2048) break;
    try {
      const type = core.CacheDefinitions.getObject(id);
      if (type) out[id] = { ...describe(type), impostor: null };
    } catch {
      // An id the cache does not have stays out; the helper reports it.
    }
  }
  return out;
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

  // The bridge did not answer (not running, restarting): no new helper quests for a while.
  let downUntil = 0;
  // Failed answers in a row: one alone (a busy moment) does not switch the helper off.
  let failures = 0;
  // Questions in flight at once: thirty adventurers in a quest sweep asked all together, and the
  // bridge choked on it ("fetch failed" for all). The rest ask a moment later.
  const MAX_IN_FLIGHT = 4;
  let inFlight = 0;

  function available() {
    return runtime() !== null && typeof process.env.QUEST_HELPER_TOKEN === "string" && process.env.QUEST_HELPER_TOKEN.length >= 24
      && now() >= downUntil;
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
    if (instance && !state.busy && now() - state.at >= ASK_EVERY_MS && inFlight < MAX_IN_FLIGHT) {
      state.busy = true;
      inFlight += 1;
      state.at = now();
      let snapshot = null;
      try {
        const { collectQuestHelperSnapshot } = require("../../quests/questhelper/Snapshot.QuestHelper");
        const built = collectQuestHelperSnapshot({
          nearby: (p) => sceneOf(core, p), items: itemsOf, skills: (p) => skillsOf(core, p), tick: () => core.World.getProcessCycle(),
        }, player, { radius: SCENE_RADIUS });
        // What a client sends with its scene: the objects' cache definitions (the helper reads
        // their names and options; without them it answers "unavailable").
        snapshot = { ...built, objectDefinitions: objectDefinitions(core, built.objects) };
      } catch (error) {
        state.busy = false;
        inFlight -= 1;
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
        // What the guide recommends bringing (food, teleports, an antipoison) and the bot lacks.
        const recommended = result?.overview?.itemRecommended;
        if (Array.isArray(recommended)) {
          state.recommended = recommended.filter((req) => req && req.met === false && Array.isArray(req.ids) && req.ids.length > 0)
            .map((req) => ({ ids: req.ids, amount: Math.max(1, Number(req.quantity) || 1), name: req.name }));
        }
        state.error = null;
        failures = 0;
      }, (error) => {
        state.error = String(error?.message ?? error);
        // No bridge to talk to three times in a row: no new helper quests for two minutes, while
        // the game starts it again (keepBridgeUp).
        if (/fetch failed|ECONNREFUSED|engine hasn't been started|not configured/i.test(state.error) && (failures += 1) >= 3) {
          downUntil = now() + 2 * 60_000;
        }
        log("adventurer_quest_helper_error", { player: player.getUsername?.(), questKey, error: state.error });
      }).finally(() => {
        state.busy = false;
        inFlight -= 1;
      });
    }
    return state.step;
  }

  /** What the helper last said for this player: its error, how long ago it answered. */
  function status(player) {
    const state = asked.get(player);
    if (!state) return null;
    return { error: state.error, answeredMsAgo: state.at ? now() - state.at : null, busy: state.busy, step: state.step?.id ?? null };
  }

  /** The items the guide recommends for this quest that the bot does not carry yet. */
  function recommended(player) {
    return asked.get(player)?.recommended ?? [];
  }

  return { available, keyOf, current, status, recommended };
}

module.exports = { createHelperSteps, toBotStep, sceneOf };
