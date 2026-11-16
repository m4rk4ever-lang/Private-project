"use strict";

/**
 * The race between the clans in firsts: the first adventurer to reach something ("first to 50
 * Woodcutting", "first quest", "first 1M bezit") and the first clan to reach something as a clan
 * ("all members combat 40", "clan total 2,000"). Each is won once, by whoever gets there first,
 * with the time; the page shows them (client/public/adventurers.html, "Achievements").
 *
 * Looked at from the adventurers' report (Adventurers.PlayerBots.js report()), so it only counts
 * what the page shows: real levels, real quests, real coins. Kept in data/saves/adventurer-
 * achievements.json; a new generation (adventurers.json `generation`, everyone starts over)
 * starts the race over too.
 */
const fs = require("fs");
const path = require("path");

const SKILL_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];
const TOTAL_LEVELS = [100, 250, 500, 750, 1000, 1500, 2000];
const COMBAT_LEVELS = [20, 30, 40, 50, 70, 90, 100, 126];
const QUEST_POINTS = [1, 10, 25, 50, 100];
const WEALTH = [10_000, 100_000, 1_000_000, 10_000_000];
const CLAN_TOTALS = [500, 1000, 2500, 5000, 10000];
const CLAN_COMBAT = [20, 30, 40, 60, 80, 100];
const CLAN_WEALTH = [100_000, 1_000_000, 10_000_000, 100_000_000];

const skillName = (key) => key.charAt(0).toUpperCase() + key.slice(1);
const gp = (amount) => amount >= 1_000_000 ? `${amount / 1_000_000}M` : amount >= 1000 ? `${amount / 1000}k` : String(amount);

/** Every player first: { id, label, group, reached(adventurer) }. */
function playerGoals(skills) {
  const goals = [];
  for (const skill of skills) {
    for (const level of SKILL_LEVELS) {
      goals.push({ id: `skill:${skill}:${level}`, group: skillName(skill), label: `Eerste met ${level} ${skillName(skill)}`,
        reached: (a) => (a.skills?.[skill]?.level ?? 1) >= level });
    }
  }
  for (const level of TOTAL_LEVELS) goals.push({ id: `total:${level}`, group: "Totaal", label: `Eerste met totaal level ${level}`, reached: (a) => (a.total ?? 0) >= level });
  for (const level of COMBAT_LEVELS) goals.push({ id: `combat:${level}`, group: "Combat", label: `Eerste met combat level ${level}`, reached: (a) => (a.combat ?? 0) >= level });
  goals.push({ id: "quest:first", group: "Quests", label: "Eerste quest voltooid", reached: (a) => (a.quests?.length ?? 0) >= 1 });
  for (const points of QUEST_POINTS) goals.push({ id: `qp:${points}`, group: "Quests", label: `Eerste met ${points} questpunten`, reached: (a) => (a.questPoints ?? 0) >= points });
  for (const amount of WEALTH) goals.push({ id: `wealth:${amount}`, group: "Bezit", label: `Eerste met ${gp(amount)} bezit`, reached: (a) => (a.wealth?.total ?? 0) >= amount });
  goals.push({ id: "boss:first", group: "Bosses", label: "Eerste boss verslagen", reached: (a) => (a.journal ?? []).some((line) => line.type === "boss") });
  return goals;
}

/** Every clan first: reached(members). */
function clanGoals() {
  const goals = [];
  for (const total of CLAN_TOTALS) goals.push({ id: `clan-total:${total}`, label: `Eerste clan met samen totaal level ${total}`, reached: (m) => m.reduce((s, a) => s + (a.total ?? 0), 0) >= total });
  for (const level of CLAN_COMBAT) goals.push({ id: `clan-combat:${level}`, label: `Eerste clan waarvan iedereen combat ${level} heeft`, reached: (m) => m.length > 0 && m.every((a) => (a.combat ?? 0) >= level) });
  for (const amount of CLAN_WEALTH) goals.push({ id: `clan-wealth:${amount}`, label: `Eerste clan met samen ${gp(amount)} bezit`, reached: (m) => m.reduce((s, a) => s + (a.wealth?.total ?? 0), 0) >= amount });
  goals.push({ id: "clan-quests:all", label: "Eerste clan waarvan iedereen een quest heeft voltooid", reached: (m) => m.length > 0 && m.every((a) => (a.quests?.length ?? 0) > 0) });
  return goals;
}

function createAchievements({ file = path.join(process.cwd(), "data", "saves", "adventurer-achievements.json"), generation = 1, now = () => Date.now() } = {}) {
  let state = { generation, won: {} };
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved?.generation === generation && saved.won && typeof saved.won === "object") state = saved;
  } catch {
    // None yet, or unreadable: the race starts now.
  }
  let goals = null;
  let clans = null;

  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 1));
      fs.renameSync(`${file}.tmp`, file);
    } catch {
      // A failed write is tried again with the next win.
    }
  }

  /** New firsts in this report, won by whoever has them now. Returns the new wins. */
  function update(report) {
    const online = report.filter((a) => a.skills && Object.keys(a.skills).length > 0);
    if (online.length === 0) return [];
    goals ??= playerGoals(Object.keys(online[0].skills));
    clans ??= clanGoals();
    const at = now();
    const wins = [];
    for (const goal of goals) {
      if (state.won[goal.id]) continue;
      const winners = online.filter(goal.reached);
      if (winners.length === 0) continue;
      // Reached in the same look: the one furthest along wins (most total levels).
      const winner = winners.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0];
      state.won[goal.id] = { name: winner.name, clan: winner.clan ?? null, at };
      wins.push({ ...goal, ...state.won[goal.id] });
    }
    const byClan = new Map();
    for (const a of report) if (a.clan) byClan.set(a.clan, [...(byClan.get(a.clan) ?? []), a]);
    for (const goal of clans) {
      if (state.won[goal.id]) continue;
      const reached = [...byClan.entries()].filter(([, members]) => members.every((m) => m.skills && Object.keys(m.skills).length > 0) && goal.reached(members));
      if (reached.length === 0) continue;
      state.won[goal.id] = { name: null, clan: reached[0][0], at };
      wins.push({ ...goal, ...state.won[goal.id] });
    }
    if (wins.length > 0) save();
    return wins;
  }

  /** For the page: every first won so far, newest first, and the count per clan. */
  function view() {
    const labels = new Map([...(goals ?? []), ...(clans ?? clanGoals())].map((goal) => [goal.id, goal]));
    const won = Object.entries(state.won).map(([id, win]) => ({ id, label: labels.get(id)?.label ?? id, group: labels.get(id)?.group ?? (id.startsWith("clan-") ? "Clan" : ""), clanGoal: id.startsWith("clan-"), ...win }))
      .sort((a, b) => b.at - a.at);
    const perClan = {};
    for (const win of won) if (win.clan) perClan[win.clan] = (perClan[win.clan] ?? 0) + 1;
    return { won, perClan, open: (goals?.length ?? 0) + (clans?.length ?? 0) - won.length };
  }

  return { update, view };
}

module.exports = { createAchievements, playerGoals, clanGoals };
