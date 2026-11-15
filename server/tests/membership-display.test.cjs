// Run: node --test tests/membership-display.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const MembershipDisplay = require("../plugins/interface/MembershipDisplay.plugin");

const { showMembership, init, ACCOUNT_CREDIT_VARP, UNLIMITED_CREDIT, ACCOUNT_INFO_UPDATE_SCRIPT, BILLING_TEXT_UID, BILLING_TEXT } =
  MembershipDisplay._test;

function setup(membersWorld) {
  const tasks = [];
  class Task {
    constructor(delay) { this.delay = delay; this.stopped = false; }
    stop() { this.stopped = true; }
  }
  init({ core: { Task, TaskManager: { submit: (task) => tasks.push(task) }, WorldDefinition: { isMembersWorld: () => membersWorld } } });
  const sent = [];
  const sender = {
    sendConfig: (id, value) => { sent.push(["varp", id, value]); return sender; },
    sendClientScript: (id, ...args) => { sent.push(["script", id, ...args]); return sender; },
    sendString: (text, uid) => { sent.push(["text", uid, text]); return sender; },
  };
  const player = { getPacketSender: () => sender, isRegistered: () => true };
  return { tasks, sent, player };
}

test("a members world shows unlimited membership: credit varp, member script, then the text", () => {
  const { tasks, sent, player } = setup(true);
  showMembership({ player });
  assert.deepEqual(sent, [
    ["varp", ACCOUNT_CREDIT_VARP, UNLIMITED_CREDIT],
    ["script", ACCOUNT_INFO_UPDATE_SCRIPT, 1, 0, 0],
  ]);
  assert.ok(UNLIMITED_CREDIT > 99999, "above what the cache shows as days");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].delay, 2);
  tasks[0].execute();
  assert.deepEqual(sent.at(-1), ["text", BILLING_TEXT_UID, BILLING_TEXT]);
  assert.equal(BILLING_TEXT_UID, (109 << 16) | 31);
});

test("a free-to-play world and bots are left alone", () => {
  const f2p = setup(false);
  showMembership({ player: f2p.player });
  assert.deepEqual(f2p.sent, []);
  const members = setup(true);
  showMembership({ player: { ...members.player, isPlayerBot: () => true } });
  assert.deepEqual(members.sent, []);
});
