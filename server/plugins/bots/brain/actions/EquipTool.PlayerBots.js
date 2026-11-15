"use strict";

const { isHonest } = require("../Honest.PlayerBots");

const { Equipment } = require("../../../../src/main/typescript/elvarg/game/model/container/impl/Equipment");
const { Item } = require("../../../../src/main/typescript/elvarg/game/model/Item");
const { Flag } = require("../../../../src/main/typescript/elvarg/game/model/Flag");
const { Skill } = require("../../../../src/main/typescript/elvarg/game/model/Skill");
const WorldDefinition = require("../../../../src/main/typescript/elvarg/game/definition/WorldDefinition");
const { CacheDefinitions } = require("../../../../src/main/typescript/elvarg/game/cache/CacheDefinitions");
const Woodcutting = require("../../../skills/Woodcutting.plugin");
const Mining = require("../../../skills/Mining.plugin");
const { EquipPacketListener } = require("../../../../src/main/typescript/elvarg/net/packet/impl/EquipPacketListener");
const { Inventory } = require("../../../../src/main/typescript/elvarg/game/model/container/impl/Inventory");

/** Free worlds: a members tool is no tool there (as Woodcutting and Mining refuse it), so bots don't wield one. */
function usableOnWorld(tool) {
  return WorldDefinition.isMembersWorld() || CacheDefinitions.getItem(tool.id)?.isMembers !== true;
}

const TOOL_RESOLVERS = {
  axe(player) {
    const level = player.getSkillManager().getCurrentLevel(Skill.WOODCUTTING);
    return Woodcutting.findBestUsableAxeByLevel(level, usableOnWorld)?.id ?? null;
  },
  pickaxe(player) {
    const level = player.getSkillManager().getCurrentLevel(Skill.MINING);
    const pickaxe = (Mining.PICKAXES_DESC ?? []).find(
      // Only the standard pickaxes, as for axes: not the league's Echo pickaxe or a crystal one that needs Agility.
      (entry) => entry.standard && level >= entry.requiredLevel && usableOnWorld(entry)
    );
    return pickaxe?.id ?? null;
  },
};

/**
 * An honest bot (an adventurer) uses a tool it owns: the plugin's own best-usable check over its
 * inventory and weapon slot. It is wielded when it is in the inventory, as a player would. No
 * tool: failed, and the adventurer buys one first (Shopping.PlayerBots.js).
 */
function equipOwnTool(player, tool) {
  const best = tool === "axe" ? Woodcutting.findBestUsableAxe?.(player) : Mining.findBestPickaxe?.(player) ?? null;
  const id = best?.id ?? best?.itemId ?? null;
  if (!Number.isInteger(id)) return "failed";
  const equipment = player.getEquipment();
  if (equipment.getItems()[Equipment.WEAPON_SLOT]?.getId?.() === id) return "success";
  const slot = player.getInventory().getItems().findIndex((item) => item?.getId?.() === id);
  if (slot < 0) return "success";
  EquipPacketListener.equip(player, id, slot, Inventory.INTERFACE_ID);
  return "success";
}

function createEquipToolAction(spec) {
  const resolveTool = TOOL_RESOLVERS[spec.tool];
  if (!resolveTool) {
    throw new Error(`[bot activities] unknown tool '${spec.tool}'`);
  }
  return {
    id: "equipTool",
    update(ctx) {
      const player = ctx.player;
      const equipment = player.getEquipment();
      if (ctx.state?.honest || isHonest(player)) return equipOwnTool(player, spec.tool);
      const toolId = resolveTool(player);
      if (!toolId) {
        return "failed";
      }
      const equipped = equipment.getItems()[Equipment.WEAPON_SLOT];
      if (equipped && equipped.getId() === toolId) {
        return "success";
      }
      equipment.set(Equipment.WEAPON_SLOT, new Item(toolId, 1));
      equipment.refreshItems();
      player.getUpdateFlag().flag(Flag.APPEARANCE);
      return "success";
    },
  };
}

module.exports = {
  createEquipToolAction,
};
