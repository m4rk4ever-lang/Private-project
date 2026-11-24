"use strict";

/**
 * Bird snaring as a player does it, through the Hunter plugin: stand among the birds, lay a bird
 * snare from the bag (its item option Lay), check a snare that caught something (the trap's
 * Check: the plugin pays XP and the catch), and take back a snare that fell over. The plugin owns
 * every rule (level, how many traps, whether a bird comes); this only clicks.
 *
 * Net traps the same way (spec.trap "net"): a small fishing net and a rope in the bag, Set-trap on a
 * young tree among the salamanders, Check the net when one hangs in it, and the net and rope
 * picked up again when the trap collapses. Red salamanders (Hunter 59) need no quest, as box traps
 * do (Eagles' Peak): bots with Hunter 40 to 99 had nothing better than birds (21-11-2026).
 *
 * spec: { site: [x, y], radius, trap: "bird" | "net" }.
 */
const { requestMovement } = require("../../behaviours/navigation/Navigation.PlayerBots");
const Loot = require("../Loot.PlayerBots");

const CLICK_MS = 1800;
const LAY_RETRY_MS = 5000;

function createHuntBirdsAction(spec, world) {
  const core = world?.core;
  if (!core) throw new Error("[bot activities] huntBirds requires api.core");
  const snare = core.ItemIdentifiers.BIRD_SNARE;
  const net = spec.trap === "net";
  // What it lays with: one snare, or a net and a rope.
  const tools = net ? [core.ItemIdentifiers.SMALL_FISHING_NET, core.ItemIdentifiers.ROPE] : [snare];
  const carries = (player) => tools.every((id) => player.getInventory().getAmount(id) > 0);
  const TRAP_NAME = /snare|net trap/i;
  const [siteX, siteY] = spec.site;
  const radius = Math.max(2, Number(spec.radius ?? 6));
  const away = (loc, x, y) => Math.max(Math.abs(loc.getX() - x), Math.abs(loc.getY() - y));

  /** A trap near it that offers Check (a bird in it), as [object, clickType], or null. */
  function caughtTrap(player) {
    const here = player.getLocation();
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const x = here.getX() + dx;
        const y = here.getY() + dy;
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, here.getZ())) ?? []) {
          const definition = core.ObjectDefinition.forId(object.getId());
          if (!TRAP_NAME.test(String(definition?.getName?.() ?? ""))) continue;
          const options = (definition.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
          const check = options.indexOf("check");
          if (check >= 0) return [object, check + 1];
        }
      }
    }
    return null;
  }

  /**
   * Its own traps, as the Hunter plugin keeps them (a player knows which traps are his), or null
   * when the plugin is not loaded. A bot clicked the first caught snare near it, often another
   * bot's ("This isn't your trap."), and tried to lay more than its level allows, counting the
   * refusal against the tile and walking off its own snare: 525 bot-minutes for 23 OSRS-XP an hour
   * on the crimson swift beach (bot-logs 23-11-2026; refused=7..10 in the stuck events). On the
   * local server a laid snare held a swift ("Check") within 25 ticks, then fell over unchecked.
   */
  function ownTraps(player) {
    try {
      const { H } = require("../../../skills/hunter/Context.Hunter");
      return [...(H?.traps ?? [])].filter((trap) => trap.player === player);
    } catch {
      return null;
    }
  }

  /** How many traps its level allows, as the plugin counts them; 1 when unknown. */
  function trapLimit(player) {
    try {
      return Number(require("../../../skills/hunter/Traps.Hunter").limit(player, net ? "net" : "bird")) || 1;
    } catch {
      return 1;
    }
  }

  /** Its own trap that wants a click: Check when it caught something, Reset (else Dismantle) when it missed. */
  function ownTrapToClick(traps) {
    for (const trap of traps) {
      const want = trap.state === "caught" ? ["check"] : trap.state === "failed" ? ["reset", "dismantle"] : null;
      const object = want ? trap.objects?.at?.(-1) : null;
      if (!object) continue;
      const options = (core.ObjectDefinition.forId(object.getId())?.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
      for (const name of want) {
        const index = options.indexOf(name);
        if (index >= 0) return [object, index + 1];
      }
    }
    return null;
  }

  /** A young tree near the site it can set a net trap on, as [object, clickType], or null. */
  function youngTree(player) {
    const here = player.getLocation();
    let best = null;
    let bestAway = Infinity;
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const x = siteX + dx;
        const y = siteY + dy;
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(x, y, 0)) ?? []) {
          const definition = core.ObjectDefinition.forId(object.getId());
          if (!/^young tree$/i.test(String(definition?.getName?.() ?? ""))) continue;
          const options = (definition.getInteractions?.() ?? []).map((option) => String(option ?? "").toLowerCase());
          const index = options.indexOf("set-trap");
          if (index < 0) continue;
          const d = away(here, object.getLocation().getX(), object.getLocation().getY());
          if (d < bestAway) { best = [object, index + 1]; bestAway = d; }
        }
      }
    }
    return best;
  }

  function click(player, [object, clickType]) {
    const at = object.getLocation();
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, objectId: object.getId(), clickType, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false,
      }),
    });
  }

  /** Whether a tile can be stood on (a trap goes on the tile it stands on). */
  function walkable(player, x, y) {
    try {
      return !core.RegionManager.blocked?.(new core.Location(x, y, 0), player.getPrivateArea?.() ?? null);
    } catch {
      return true;
    }
  }

  /** The nearest tile of the site a trap may stand on, not one refused before, as { x, y }, or null. */
  function layableNear(player, here, refused, center = null) {
    let best = null;
    let bestAway = Infinity;
    const [cx, cy, reach] = center ? [center.x, center.y, 2] : [siteX, siteY, radius];
    for (let dx = -reach; dx <= reach; dx += 1) {
      for (let dy = -reach; dy <= reach; dy += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (refused?.has(`${x},${y}`) || !walkable(player, x, y)) continue;
        const d = center ? Math.max(Math.abs(dx), Math.abs(dy)) : away(here, x, y);
        if (d > 0 && d < bestAway) { best = { x, y }; bestAway = d; }
      }
    }
    return best;
  }

  const BIRD = /swift|wagtail|longtail|warbler|bird/i;
  /** The nearest bird of the snare's kind within the site's reach, or null. */
  function nearestBird(here) {
    const site = new core.Location(siteX, siteY, 0);
    let best = null;
    let bestAway = Infinity;
    for (const npc of core.World?.getNpcsNear?.(site, radius + 8, null) ?? []) {
      if (!npc || npc.isRegistered?.() === false) continue;
      const name = npc.getDefinition?.()?.getName?.() ?? core.NpcDefinition?.forId?.(npc.getId())?.getName?.() ?? "";
      if (!BIRD.test(String(name))) continue;
      const d = away(here, npc.getLocation().getX(), npc.getLocation().getY());
      if (d < bestAway) {
        best = npc;
        bestAway = d;
      }
    }
    return best;
  }

  return {
    id: "huntBirds",
    update(ctx) {
      const { player, state, nowMs } = ctx;
      if (!player || !state) return "failed";
      const bot = (state.huntBirds ??= { nextAt: 0, layAt: 0 });
      if (nowMs < bot.nextAt || player.busy?.() || player.getMovementQueue().size() > 0) return "running";
      bot.nextAt = nowMs + CLICK_MS;
      const here = player.getLocation();
      if (away(here, siteX, siteY) > radius + 4) {
        requestMovement(player, siteX, siteY, { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
        return "running";
      }
      // A bird in a snare: check it (the plugin hands over the catch and the XP).
      // A full bag: the stretch is done (the catches go to the bank or the exchange).
      if (player.getInventory().getFreeSlots() <= 0) return "success";
      const own = ownTraps(player);
      const trap = own ? ownTrapToClick(own) : caughtTrap(player);
      if (trap) {
        click(player, trap);
        bot.clicked = (bot.clicked ?? 0) + 1;
        return "running";
      }
      // As many traps out as its level allows: it waits by them for a catch, not off laying more.
      if (own && own.length >= trapLimit(player)) {
        const nearest = own.map((entry) => entry.location).filter(Boolean)
          .sort((a, b) => away(here, a.getX(), a.getY()) - away(here, b.getX(), b.getY()))[0];
        if (nearest && away(here, nearest.getX(), nearest.getY()) > 3) {
          requestMovement(player, nearest.getX(), nearest.getY() - 1, { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
        }
        bot.tried = null;
        bot.full = true;
        return "running";
      }
      bot.full = false;
      // A snare that fell over (or a collapsed net trap's net and rope) lies on the ground: take it back.
      const ground = Loot.lootNear(core, player, { radius, minValue: 0, valueOf: () => 1 });
      if (ground && tools.includes(ground.getItem?.()?.getId?.())) {
        Loot.takeStep(core, player, ground, { state, nowMs });
        return "running";
      }
      // A net trap on a young tree (the plugin refuses past its limit for the level, or a tree in use).
      if (net) {
        if (nowMs >= bot.layAt && carries(player)) {
          bot.layAt = nowMs + LAY_RETRY_MS;
          const tree = youngTree(player);
          if (tree) {
            click(player, tree);
            bot.laidAt = "net";
          }
          return "running";
        }
        return carries(player) || bot.laidAt ? "running" : "failed";
      }
      // Lay one from the bag (the plugin refuses past its limit for the level).
      if (nowMs >= bot.layAt && player.getInventory().getAmount(snare) > 0) {
        bot.layAt = nowMs + LAY_RETRY_MS;
        // The last try left the snare in the bag: that tile is refused (grass, a fern, a rock:
        // "You can't set up a trap here"). Patrickbot 10 stood 22 minutes on one such tile among
        // the tropical wagtails with two snares in his bag (21-11-2026).
        if (bot.tried && player.getInventory().getAmount(snare) >= bot.tried.had) (bot.refused ??= new Set()).add(bot.tried.tile);
        bot.tried = null;
        const tileKey = `${here.getX()},${here.getY()}`;
        // Only what the plugin said counts: the precheck of objects on a tile (layable) found none
        // fit on the crimson swift beaches, and those bots never laid a snare (21-11-2026).
        if (bot.refused?.has(tileKey)) {
          const spot = layableNear(player, here, bot.refused);
          if (spot) {
            requestMovement(player, spot.x, spot.y, { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
            bot.layAt = nowMs + 1_500;
          }
          return "running";
        }
        // Where the birds are, as a player lays a snare in their flight path: the nearest bird of
        // the site (crimson swifts fly about the beach) within 2 tiles, else a walk to it first.
        // Laid at the site's centre they went down on empty sand beside the birds.
        const bird = nearestBird(here);
        if (bird && away(here, bird.getLocation().getX(), bird.getLocation().getY()) > 2) {
          const at = bird.getLocation();
          // A tile by the bird where a snare may stand.
          const spot = layableNear(player, here, bot.refused, { x: at.getX(), y: at.getY() })
            ?? { x: at.getX() + Math.floor(Math.random() * 3) - 1, y: at.getY() + Math.floor(Math.random() * 3) - 1 };
          requestMovement(player, spot.x, spot.y, { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
          bot.layAt = nowMs + 1_500;
          return "running";
        }
        // On a tile of its own, a step or two from the last one.
        if (bot.laidAt && bot.laidAt === `${here.getX()},${here.getY()}`) {
          requestMovement(player, siteX + Math.floor(Math.random() * 5) - 2, siteY + Math.floor(Math.random() * 5) - 2,
            { state, nowMs, z: 0, reason: "brain_hunter", basicPather: true });
          return "running";
        }
        const slot = (player.getInventory().getItems() ?? []).findIndex((item) => item?.getId?.() === snare);
        if (slot >= 0 && world.useItem?.(player, slot, "Lay")) {
          bot.laidAt = tileKey;
          bot.tried = { tile: tileKey, had: player.getInventory().getAmount(snare) };
        }
        return "running";
      }
      return player.getInventory().getAmount(snare) > 0 || bot.laidAt ? "running" : "failed";
    },
    describe(ctx) {
      const bot = ctx?.state?.huntBirds;
      const own = ctx?.player ? ownTraps(ctx.player) : null;
      return `huntBirds ${net ? "net" : "snare"} laid=${bot?.laidAt ?? "-"} refused=${bot?.refused?.size ?? 0} carries=${ctx?.player ? carries(ctx.player) : "?"}`
        + ` own=${own ? own.map((trap) => trap.state).join("/") || "0" : "?"} limit=${ctx?.player ? trapLimit(ctx.player) : "?"} clicked=${bot?.clicked ?? 0}`;
    },
    stop(ctx) {
      if (ctx?.state) ctx.state.huntBirds = null;
    },
  };
}

module.exports = { createHuntBirdsAction };
