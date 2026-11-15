/**
 * ::quest - an admin command to look at or set a player's quest progress, for testing
 * quest-gated content without playing the quest.
 *
 *   ::quest <name>             show the quest's stage
 *   ::quest <name> complete    complete it as the quest itself does (rewards, points, scroll)
 *   ::quest <name> reset       back to not started
 *   ::quest <name> <stage>     set the stage
 *
 *   ::allquests                complete every quest at once for yourself (owner)
 *
 * <name> is a quest's name or key, any case; part of a name works when only one quest matches
 * ("grand tree"). Quest points follow a quest set below or above its completion stage.
 */
const QuestRuntime = require("./QuestRuntime");
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

/**
 * Completes every quest the player hasn't, as a quest pack does: rewards and points, but no
 * scroll or message per quest, then one summary.
 */
function allQuestsCommand({ player }) {
  let completed = 0;
  const failed = [];
  for (const quest of QuestRuntime.getRegisteredQuests()) {
    if (quest.isComplete(player)) continue;
    try {
      if (quest.complete(player, { scroll: false, announce: false })) completed++;
    } catch (error) {
      failed.push(quest.name);
      console.warn(`[quest] ::allquests could not complete ${quest.name}:`, error);
    }
  }
  player.sendMessage(completed === 0 && failed.length === 0
    ? "You have already completed every quest."
    : `Completed ${completed} quest${completed === 1 ? "" : "s"}.`);
  if (failed.length > 0) player.sendMessage(`Could not complete: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ", ..." : ""}.`);
  return true;
}

module.exports = {
  name: "QuestCommand",
  description: "Adds the admin ::quest command to show, set, complete or reset a player's quest stage, for testing quest-gated content.",
  register(api) {
    api.registerCommand("quest", questCommand, PlayerRights.ADMINISTRATOR, "Show or set a quest's progress: ::quest <name> [complete|reset|<stage>]");
    api.registerCommand("allquests", allQuestsCommand, PlayerRights.OWNER, "Complete every quest at once");
  },
  _test: { questCommand, findQuests, allQuestsCommand },
};
