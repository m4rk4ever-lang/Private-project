"use strict";

/**
 * bot-sites.json with the deployment's choices applied: world.json / world.local.json
 * `pluginConfig` "PlayerBots:sites" maps a site id to an object of site properties. For a site
 * bot-sites.json has, they replace its own, each top-level property whole (`bots` replaces
 * every count); any other id is a new site, which needs `x` and `y`. A world can then run its
 * own bot population (skilling sites on, the PvP pens off, fewer Lumbridge woodcutters, a site
 * of its own) in its gitignored world.local.json and still update from main by fast-forward.
 *
 *   "pluginConfig": { "PlayerBots:sites": {
 *     "edge_low": { "enabled": false },
 *     "lumbridge": { "enabled": true, "bots": { "woodcutting": 10 } },
 *     "draynor": { "enabled": true, "x": 3093, "y": 3244, "bots": { "fishing": 20 } }
 *   } }
 *
 * Sites and properties the map doesn't name keep theirs. Read through getPluginConfig, so the
 * layering is pluginConfig's: world.local.json's "PlayerBots:sites" replaces world.json's.
 */
const fs = require("fs");
const { PluginManager } = require("../../../src/main/typescript/elvarg/plugins/PluginManager");

const SITES_CONFIG_KEY = "PlayerBots:sites";

/** The "PlayerBots:sites" overrides: id -> site properties. Other values are skipped with a warning. */
function siteOverrides(raw = PluginManager.getPluginConfig(SITES_CONFIG_KEY)) {
  if (raw === undefined) return new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    console.warn(`[bot sites] world config pluginConfig "${SITES_CONFIG_KEY}" must be an object of site id -> properties; ignored`);
    return new Map();
  }
  const overrides = new Map();
  for (const [id, props] of Object.entries(raw)) {
    if (!props || typeof props !== "object" || Array.isArray(props)) {
      console.warn(`[bot sites] world config ${SITES_CONFIG_KEY}.${id} must be an object of site properties; ignored`);
      continue;
    }
    overrides.set(id, props);
  }
  return overrides;
}

/** Applies `overrides` to a parsed bot-sites.json in place: known sites change, new ids are added. */
function applySiteOverrides(sitesFile, overrides) {
  const sites = (sitesFile.sites ??= []);
  for (const [id, props] of overrides) {
    const site = sites.find((entry) => entry.id === id);
    if (site) {
      Object.assign(site, props, { id });
    } else if (Number.isInteger(props.x) && Number.isInteger(props.y)) {
      sites.push({ ...props, id });
    } else {
      console.warn(`[bot sites] world config ${SITES_CONFIG_KEY}.${id} is a new site and needs integer x and y; ignored`);
    }
  }
  return sitesFile;
}

const POPULATION_CONFIG_KEY = "PlayerBots:population";

/**
 * Scales every site's bot counts by `factor` (0.5 halves the population), rounding each count
 * and keeping at least one bot where there was one, so every group stays.
 */
function scalePopulation(sitesFile, factor) {
  if (!Number.isFinite(factor) || factor < 0 || factor === 1) return sitesFile;
  for (const site of sitesFile.sites ?? []) {
    for (const tiers of Object.values(site.bots ?? {})) {
      if (!tiers || typeof tiers !== "object") continue;
      for (const [tier, count] of Object.entries(tiers)) {
        if (Number.isInteger(count) && count > 0) tiers[tier] = factor === 0 ? 0 : Math.max(1, Math.round(count * factor));
      }
    }
  }
  return sitesFile;
}

/** Reads bot-sites.json (or `file`) with the world config's "PlayerBots:sites" applied. */
function readBotSites(file, raw) {
  const sitesFile = JSON.parse(fs.readFileSync(file, "utf8"));
  const regionDensity = PluginManager.getPluginConfig("PlayerBots:activeRegionBotsByRegion");
  if (regionDensity !== undefined) {
    (sitesFile.pvp ??= {}).activeRegionBotsByRegion = regionDensity;
  }
  applySiteOverrides(sitesFile, siteOverrides(raw));
  return scalePopulation(sitesFile, Number(PluginManager.getPluginConfig(POPULATION_CONFIG_KEY) ?? 1));
}

module.exports = { readBotSites, siteOverrides, applySiteOverrides, scalePopulation };
