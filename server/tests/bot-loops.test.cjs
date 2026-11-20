// Run: node --test tests/bot-loops.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoopGuard, LOOP_REPEATS, LOOP_BLOCK_MS } = require("../plugins/bots/adventurers/Loops.PlayerBots");

const GE = "3164,3487,0";

test("the same errand again and again without XP is a loop: reported once, then refused a while", () => {
  let clock = 0;
  const guard = createLoopGuard({ now: () => clock });
  const entry = {};
  let report = null;
  for (let i = 0; i < LOOP_REPEATS; i += 1) {
    assert.equal(guard.blocked(entry, "exchange", GE), false);
    report = guard.record(entry, "exchange", GE, { to: "de Grand Exchange" });
    if (i < LOOP_REPEATS - 1) assert.equal(report, null, `not a loop after ${i + 1}`);
    clock += 2_000;
  }
  assert.equal(report.repeats, LOOP_REPEATS);
  assert.equal(report.seconds, (LOOP_REPEATS - 1) * 2);
  assert.equal(report.recent.at(-1).to, "de Grand Exchange");
  assert.equal(guard.blocked(entry, "exchange", GE), true);
  assert.equal(guard.blocked(entry, "withdraw", GE), false, "only that errand");
  assert.equal(guard.record(entry, "exchange", GE), null, "reported once, counting starts afresh");
  clock += LOOP_BLOCK_MS;
  assert.equal(guard.blocked(entry, "exchange", GE), false, "allowed again after the block");
});

test("XP in between is progress: a bank trip per load is no loop", () => {
  let clock = 0;
  const guard = createLoopGuard({ now: () => clock });
  const entry = {};
  for (let i = 0; i < LOOP_REPEATS * 3; i += 1) {
    assert.equal(guard.record(entry, "withdraw", "3185,3436,0", { progressAt: clock - 1_000 }), null);
    clock += 60_000;
  }
});

test("spread out over more than the window is no loop; quest walks have their own limits", () => {
  let clock = 0;
  const guard = createLoopGuard({ now: () => clock });
  const entry = {};
  for (let i = 0; i < LOOP_REPEATS * 2; i += 1) {
    assert.equal(guard.record(entry, "bank", "3092,3243,0"), null);
    clock += 60_000;
  }
  for (let i = 0; i < LOOP_REPEATS * 2; i += 1) assert.equal(guard.record(entry, "quest", "3208,3220,0"), null);
});
