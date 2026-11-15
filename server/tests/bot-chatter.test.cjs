// Run: node --test tests/bot-chatter.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createChatter, contextOf, linesFor, data } = require("../plugins/bots/brain/Chatter.PlayerBots");

function world({ activity = { id: "roam", mode: "roaming" }, place = { id: "grand_exchange" } } = {}) {
  const said = [];
  const bot = { name: "Bot1", isPlayerBot: () => true, isRegistered: () => true, getUsername: () => "Bot1", getLocalPlayers: () => [human] };
  const human = { isPlayerBot: () => false, isRegistered: () => true, getLocalPlayers: () => [bot] };
  const runtime = {
    entriesByUsername: new Map([["Bot1", { brain: { frames: [{ behaviour: activity }] } }]]),
    botStatesByName: new Map([["Bot1", { place }]]),
  };
  const core = { World: { getPlayers: () => [human, bot] }, ChatPacketListener: { handleText: (player, text) => said.push({ player, text }) } };
  let clock = 0;
  const chatter = createChatter({ runtime, core, random: () => 0, now: () => clock, config: { ...data, chancePerCheck: 1 } });
  return { said, bot, human, chatter, advance: (ms) => { clock += ms; } };
}

test("every context has lines, and a bot's context follows where it is and what it does", () => {
  for (const [key, lines] of Object.entries(data.contexts)) assert.ok(lines.length >= 4, key);
  assert.equal(contextOf({ id: "bankstand" }, null), "bankstand");
  assert.equal(contextOf({ id: "wintertodt" }, null), "minigame:wintertodt");
  assert.equal(contextOf({ id: "roam" }, { id: "grand_exchange" }), "grand_exchange");
  assert.equal(contextOf({ id: "roam" }, { id: "x", minigame: "castle_wars" }), "minigame:castle_wars");
  assert.equal(contextOf({ id: "roam" }, { id: "barrows", combatGear: true }), "lobby");
  assert.equal(contextOf({ id: "coal_rocks", mode: "mining" }, null), "mining");
  assert.ok(linesFor("minigame:tithe_farm").length > 0, "an unknown minigame falls back to the general lines");
  for (const line of Object.values(data.contexts).flat()) assert.ok(line.length <= 80, line);
});

test("a bot near a player says a fitting line, then keeps quiet for a while", () => {
  const { said, chatter, advance } = world();
  chatter.tick();
  assert.equal(said.length, 1);
  assert.ok(data.contexts.grand_exchange.includes(said[0].text));
  advance(10_000);
  chatter.tick();
  assert.equal(said.length, 1, "its cooldown holds");
});

test("nobody talks where no player can see", () => {
  const { said, chatter, human, bot } = world();
  bot.getLocalPlayers = () => [];
  human.getLocalPlayers = () => [];
  chatter.tick();
  assert.equal(said.length, 0);
});

test("a greeting gets an answer, a player's level-up a gz, and a bot announces its own level", () => {
  const greet = world();
  greet.chatter.onPublicChat({ player: greet.human, packet: { type: "public_chat", text: "Hey all!" } });
  greet.advance(5000);
  greet.chatter.tick();
  assert.ok(data.greetReplies.includes(greet.said[0]?.text), JSON.stringify(greet.said));

  const gz = world();
  gz.chatter.onLevelUp({ player: gz.human, skill: { getName: () => "MINING" }, newLevel: 60 });
  gz.advance(5000);
  gz.chatter.tick();
  assert.ok(data.congrats.includes(gz.said[0]?.text));

  const own = world();
  own.chatter.onLevelUp({ player: own.bot, skill: { getName: () => "WOODCUTTING" }, newLevel: 72 });
  own.advance(5000);
  own.chatter.tick();
  assert.match(own.said[0]?.text ?? "", /72/);
  assert.match(own.said[0]?.text ?? "", /Woodcutting/);
});

test("bots ignore their own chat", () => {
  const { said, chatter, bot, advance } = world();
  chatter.onPublicChat({ player: bot, packet: { type: "public_chat", text: "hi" } });
  advance(5000);
  assert.equal(chatter.pending.length, 0);
  assert.equal(said.length, 0);
});
