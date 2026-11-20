// Run: node --test tests/bot-watch.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const Watch = require("../plugins/bots/runtime/Watch.PlayerBots");

function loc(x, y, z = 0) {
  return { getX: () => x, getY: () => y, getZ: () => z, clone: () => loc(x, y, z) };
}

function actor(name, at, index) {
  const p = {
    at, index, hidden: false, blocked: false, untargetable: false, fixed: null, camera: [], messages: [],
    getDisplayName: () => name, getUsername: () => name.toLowerCase(), getIndex: () => index,
    isRegistered: () => true, isNeedsPlacement: () => false,
    getLocation: () => p.at, moveTo: (to) => { p.at = to; },
    isAppearanceHidden: () => p.hidden, setAppearanceHidden: (v) => { p.hidden = v; },
    getFixedViewDistance: () => p.fixed, setFixedViewDistance: (v) => { p.fixed = v; },
    isUntargetable: () => p.untargetable, setUntargetable: (v) => { p.untargetable = v; },
    getMovementQueue: () => ({ reset() { return this; }, setBlockMovement: (v) => { p.blocked = v; }, isMovementBlocked: () => p.blocked }),
    getPacketSender: () => ({
      getCameraState: () => ({ mode: "follow" }),
      restoreCameraState: (state) => p.camera.push(["restore", state.mode]),
      sendCameraTarget: (target) => p.camera.push(["target", target.player]),
      sendItemContainer: (container) => p.camera.push(["inventory", container.getItems()[0].getAmount()]),
      sendSkillsSnapshotOf: (subject) => p.camera.push(["skills-of", subject.getIndex()]),
      sendSkillsSnapshot: () => p.camera.push(["own-skills"]),
      sendInventory: (id, capacity, items) => p.camera.push(["worn", items[0]?.id]),
    }),
    sendMessage: (text) => p.messages.push(text),
    items: [{ getId: () => 995, getAmount: () => index }],
    getInventory: () => ({ getItems: () => p.items, refreshItems: () => p.camera.push(["own-inventory"]) }),
    getEquipment: () => ({ getItems: () => [{ getId: () => 1000 + index, getAmount: () => 1 }] }),
    getSkillManager: () => ({ getTotalLevel: () => 100 + index, getTotalExp: () => 5000 }),
    getHitpoints: () => 10,
  };
  return p;
}

test("::volg keeps the camera on the bot and moves the hidden watcher along; stopping puts it back", () => {
  const me = actor("Mark", loc(3222, 3218), 1);
  const bot = actor("Call me Mark", loc(3165, 3487), 7);
  Watch.start(me, bot);
  assert.equal(me.hidden, true);
  assert.equal(me.untargetable, true);
  assert.equal(me.blocked, true);
  Watch.tick();
  assert.deepEqual(me.camera.at(-1), ["target", 7]);
  assert.ok(me.camera.some(([kind, value]) => kind === "inventory" && value === 7), "the bot's inventory");
  assert.ok(me.camera.some(([kind, value]) => kind === "skills-of" && value === 7), "the bot's stats");
  assert.ok(me.camera.some(([kind, value]) => kind === "worn" && value === 1007), "the bot's worn gear");
  const sent = me.camera.length;
  Watch.tick();
  assert.equal(me.camera.length, sent, "nothing new while nothing changed");
  bot.at = loc(3165 + Watch.KEEP_WITHIN + 5, 3487);
  Watch.tick();
  assert.equal(me.at.getX(), bot.at.getX(), "moved along when the bot walked out of view");
  Watch.stop(me);
  assert.equal(me.hidden, false);
  assert.equal(me.blocked, false);
  assert.equal(me.at.getX(), 3222, "back where it stood");
  assert.deepEqual(me.camera.at(-1), ["restore", "follow"]);
  assert.ok(me.camera.some(([kind]) => kind === "own-inventory") && me.camera.some(([kind]) => kind === "own-skills"), "own tabs back");
  assert.deepEqual(me.camera.filter(([kind]) => kind === "worn").at(-1), ["worn", 1001], "own gear back");
  assert.equal(Watch.watching.size, 0);
});

test("a name with spaces finds the bot by display name", () => {
  const bot = actor("Call me Mark", loc(1, 1), 3);
  const core = { World: { players: { search: (fn) => [bot].find(fn) } } };
  assert.equal(Watch.findPlayer(core, "call  me mark"), bot);
  assert.equal(Watch.findPlayer(core, "nobody"), null);
});

test("::volg shows goal, activity and reason, the route, and the rates now and then (§30, §31)", () => {
  const { statusLines } = require("../plugins/bots/runtime/Watch.PlayerBots");
  const status = { goal: "60 Attack voor dragon scimitar", activity: "combat training (cows)", reason: "achterstand",
    skill: "attack", phase: "training", route: null, place: "lumbridge", wealth: 12345, xpPerHour: 18000 };
  const first = statusLines("Markbot 10", status, {}, { nowMs: 0, force: true });
  assert.deepEqual(first.lines, [
    "[Markbot 10] Doel: 60 Attack voor dragon scimitar | Bezig: combat training (cows) | Reden: achterstand",
    "[Markbot 10] 18.000 XP/uur (attack) | Vermogen: 12.345 gp | Bij: lumbridge",
  ]);
  const same = statusLines("Markbot 10", status, first.shown, { nowMs: 10_000 });
  assert.deepEqual(same.lines, [], "nothing changed: nothing said");
  const errand = statusLines("Markbot 10", { ...status, route: { to: "de Grand Exchange", why: "handelen op de GE" } }, same.shown, { nowMs: 20_000 });
  assert.deepEqual(errand.lines, ["[Markbot 10] Onderweg naar de Grand Exchange: handelen op de GE."]);
  const later = statusLines("Markbot 10", { ...status, xpPerHour: null }, errand.shown, { nowMs: 2 * 60_000 });
  assert.deepEqual(later.lines, ["[Markbot 10] XP/uur nog onbekend (attack) | Vermogen: 12.345 gp | Bij: lumbridge"]);
  assert.deepEqual(statusLines("Speler", null, {}, { force: true }).lines, [], "not an adventurer: no lines");
});
