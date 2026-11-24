const root = require("path").resolve(__dirname, "..");
const { Server } = require(root + "/dist/Server"); Server.installProductionPathResolver();
const { CachePipeline } = require(root + "/dist/game/cache/CachePipeline");
const { Location } = require(root + "/dist/game/model/Location");
(async () => {
  await CachePipeline.initialize(root);
  const { PluginManager } = require(root + "/dist/plugins/PluginManager");
  const core = PluginManager.getCoreApi(); core.ObjectDefinition.init();
  const { RegionManager } = require(root + "/dist/game/collision/RegionManager");
  const { MapObjects } = require(root + "/dist/game/entity/impl/object/MapObjects");
  const [cx, cy, r] = process.argv.slice(2).map(Number);
  RegionManager.init(); RegionManager.loadMapFiles(cx, cy);
  const [x0, x1, y0, y1] = [cx - r, cx + r, cy - r, cy + r];
  for (let y = y1; y >= y0; y--) { let row = y + " "; for (let x = x0; x <= x1; x++) row += RegionManager.blocked(new Location(x, y, 0), null) ? "#" : "."; console.log(row); }
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const o of MapObjects.mapObjects.get(MapObjects.getHash(x, y, 0)) ?? []) {
    const d = o.getDefinition?.(); const a = (d?.getActions?.() ?? []).filter(Boolean);
    if (a.length) console.log(o.getId(), x, y, "type", o.getType(), "face", o.getFace(), d.getName?.(), a.join("/"));
  }
})();
