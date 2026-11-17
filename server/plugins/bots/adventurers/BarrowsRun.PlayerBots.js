"use strict";

/**
 * A Barrows run for an adventurer, played as a player does (plugins/minigames/Barrows.plugin.js
 * holds the minigame; "barrows:bot-view" says what a player sees there):
 *
 * 1. To the Barrows (a teleport if it has one, else on foot through Morytania).
 * 2. Each brother's mound in turn: dig in with the spade, search the sarcophagus, fight the
 *    brother that rises (the protection prayer and the prayer potions are the manager's, as for
 *    every fight), up the stairs again. The crypt with the hidden tunnel is left for last.
 * 3. That crypt: search it, "Yeah I'm fearless!", through the tunnels room by room to the chest
 *    room (doors that open, the puzzle door's right answer), open the chest, fight the last
 *    brother, loot the chest.
 * 4. Home teleport out; the loot is kept or sold as all its loot is.
 *
 * tick() returns "running", "done" (looted) or "failed" (with entry.barrows.why).
 */

const BARROWS = { x: 3565, y: 3289, z: 0, name: "de Barrows" };
const ACTION_MS = 1_200;
// No progress for this long (a door that will not open, a brother it cannot reach): given up.
const STUCK_MS = 4 * 60_000;
const MAX_RUN_MS = 45 * 60_000;
const FEARLESS = /fearless/i;

function createBarrowsRun({ core, api, world, note, metric, walkTo, errandBusy, castHome }) {
  const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const here = (player) => {
    const at = player.getLocation();
    return { x: at.getX(), y: at.getY(), z: at.getZ() };
  };

  function view(player) {
    const request = { player, view: null };
    api.emitCustomEvent("barrows:bot-view", request);
    return request.view;
  }

  /** The object with one of these ids within `radius` of the spot, nearest first. */
  function objectNear(at, ids, radius = 8) {
    let best = null;
    let bestAway = Infinity;
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (const object of core.MapObjects?.mapObjects?.get?.(core.MapObjects.getHash(at.x + dx, at.y + dy, at.z)) ?? []) {
          if (!ids.includes(object.getId())) continue;
          const away = Math.max(Math.abs(dx), Math.abs(dy));
          if (away < bestAway) { bestAway = away; best = object; }
        }
      }
    }
    return best;
  }

  /** Clicks an object's first (or given) option, walking up to it as a click does. */
  function click(player, object, clickType = 1) {
    if (!object) return false;
    const definition = (() => {
      try { return core.ObjectDefinition.forPlayer?.(object.getId(), player) ?? core.ObjectDefinition.forId(object.getId()); } catch { return core.ObjectDefinition.forId(object.getId()); }
    })();
    const location = object.getLocation();
    player.getMovementQueue().walkToObject(object, {
      execute: () => world.emitObjectInteraction?.({
        player, object, definition, objectId: object.getId(), clickType,
        location: { x: location.getX(), y: location.getY(), z: location.getZ() }, handled: false,
      }),
    });
    return true;
  }

  function dig(player) {
    const spade = (player.getInventory().getItems() ?? []).findIndex((item) => item && /^spade$/i.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? "")));
    if (spade < 0) return false;
    const item = player.getInventory().getItems()[spade];
    // The click names the option by its place in the item's menu (the spade's Dig is not first).
    const actions = core.CacheDefinitions?.getItem?.(item.getId())?.inventoryActions ?? [];
    const index = actions.findIndex((option) => option === "Dig");
    if (index < 0) return false;
    api.emitItemAction?.({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot: spade, clickType: index + 1, option: "Dig", handled: false });
    return true;
  }

  /** The prompt or dialogue in front of it: "Yeah I'm fearless!" picked, any other moved past. */
  function answerPrompt(player) {
    const prompt = core.MultiChatboxPrompt?.getPending?.(player);
    if (prompt) {
      const index = Math.max(0, (prompt.options ?? []).findIndex((option) => FEARLESS.test(String(option))));
      core.MultiChatboxPrompt.handleInterfaceActionClick({ player, buttonId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID,
        groupId: core.MultiChatboxPrompt.OPTIONS_WIDGET_ID >>> 16, slot: index + 1, action: index + 1 });
      return true;
    }
    const manager = player.getDialogueManager?.();
    if (!manager?.isActive?.()) return false;
    const current = manager.getCurrent?.();
    if (current instanceof core.OptionDialogue) {
      const options = current.getOptions();
      manager.handleOption(Math.max(0, options.findIndex((option) => FEARLESS.test(String(option)))) + 1);
    } else if (!(core.ActionDialogue && current instanceof core.ActionDialogue)) manager.advance();
    return true;
  }

  /** Breaks a teleport tablet it carries (by name); false without one. */
  function breakTablet(player, name) {
    const items = player.getInventory().getItems() ?? [];
    const slot = items.findIndex((item) => item && name.test(String(core.ItemDefinition.forId(item.getId())?.getName?.() ?? "")));
    if (slot < 0) return false;
    const item = items[slot];
    const actions = core.CacheDefinitions?.getItem?.(item.getId())?.inventoryActions ?? [];
    const index = actions.findIndex((option) => option === "Break");
    if (index < 0) return false;
    api.emitItemAction?.({ player, interfaceId: core.Inventory.INTERFACE_ID, item, itemId: item.getId(), slot, clickType: index + 1, option: "Break", handled: false });
    return true;
  }

  function fight(player, npc) {
    const combat = player.getCombat?.();
    if (!combat || !npc?.isRegistered?.()) return false;
    if (combat.getTarget?.() !== npc) combat.attack(npc);
    return true;
  }

  /** The rooms it walks through to the chest room (4), by the doors that open; null if none. */
  function routeRooms(v, from) {
    const open = new Set(v.run.openDoors);
    const previous = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const room = queue.shift();
      if (room === 4) break;
      for (const link of v.links) {
        if (!open.has(link.varbit)) continue;
        const next = link.a === room ? link.b : link.b === room ? link.a : null;
        if (next === null || previous.has(next)) continue;
        previous.set(next, { room, varbit: link.varbit });
        queue.push(next);
      }
    }
    if (!previous.has(4)) return null;
    const steps = [];
    for (let room = 4; previous.get(room); room = previous.get(room).room) steps.unshift({ to: room, ...previous.get(room) });
    return steps;
  }

  function start(entry, nowMs) {
    entry.barrows = { since: nowMs, progressAt: nowMs, actAt: 0, step: "travel", why: null, kills: 0, tries: 0 };
    note(entry.player, "Begint aan een Barrows-run.", "boss");
  }

  function fail(entry, why) {
    entry.barrows.why = why;
    note(entry.player, `Stopt met de Barrows-run: ${why}.`, "boss");
    metric({ kind: "barrows_run", bot: entry.name, result: "failed", why, step: entry.barrows.step, killed: entry.barrows.killed ?? [], minutes: Math.round((Date.now() - entry.barrows.since) / 6000) / 10 });
    return "failed";
  }

  const NAMES = ["Ahrim", "Dharok", "Guthan", "Karil", "Torag", "Verac"];
  /** Each new step in its log, readable: where it is in the run and why. */
  function progress(entry, nowMs, step, text = null) {
    if (entry.barrows.step !== step) {
      entry.barrows.step = step;
      entry.barrows.progressAt = nowMs;
      if (text) note(entry.player, text, "boss");
    }
  }

  function tick(entry, nowMs) {
    const run = entry.barrows;
    const player = entry.player;
    if (!run) return "failed";
    if (nowMs - run.since > MAX_RUN_MS) return fail(entry, "duurt te lang");
    if (nowMs - run.progressAt > STUCK_MS) return fail(entry, `komt niet verder (${run.step})`);
    // The minigame's own per-tick work for it (bots get no onPlayerProcess): every manager tick.
    api.emitCustomEvent("barrows:bot-process", { player });
    if (errandBusy(player)) return "running";
    const v = view(player);
    if (!v) return fail(entry, "de Barrows draaien niet op deze server");
    run.killed = v.run.killed;
    // Kills count as progress, as does every new step below.
    if (v.run.killed.length !== run.kills) {
      run.kills = v.run.killed.length;
      run.progressAt = nowMs;
    }
    if (v.run.looted) {
      metric({ kind: "barrows_run", bot: entry.name, result: "looted", killed: v.run.killed.length, minutes: Math.round((nowMs - run.since) / 6000) / 10 });
      note(player, `Heeft de Barrows-kist geplunderd (${v.run.killed.length} broers verslagen); teleporteert weg.`, "boss");
      if (!breakTablet(player, /^varrock teleport$/i)) castHome(player);
      return "done";
    }
    if (nowMs < run.actAt) return "running";
    run.actAt = nowMs + ACTION_MS;
    if (answerPrompt(player)) return "running";
    // A brother up: it fights him (the manager turns the right protection prayer on).
    if (v.brother?.isRegistered?.()) {
      progress(entry, nowMs, `fight ${v.brother.getIndex?.()}`, `Vecht tegen ${v.brother.getDefinition?.()?.getName?.() ?? "een broer"}.`);
      fight(player, v.brother);
      return "running";
    }
    const at = here(player);
    const order = [0, 1, 2, 3, 4, 5].filter((index) => index !== v.run.tunnel && !v.run.killed.includes(index));
    const othersDone = order.length === 0;
    const next = othersDone ? v.run.tunnel : order[0];

    if (v.phase === "outside") {
      if (run.step === "travel" && chebyshev(at, BARROWS) > 30) {
        if (!walkTo(entry, BARROWS, { reason: "boss", replan: false })) {
          if ((run.tries += 1) > 5) return fail(entry, "kan de Barrows niet bereiken");
        }
        return "running";
      }
      progress(entry, nowMs, "surface");
    }

    if (v.phase === "surface" || v.phase === "outside") {
      const mound = v.brothers[next].surface;
      progress(entry, nowMs, `mound ${next}`, `Gaat naar de heuvel van ${NAMES[next]} om te graven${othersDone ? " (de tunnel)" : ""}.`);
      if (chebyshev(at, mound) > 1) {
        player.getMovementQueue().requestWalk(new core.Location(mound.x, mound.y, 0));
        return "running";
      }
      if (!dig(player)) return fail(entry, "geen spade");
      run.digs = (run.digs ?? 0) + 1;
      if (run.digs === 5) note(player, "Graaft maar komt niet in de crypte.", "boss");
      return "running";
    }

    if (v.phase === "crypt") {
      // The crypt it stands in: the brother whose crypt is nearest.
      const index = v.brothers.map((brother, i) => ({ i, away: chebyshev(at, brother.crypt) })).sort((a, b) => a.away - b.away)[0].i;
      const brother = v.brothers[index];
      progress(entry, nowMs, `crypt ${index}`, `In de crypte van ${NAMES[index]}.`);
      const coffin = objectNear(brother.crypt, [brother.coffin]);
      const stairs = objectNear(brother.crypt, [brother.stairs]);
      if (index === v.run.tunnel) {
        // The tunnel: only once the other five are dead; until then back up.
        if (othersDone) return click(player, coffin) ? "running" : fail(entry, "sarcofaag niet gevonden");
        run.tunnelSeen = true;
        return click(player, stairs) ? "running" : fail(entry, "trap niet gevonden");
      }
      // Not dead yet: the sarcophagus searched (again, a few seconds apart, up to three times:
      // the walk to it can eat a click), then it waits for the brother to rise.
      if (!v.run.killed.includes(index)) {
        run.searches ??= {};
        const tries = run.searches[index] ?? { count: 0, at: 0 };
        if (tries.count < 3 && nowMs - tries.at > 6_000) {
          tries.count += 1;
          tries.at = nowMs;
          run.searches[index] = tries;
          note(player, `Doorzoekt de sarcofaag van ${NAMES[index]} (poging ${tries.count}).`, "boss");
          return click(player, coffin) ? "running" : fail(entry, "sarcofaag niet gevonden");
        }
        if (tries.count < 3 || nowMs - tries.at < 6_000) return "running";
        note(player, `${NAMES[index]} kwam niet tevoorschijn; gaat naar boven.`, "boss");
      }
      return click(player, stairs) ? "running" : fail(entry, "trap niet gevonden");
    }

    // The tunnels.
    if (v.crossing) return "running";
    const room = v.room;
    if (room === 4) {
      progress(entry, nowMs, "chest", "Bij de kist in de middelste kamer.");
      const chest = objectNear({ x: v.chest.x, y: v.chest.y, z: 0 }, [v.chest.id], 2);
      return click(player, chest, 1) ? "running" : fail(entry, "kist niet gevonden");
    }
    // Between rooms (in a doorway): a moment, the step through ends in the next room.
    if (room < 0) return "running";
    if (v.puzzleOpen) {
      api.emitCustomEvent("barrows:bot-answer-puzzle", { player });
      return "running";
    }
    const route = routeRooms(v, room);
    if (!route || route.length === 0) return fail(entry, "geen open deur naar de kist");
    const step = route[0];
    progress(entry, nowMs, `tunnel ${room}→${step.to}`, `In de tunnels: van kamer ${room} naar kamer ${step.to}.`);
    const door = v.doors.filter((entry2) => entry2.varbit === step.varbit)
      .map((entry2) => ({ door: entry2, side: entry2.sides.find((side) => side.room === room) }))
      .filter((pair) => pair.side)
      .sort((a, b) => chebyshev(at, a.side) - chebyshev(at, b.side))[0];
    if (!door) return fail(entry, "deur niet gevonden");
    if (at.x !== door.side.x || at.y !== door.side.y) {
      player.getMovementQueue().requestWalk(new core.Location(door.side.x, door.side.y, 0));
      return "running";
    }
    const object = objectNear({ x: door.door.x, y: door.door.y, z: 0 }, [door.door.id], 0);
    return click(player, object, 1) ? "running" : fail(entry, "deur niet aan te klikken");
  }

  return { start, tick, view };
}

module.exports = { createBarrowsRun, BARROWS };
