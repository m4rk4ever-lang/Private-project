/**
 * ::quest - an admin command to look at or set a player's quest progress, for testing
 * quest-gated content without playing the quest.
 *
 *   ::quest <name>             show the quest's stage
 *   ::quest <name> complete    complete it as the quest itself does (rewards, points, scroll)
 *   ::quest <name> reset       back to not started
 *   ::quest <name> <stage>     set the stage
 *
 *   ::allquests                mark every quest complete for yourself, without rewards (owner)
 *
 * <name> is a quest's name or key, any case; part of a name works when only one quest matches
 * ("grand tree"). Quest points follow a quest set below or above its completion stage.
 */
const QuestRuntime = require("./QuestRuntime");
const { metadata, questMetadata } = require("./QuestList.QuestRuntime");
const progressVars = require("./data/quest-progress-vars.json").rows;

/**
 * Quests and miniquests in the cache's quest list that no plugin implements, marked complete by
 * ::allquests: { varps: { id: value }, varbits: { id: value } }, sent again at every login.
 */
const MARKED_COMPLETE_ATTRIBUTE = "quest-command:marked-complete";
const RESEND_DELAY_TICKS = 2;

let api = null;
const { PlayerRights } = require("../../src/main/typescript/elvarg/game/model/rights/PlayerRights");

const USAGE = "Usage: ::quest <name> [complete|reset|<stage>]";

function normalise(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The one quest a name means: an exact name or key first, then a unique partial match. */
function findQuests(text) {
  const wanted = normalise(text);
  const quests = QuestRuntime.getRegisteredQuests();
  const exact = quests.filter((quest) => normalise(quest.name) === wanted || normalise(quest.key) === wanted ||
    normalise(quest.name).replace(/^the /, "") === wanted);
  return exact.length > 0 ? exact : quests.filter((quest) => normalise(quest.name).includes(wanted));
}

function addQuestPoints(player, delta) {
  const points = Math.max(0, (Number(player.getAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE)) || 0) + delta);
  player.setAttribute(QuestRuntime.QUEST_POINTS_ATTRIBUTE, points);
  player.getPacketSender().sendConfig(QuestRuntime.QUEST_POINTS_VARP, points);
}

/** Sets a stage directly, keeping the quest points in step when it crosses completion. */
function setStage(player, quest, stage) {
  const wasComplete = quest.isComplete(player);
  quest.setStage(player, stage);
  const isComplete = quest.isComplete(player);
  if (wasComplete !== isComplete) addQuestPoints(player, (isComplete ? 1 : -1) * (quest.questPoints || 0));
}

function describe(player, quest) {
  const state = quest.isComplete(player) ? "complete" : quest.isStarted(player) ? "started" : "not started";
  return `${quest.name}: stage ${quest.getStage(player)} (${state}; completes at ${quest.completionValue ?? 2}).`;
}

function questCommand({ player, parts }) {
  const args = parts.slice(1);
  const last = String(args.at(-1) ?? "").toLowerCase();
  const action = last === "complete" || last === "reset" || /^\d+$/.test(last) ? last : null;
  const name = (action ? args.slice(0, -1) : args).join(" ");
  if (!name) {
    player.sendMessage(USAGE);
    return true;
  }
  const matches = findQuests(name);
  if (matches.length !== 1) {
    player.sendMessage(matches.length === 0
      ? `No quest matches "${name}".`
      : `"${name}" matches ${matches.length} quests: ${matches.slice(0, 5).map((quest) => quest.name).join(", ")}${matches.length > 5 ? ", ..." : ""}.`);
    return true;
  }
  const [quest] = matches;
  if (action === "complete") {
    if (!quest.complete(player)) player.sendMessage(`${quest.name} is already complete.`);
  } else if (action === "reset") {
    setStage(player, quest, 0);
  } else if (action !== null) {
    setStage(player, quest, Number(action));
  }
  player.sendMessage(describe(player, quest));
  return true;
}

/** Sets a quest list row's progress variable on the client and the server's copy. */
function sendProgress(player, kind, id, value) {
  const sender = player.getPacketSender();
  if (kind === "varbit") sender.sendVarbit(id, value);
  else sender.sendConfig(id, value);
}

/**
 * The cache quest list's rows that no registered quest covers and that have a known progress
 * variable and end state: the quests and miniquests without a plugin of their own.
 */
function unimplementedRows(cache) {
  const covered = new Set(QuestRuntime.getRegisteredQuests()
    .map((quest) => questMetadata(quest, cache)?.rowId).filter((rowId) => rowId !== undefined));
  return [...metadata(cache).values()].filter((row) => row.release_type?.[0] !== 0
    && !covered.has(row.rowId) && Number.isInteger(row.endstate?.[0]) && row.endstate[0] >= 0
    && progressVars[String(row.rowId)]);
}

/** Marks the unimplemented rows complete (remembered for the next login); returns how many it marked. */
function markUnimplementedComplete(player, cache) {
  const marked = player.getAttribute(MARKED_COMPLETE_ATTRIBUTE) ?? { varps: {}, varbits: {} };
  let count = 0;
  let points = 0;
  for (const row of unimplementedRows(cache)) {
    const vars = progressVars[String(row.rowId)];
    const kind = Number.isInteger(vars.varbit) ? "varbit" : "varp";
    const id = vars[kind];
    const end = row.endstate[0];
    const table = kind === "varbit" ? marked.varbits : marked.varps;
    if (table[id] === end) continue;
    table[id] = end;
    sendProgress(player, kind, id, end);
    count++;
    if ((row.type?.[0] ?? 0) === 0 && !row.parent_quest?.length) {
      points += Number((row.questpoints_override ?? row.questpoints)?.[0] ?? 0);
    }
  }
  player.setAttribute(MARKED_COMPLETE_ATTRIBUTE, marked);
  if (points > 0) addQuestPoints(player, points);
  return count;
}

/**
 * Marks every quest the player hasn't done as complete: the completion stage and quest points
 * only, without rewards (no items, experience, scroll or messages). Quests and miniquests that
 * no plugin implements are marked complete in the quest list too. Then one summary.
 */
function allQuestsCommand({ player }) {
  let completed = 0;
  const failed = [];
  for (const quest of QuestRuntime.getRegisteredQuests()) {
    if (quest.isComplete(player)) continue;
    try {
      setStage(player, quest, quest.completionValue ?? 2);
      completed++;
    } catch (error) {
      failed.push(quest.name);
      console.warn(`[quest] ::allquests could not complete ${quest.name}:`, error);
    }
  }
  completed += markUnimplementedComplete(player, api?.core?.CacheDefinitions);
  QuestRuntime.refreshQuestList(player);
  player.sendMessage(completed === 0 && failed.length === 0
    ? "You have already completed every quest."
    : `Marked ${completed} quest${completed === 1 ? "" : "s"} as complete (no rewards).`);
  if (failed.length > 0) player.sendMessage(`Could not complete: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ", ..." : ""}.`);
  return true;
}

/** After the login's own quest varps: the rows ::allquests marked complete, again. */
function resendMarkedComplete({ player }) {
  const marked = player.getAttribute(MARKED_COMPLETE_ATTRIBUTE);
  if (!marked) return;
  const { Task, TaskManager } = api.core;
  TaskManager.submit(new (class extends Task {
    constructor() { super(RESEND_DELAY_TICKS, player, false); }
    execute() {
      this.stop();
      for (const [id, value] of Object.entries(marked.varps ?? {})) sendProgress(player, "varp", Number(id), value);
      for (const [id, value] of Object.entries(marked.varbits ?? {})) sendProgress(player, "varbit", Number(id), value);
      QuestRuntime.refreshQuestList(player);
    }
  })());
}

function init(pluginApi) {
  api = pluginApi;
}

module.exports = {
  name: "QuestCommand",
  description: "Adds the admin ::quest command to show, set, complete or reset a player's quest stage, for testing quest-gated content.",
  register(api) {
    init(api);
    api.persistAttribute(MARKED_COMPLETE_ATTRIBUTE);
    api.onPlayerLogin(resendMarkedComplete);
    api.registerCommand("quest", questCommand, PlayerRights.ADMINISTRATOR, "Show or set a quest's progress: ::quest <name> [complete|reset|<stage>]");
    api.registerCommand("allquests", allQuestsCommand, PlayerRights.OWNER, "Mark every quest complete, without rewards");
  },
  _test: { questCommand, findQuests, allQuestsCommand, markUnimplementedComplete, unimplementedRows, init, MARKED_COMPLETE_ATTRIBUTE },
};
