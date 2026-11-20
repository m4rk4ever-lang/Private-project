"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { questEnd, OUTCOMES } = require("../plugins/bots/adventurers/QuestEnd.PlayerBots");

const run = { name: "Cook's Assistant", step: 3, tries: 2, startedAt: 0, helperKey: "cooks", helperStepId: "talk-cook", reason: "talked but the step did not advance" };

test("quest_end: a failed attempt says where it stopped and why", () => {
  const line = questEnd(run, "failed", { bot: "Testbot", nowMs: 90_000, stage: 1, attempt: 2 });
  assert.deepEqual(line, {
    kind: "quest_end", bot: "Testbot", quest: "Cook's Assistant", outcome: "failed", guide: "quest-helper",
    step: 3, helperStep: "talk-cook", stage: 1, tries: 2, reason: "talked but the step did not advance", minutes: 1.5, attempt: 2,
  });
});

test("quest_end: done has no reason, an explicit reason wins over the run's", () => {
  assert.equal(questEnd(run, "done", { nowMs: 60_000 }).reason, null);
  assert.equal(questEnd(run, "gather", { reason: "gathering clay" }).reason, "gathering clay");
});

test("quest_end: start time from the history when startedAt is missing; unknowns are null", () => {
  const line = questEnd({ name: "X", history: [{ at: "2026-11-20T20:00:00.000Z" }] }, "died", { nowMs: Date.parse("2026-11-20T20:06:00.000Z") });
  assert.equal(line.minutes, 6);
  assert.equal(line.guide, "playthrough");
  assert.equal(line.step, null);
  assert.equal(line.stage, null);
  assert.equal(questEnd(null, "done"), null);
});

test("quest_end: only known outcomes", () => {
  assert.deepEqual(OUTCOMES, ["done", "failed", "gather", "roof", "died", "override"]);
  assert.throws(() => questEnd(run, "maybe"));
});
