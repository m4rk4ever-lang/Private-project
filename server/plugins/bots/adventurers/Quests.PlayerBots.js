"use strict";

/**
 * Every quest on this server as an adventurer's to-do list, with its requirements from the
 * cache quest table (the same rows the quest overview and Quest Helper read): required skills,
 * required quests, quest points and combat (required, or recommended when higher).
 *
 * The hand-made path in adventurers.json comes first, in its order and with its own notes merged
 * in. After it the other quests follow, easiest and shortest first, so an adventurer that has done
 * the path keeps going until every quest it can reach is done.
 */
const { metadata } = require("../../quests/QuestList.QuestRuntime");

const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const first = (row, key) => Number(row?.[key]?.[0] ?? 0) || 0;

/** { NAME: level } from a cache [skillId, level, skillId, level, ...] list. */
function skillsFrom(values, Skill) {
  const skills = {};
  if (!Array.isArray(values) || values.length % 2 !== 0) return skills;
  for (let i = 0; i < values.length; i += 2) {
    const skill = Skill.values().find((entry) => entry.getClientId?.() === Number(values[i]));
    if (skill) skills[String(skill.getName()).toUpperCase()] = Number(values[i + 1]);
  }
  return skills;
}

/** One quest's requirements from its cache row (or none when the cache has no row for it). */
function fromRow(name, row, names, Skill) {
  return {
    name,
    skills: skillsFrom(row?.requirement_stats, Skill),
    quests: (row?.requirement_quests ?? []).map((id) => names.get(id)).filter(Boolean),
    questPoints: first(row, "requirement_questpoints"),
    combat: Math.max(first(row, "requirement_combat"), first(row, "recommended_combat")),
    difficulty: first(row, "difficulty"),
    length: first(row, "length"),
  };
}

/** The higher of each requirement: the path's notes and the cache together. */
function merge(cache, own) {
  const skills = { ...cache.skills };
  for (const [skill, level] of Object.entries(own.skills ?? {})) skills[skill] = Math.max(skills[skill] ?? 0, level);
  return {
    ...cache,
    ...own,
    skills,
    quests: [...new Set([...(cache.quests ?? []), ...(own.quests ?? [])])],
    questPoints: Math.max(cache.questPoints ?? 0, own.questPoints ?? 0),
    combat: Math.max(cache.combat ?? 0, own.combat ?? 0),
  };
}

/**
 * The full list: the path first, then every other registered quest by difficulty and length.
 * `registered` are the quests as QuestRuntime registered them; `rows` the cache table by
 * normalized name (QuestList.metadata).
 */
function buildQuestList(path, registered, rows, Skill) {
  const nameByRow = new Map();
  for (const quest of registered) {
    const row = rows.get(normalize(quest.name));
    if (row) nameByRow.set(row.rowId, quest.name);
  }
  // A required quest this server does not have keeps its cache name: it simply never completes.
  for (const row of rows.values()) {
    if (!nameByRow.has(row.rowId) && row.displayname?.[0]) nameByRow.set(row.rowId, String(row.displayname[0]));
  }
  const byName = new Map(registered.map((quest) => [normalize(quest.name), quest.name]));
  const list = [];
  const seen = new Set();
  for (const own of path) {
    const key = normalize(own.name);
    const name = byName.get(key) ?? own.name;
    list.push(merge(fromRow(name, rows.get(key), nameByRow, Skill), { ...own, name }));
    seen.add(key);
  }
  const rest = registered
    .filter((quest) => !seen.has(normalize(quest.name)))
    .map((quest) => fromRow(quest.name, rows.get(normalize(quest.name)), nameByRow, Skill))
    .sort((a, b) => a.difficulty - b.difficulty || a.length - b.length || a.name.localeCompare(b.name));
  return [...list, ...rest];
}

/** Rebuilt when the number of registered quests changes (they register at boot). */
function createQuestList({ core, path, getRegistered }) {
  let built = { size: -1, list: path };
  return function questList() {
    const registered = getRegistered();
    if (built.size !== registered.length) {
      const rows = metadata(core.CacheDefinitions);
      built = { size: registered.length, list: buildQuestList(path, registered, rows, core.Skill) };
    }
    return built.list;
  };
}

module.exports = { buildQuestList, createQuestList, skillsFrom, normalize };
