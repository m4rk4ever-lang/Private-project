"use strict";

// The level an adventurer activity asks for is the level the skill plugin asks for. mithril_rocks
// said 50 where Mining.plugin.js (as OSRS) says 55: 29 jobs, 676 bot-minutes and 0 XP for bots at
// Mining 50-54 (bot-logs 23-11-2026, versions 441b072 and ceefe7a).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const activities = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/definitions/bot-activities.json"), "utf8")).activities;
const mining = fs.readFileSync(path.join(__dirname, "../plugins/skills/Mining.plugin.js"), "utf8");

/** Mining.plugin.js's rock table: object name -> level. */
function rockLevels() {
  const levels = new Map();
  for (const match of mining.matchAll(/objectName:\s*"([^"]+) rocks"[^}]*?level:\s*(\d+)/g)) levels.set(match[1].toLowerCase(), Number(match[2]));
  return levels;
}

test("bot mining activities ask the level the Mining plugin asks", () => {
  const levels = rockLevels();
  const checked = [];
  for (const activity of activities.filter((entry) => entry.template === "mine_rocks")) {
    for (const tier of [].concat(activity.fields.tier)) {
      const plugin = levels.get(String(tier).toLowerCase());
      if (plugin === undefined) continue;
      assert.ok(activity.fields.level >= plugin, `${activity.id}: level ${activity.fields.level}, the plugin wants ${plugin} for ${tier}`);
      checked.push(activity.id);
    }
  }
  assert.ok(checked.includes("mithril_rocks") && checked.includes("adamantite_rocks") && checked.includes("iron_rocks"), checked.join(","));
});
