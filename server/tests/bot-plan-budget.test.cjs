const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canPlan, chargePlan, resetPlanBudget, takePlanSpent, PLAN_BUDGET_MS } = require('../plugins/bots/behaviours/navigation/LongRoutePlanner.PlayerBots');

test('a long search is owed: no new search until it is paid off, however much wall time it took', () => {
  // 21-11-2026: the old window reset on wall time, so after a 2,5 s search the next bot found a
  // fresh window and searched too (ticks of 15 to 27 s after a restart).
  resetPlanBudget();
  const t0 = 1_000_000;
  assert.equal(canPlan(t0), true);
  chargePlan('route', 2_500);
  assert.equal(canPlan(t0 + 2_500), false, 'the same tick, after the search: owed');
  assert.equal(canPlan(t0 + 600 * 30), false, 'still owed after 30 ticks (60 ms a tick pays 1.800 ms)');
  assert.equal(canPlan(t0 + 600 * 43), true, 'paid off after about 2.440 / 60 ticks');
});

test('short searches share the allowance within a tick, and it refills with time', () => {
  resetPlanBudget();
  const t0 = 2_000_000;
  assert.equal(canPlan(t0), true);
  chargePlan('stairs', PLAN_BUDGET_MS - 1);
  assert.equal(canPlan(t0), true, 'one ms left');
  chargePlan('exit', 5);
  assert.equal(canPlan(t0), false, 'spent');
  assert.equal(canPlan(t0 + 600), true, 'the next tick has an allowance again');
  const spent = takePlanSpent();
  assert.equal(spent.stairs.count, 1);
  assert.equal(spent.exit.totalMs, 5);
  assert.deepEqual(Object.keys(takePlanSpent()), ['owedMs'], 'read once');
});
