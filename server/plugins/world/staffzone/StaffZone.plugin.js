/**
 * Staffzone: a private copy of the Tombs of Amascut vault ("Laid to Rest") for owners and
 * developers only. Not live content: a staff tool for this server.
 *
 *   ::staffzone   go in, or back out to where you came from
 *
 * One copy is shared by all staff inside it; it is built when the first one enters and goes
 * when the last one leaves. The copy lives where the cache has no map, so nobody walks in.
 * Inside: free staff shops (weapons, armour, supplies, skilling), a banker, a combat dummy, an
 * ornate pool of Rejuvenation (the house pool's own handler), Osmumten keeping watch by the
 * sarcophagus and standing torches along the hall; your hitpoints, prayer, special attack and
 * run energy are kept topped up. A player without
 * owner or developer rights who ends up inside is sent out. Logging out inside puts you back
 * where you came from, so you never log in to a copy that is gone.
 */
const data = require("./data/staffzone.json");

const RETURN_ATTRIBUTE = "staff-zone:return";
const CHUNK = 8;

let api = null;
let AreaClass = null;
/** The shared copy while any staff are in it. */
let zone = null;

const core = () => api.core;
const staffShopIds = new Set(data.shops.map((_, index) => data.shopBaseId + index));

function isStaff(player) {
  const { PlayerRights } = core();
  return player.getRights().getId() >= PlayerRights.OWNER.getId();
}

/** The copy's tile for a tile of the original vault. */
function instanceTile([x, y, z]) {
  const { sourceChunkX, sourceChunkY } = data.template;
  return zone.area.tile(x - sourceChunkX * CHUNK, y - sourceChunkY * CHUNK, z ?? 0);
}

function returnLocation(player) {
  const saved = player.getAttribute(RETURN_ATTRIBUTE);
  if (Array.isArray(saved) && saved.length === 3) return new (core().Location)(saved[0], saved[1], saved[2]);
  const { spawn } = core().WorldDefinition.getWorldDefinition();
  return new (core().Location)(spawn.x, spawn.y, spawn.z ?? 0);
}

/** Hitpoints, prayer and every other stat back to full, plus special attack and run energy. */
function restore(player) {
  const { Skill } = core();
  const skills = player.getSkillManager();
  for (const skill of Skill.values()) {
    if (skills.getCurrentLevel(skill) < skills.getMaxLevel(skill)) skills.setCurrentLevels(skill, skills.getMaxLevel(skill));
  }
  player.setPoisonDamage(0);
  player.setVenomed(false);
  player.setRunEnergy(100);
  player.getPacketSender().sendRunEnergy();
  player.setSpecialPercentage(100);
  core().CombatSpecial.updateBar(player);
}

function areaClass() {
  if (AreaClass) return AreaClass;
  AreaClass = class StaffZoneArea extends core().TemplatedInstanceArea {
    constructor() {
      super(data.template.chunks, data.template.chunks);
      this.ticks = new WeakMap();
    }

    getName() {
      return "Staffzone";
    }

    /** Staff only: anyone else inside is sent out; staff stay topped up. */
    process(mobile) {
      if (!mobile.isPlayer?.()) return;
      const player = mobile.getAsPlayer();
      if (!isStaff(player)) {
        player.moveTo(returnLocation(player));
        player.sendMessage("Only staff may enter the staffzone.");
        return;
      }
      const ticks = (this.ticks.get(player) ?? 0) + 1;
      this.ticks.set(player, ticks);
      if (ticks % data.restoreEveryTicks === 0) restore(player);
    }

    /** Its NPCs go with it. */
    destroy() {
      if (this.isDestroyed()) return;
      for (const entity of [...this.entities]) {
        if (!entity.isNpc?.()) continue;
        this.detach(entity);
        api.removeNpc(entity);
      }
      if (zone?.area === this) zone = null;
      super.destroy();
    }

    /** Logging out inside puts the player back where they came from before they are saved. */
    postLeave(mobile, logout) {
      if (mobile.isPlayer?.()) {
        const player = mobile.getAsPlayer();
        if (logout) player.setLocation(returnLocation(player));
        player.setAttribute(RETURN_ATTRIBUTE, null);
      }
      super.postLeave(mobile, logout);
    }
  };
  return AreaClass;
}

function spawnNpc(spec, marker) {
  const id = core().NpcIdentifiers[spec.npc];
  if (!Number.isInteger(id)) return null;
  const at = instanceTile(spec.tile);
  const face = core().Direction[spec.face ?? "SOUTH"].getId();
  const npc = api.spawnNpc({ id, x: at.getX(), y: at.getY(), z: at.getZ(), wanderRadius: 0, face });
  if (!npc) return null;
  npc.__skipDefaultRespawn = true;
  Object.assign(npc, marker);
  zone.area.add(npc);
  return npc;
}

/** A scenery object (type 10) in the copy; it goes with the copy. */
function placeObject(spec) {
  const { GameObject, ObjectManager, ObjectIdentifiers } = core();
  const id = ObjectIdentifiers[spec.object];
  if (!Number.isInteger(id)) return;
  ObjectManager.register(new GameObject(id, instanceTile(spec.tile), 10, spec.rotation ?? 0, zone.area), true);
}

/** Builds the shared copy, its NPCs and its objects. */
function openZone() {
  const { sourceChunkX, sourceChunkY, chunks, plane } = data.template;
  const area = new (areaClass())();
  area.copySquare(chunks, sourceChunkX, sourceChunkY, plane, 0, 0, plane, 0);
  zone = { area };
  spawnNpc(data.banker, { __staffZoneBanker: true });
  spawnNpc(data.dummy, { __staffZoneDummy: true });
  spawnNpc(data.host, { __staffZoneHost: true });
  placeObject(data.pool);
  data.decorations.forEach(placeObject);
  data.shops.forEach((shop, index) => spawnNpc(shop, { __staffZoneShop: data.shopBaseId + index }));
  return zone;
}

function enter(player) {
  if (!zone || zone.area.isDestroyed()) openZone();
  const here = player.getLocation();
  player.setAttribute(RETURN_ATTRIBUTE, [here.getX(), here.getY(), here.getZ()]);
  zone.area.enter(player);
  player.moveTo(instanceTile(data.entry));
  restore(player);
  player.sendMessage("Welcome to the staffzone. Type ::staffzone again to leave.");
}

function leave(player) {
  player.moveTo(returnLocation(player));
  player.sendMessage("You leave the staffzone.");
}

function staffZoneCommand({ player }) {
  if (zone && zone.area.hasMember(player)) leave(player);
  else enter(player);
  return true;
}

/** A staff shop's definition, registered again if a shop reload dropped it. */
function ensureShop(shopId) {
  const { ShopDefinition, ShopManager, ItemIdentifiers } = core();
  if (ShopManager.hasShop(shopId)) return;
  const shop = data.shops[shopId - data.shopBaseId];
  const stock = shop.items
    .map((name) => ItemIdentifiers[name])
    .filter((id) => Number.isInteger(id))
    .map((id) => ({ id, amount: 2_000_000_000, restockTicks: null, price: 1 }));
  ShopManager.registerShop(new ShopDefinition(shopId, shop.name, "COINS", stock, 100, 100, 100, "staff-zone"));
}

/** Staff NPCs in the copy answer every option themselves (bank, trade). */
function interact(event) {
  const npc = event.npc;
  if (!npc || (!npc.__staffZoneShop && !npc.__staffZoneBanker)) return;
  event.handled = true;
  if (npc.__staffZoneBanker) {
    event.player.getBank(event.player.getCurrentBankTab()).open();
    return;
  }
  ensureShop(npc.__staffZoneShop);
  core().ShopManager.open(event.player, npc.__staffZoneShop);
}

/** Everything in the staff shops is free. */
function freeInStaffShops(request) {
  if (staffShopIds.has(request.shopId)) request.price = 0;
}

/** The staff shops don't buy anything back. */
function noSellingToStaffShops(request) {
  if (staffShopIds.has(request.shopId)) request.sellable = false;
}

/** Someone saved inside (the server stopped while they were in) comes back where they were. */
function recoverOnLogin({ player }) {
  if (!Array.isArray(player.getAttribute(RETURN_ATTRIBUTE))) return;
  if (zone && zone.area.hasMember(player)) return;
  player.moveTo(returnLocation(player));
  player.setAttribute(RETURN_ATTRIBUTE, null);
}

function init(pluginApi) {
  api = pluginApi;
}

module.exports = {
  name: "StaffZone",
  description: "A private Tombs of Amascut vault for owners and developers, with free staff shops, a banker, a combat dummy and a pool of Rejuvenation (::staffzone).",
  register(pluginApi) {
    init(pluginApi);
    pluginApi.persistAttribute(RETURN_ATTRIBUTE);
    pluginApi.registerCommand("staffzone", staffZoneCommand, pluginApi.core.PlayerRights.OWNER, "Go to the staffzone, or leave it");
    pluginApi.onBeforeNpcInteraction(interact);
    pluginApi.onCustomEvent("shop:buy-price", freeInStaffShops);
    pluginApi.onCustomEvent("shop:can-sell", noSellingToStaffShops);
    pluginApi.onPlayerLogin(recoverOnLogin);
  },
  _test: { data, staffShopIds, ensureShop, freeInStaffShops, noSellingToStaffShops },
};
