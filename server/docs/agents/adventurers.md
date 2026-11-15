# Adventurers and honest bots: goals, direction, next steps

The page for an agent picking up bot work. Read it before changing anything under
`plugins/bots/`. Keep it current: when you finish or start something, update **Status** and
**Next**.

## The goal

The 5 adventurers (Eeshwar, Call me Mark, Bekoek, Slayed Soul, Kram539; not ironmen) play
like real players who choose their own path. World bots get the same honesty, starting from
a generated account. The owner follows them on `/adventurers.html` and in game with `::volg`.

## Rules that never bend

1. **Nothing from nothing.** No conjured items, coins, gear, tools, food, runes or toll coins.
   Coins come only from monster drops, shop and GE sales, and pickpocket pouches. Items come
   from drops, shops, the GE, skilling or the ground. Every grant path checks
   `state.honest || isHonest(player)` (`brain/Honest.PlayerBots.js`).
2. **Only what is really playable.** No simulated quests, diaries, minigames or rewards. A
   bot does a quest or diary task only when the game can really play it and the bot meets the
   level and quest requirements. If it cannot be simulated yet, the bot does not do it.
3. **Walk.** Teleports only when real: spell with runes and level, tablet (used up),
   charged jewellery to its own destinations (costs a charge). No Wilderness or quest-locked
   destinations.
4. **Real interfaces and actions.** Make items through the skill's real menus and object
   interactions, never by adding the product.
5. **Adventurers are outside the world bot code** for outfits, loadouts, PvP restores,
   upkeep and provisioning (`state.adventurer = true`). Their own planner trades for them.
6. Every unexplained worn item is logged (`adventurer_unexplained_item`, "Onverklaard" on the
   page). That log is the honesty check: an item without a source is a bug.

## How it is built

| Part | Where |
| --- | --- |
| Adventurer loop: plan, walk, train, trade, bank, audit, goals | `plugins/bots/adventurers/Adventurers.PlayerBots.js` |
| What to train next (weights, goal, catch-up, busy skills) | `adventurers/Planner.PlayerBots.js` |
| Goals ("20 Attack for a mithril scimitar", saving up) | `adventurers/Goals.PlayerBots.js` |
| Selling, buying, wearing the best, what to keep | `adventurers/Trade.PlayerBots.js` |
| Shops, tools, shopping list | `adventurers/Shopping.PlayerBots.js` |
| Quest list and requirements (from the cache) | `adventurers/Quests.PlayerBots.js` |
| Settings: banks, buy-to-train recipes, courses, limits | `data/adventurers.json`, `data/adventurer-gear.json` |
| Walking errands and teleports | `brain/Errands.PlayerBots.js` |
| Generated world bot accounts | `brain/Accounts.PlayerBots.js` |
| Bank standers that really craft | `brain/BankCraft.PlayerBots.js`, `actions/BankStand` |
| Doors and the toll gate (honest bots pay only with 1.000 gp+) | `brain/DoorOpening.PlayerBots.js` |
| `::volg` spectating | `runtime/Watch.PlayerBots.js` |
| Adventurers page | `client/public/adventurers.html` (icons via `/wiki-icons`) |

Plugins talk through custom events: `ge:place-offer`, `ge:collect`, `ge:reset`,
`construction:*`, `slayer:assignment`, `slayer:current-task`, `slayer:on-task`. No requiring
`src/` from plugin logic; take `core` from the plugin API.

## Direction (how we think about it)

- **Freedom within the rules.** The planner weighs options; it never forces the lowest
  skill. Goals steer, randomness and preference stay. Skills chain naturally: woodcutting can
  lead to banking, fletching, firemaking or more woodcutting.
- **Need, not fixed numbers.** Keep what it uses (runes, ammo, food, teleports) in any
  amount; materials for current and coming levels up to `bankCap`; sell outgrown tiers.
- **Bank like a player.** Between jobs the last job's leftovers go to the nearest reachable
  bank. A blocked road blocks that place only. Dropping is the last resort and only for cheap
  things (`dropValue`).
- **Buy to train** when there is gold, sell the products, loss is fine if efficient.
- **Sell to fund.** Saving up for a coins goal (gear, teleport jewellery, tools), it may sell
  banked materials (logs, gems, bars) on the GE until the shortfall is covered; supplies stay.
- **No idling.** Stuck detection (2 min), retries with exclusion, next pick at once.
- Use what the world already knows (spawns, shops, objects, cache) instead of hand lists.

## Status (15-11-2026)

Done: honest economy, generated world bot accounts, walking errands and real teleports,
GE buy/sell, buy-to-train (fletching, firemaking, crafting gems, herblore, cooking,
smithing), bank use by need, agility courses with marks, ranged and magic with own supplies,
goals, house parties with gilded altar, `::volg` with inventory, equipment and skills,
adventurers page with icons and gear, toll gate detour, leftovers banked between jobs.

Not verified in game here (no cache in the agent container): long walks, agility runner,
make menus, house party, GE flows, equipment mirror, the Al Kharid detour.

## Next, in order

1. **Slayer** (in progress): walk to a real master (Turael Burthorpe, Spria Draynor,
   Vannaka at 40 combat), `slayer:assignment`, fight only NPCs where `slayer:on-task` is true
   (TrainCombat filter, level band 1..1000, home near the nearest spawn by name), stop when
   `slayer:current-task` is empty. Planner mode `slayer`.
2. **Hunter**, then **Runecraft** after Rune Mysteries (GotR after its quest).
3. **Quests for real**: short F2P quests, Druidic Ritual, Rune Mysteries, only those the
   quest runtime can play start to finish.
4. **Places from the world** (spawns, objects, shops) instead of hand lists.
5. **Smarter stopping** (finish to a level), better prices, death recovery.
6. `::volg`: more interfaces (bank, combat tab), clickable control.
7. Later: diaries when tasks are really doable, Construction, leather crafting, Tempoross
   and other minigames, Graceful from marks (Rogues' Den), Wintertodt rewards in the audit.

## How to extend safely

- New skill: an activity in `data/definitions/bot-activities.json`, a planner option, tools
  bought or made, a real action in `brain/actions/`. Check every item it gets has a source
  the audit knows (`acquire()`).
- New place: from data the world already has; check reachability (route finder, doors,
  tolls, quest gates) before choosing it.
- Tests: `node --test tests/bot-adventurers.test.cjs tests/bot-errands.test.cjs ...`.
  Cache-dependent bot tests fail without a cache; compare the fail count before and after.
- Changelog line in Dutch for every change; push to `origin main` only.
