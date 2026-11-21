const assert = require('node:assert/strict');
const { test } = require('node:test');
const SlowEntries = require('../plugins/bots/runtime/SlowEntries.PlayerBots');

test('a long bot turn reaches the listener; a listener that throws stops nothing', () => {
  const seen = [];
  SlowEntries.onSlow('broken', () => { throw new Error('boom'); });
  SlowEntries.onSlow('test', (event) => seen.push(event));
  SlowEntries.report({ kind: 'entry', ms: 900 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].ms, 900);
  SlowEntries.onSlow('test', (event) => seen.push({ replaced: event.ms }));
  SlowEntries.report({ kind: 'tick', ms: 2500 });
  assert.deepEqual(seen[1], { replaced: 2500 }, 'one listener per name');
});

test('the brain snapshot is cheap and never throws', () => {
  const entry = { state: { mode: 'skilling' }, brain: { frames: [{ behaviour: { id: 'herblore' } }] } };
  assert.deepEqual(SlowEntries.brainNow(entry), { mode: 'skilling', activity: 'herblore', frames: 1 });
  assert.deepEqual(SlowEntries.brainNow(null), { mode: null, activity: null, frames: 0 });
  assert.equal(typeof SlowEntries.planMs(), 'number');
});
