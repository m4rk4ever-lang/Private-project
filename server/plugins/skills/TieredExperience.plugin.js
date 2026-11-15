/**
 * Tiered experience rate: a skill's experience is multiplied by a rate that drops as its level
 * rises, so the early levels go fast and the last ones still take work. The rate is picked from
 * the skill's real (not boosted) level when the experience lands, per skill.
 *
 * It applies to every gain the world's own rate applies to, reward experience included (quests,
 * lamps, tomes), and comes on top of `experienceMultiplier` in world.json; keep that at 1 when
 * using these tiers. Content that adds experience without multipliers (a league relic's bonus)
 * is left alone, as core does.
 */
const TIERS_CONFIG = "TieredExperience:tiers";

/** Lowest level of each tier, and its rate. */
const DEFAULT_TIERS = Object.freeze([
  { fromLevel: 1, rate: 25 },
  { fromLevel: 50, rate: 15 },
  { fromLevel: 80, rate: 10 },
  { fromLevel: 90, rate: 5 },
]);

let api = null;

/** Valid tiers from the world config, highest level first; the defaults when none are valid. */
function tiers() {
  const configured = api?.getPluginConfig?.(TIERS_CONFIG, null);
  const valid = Array.isArray(configured)
    ? configured.filter((tier) => Number.isInteger(tier?.fromLevel) && tier.fromLevel >= 1
      && Number.isFinite(tier?.rate) && tier.rate > 0)
    : [];
  return [...(valid.length > 0 ? valid : DEFAULT_TIERS)].sort((a, b) => b.fromLevel - a.fromLevel);
}

/** The rate for a skill at this level: the tier with the highest starting level it has reached. */
function rateForLevel(level, list = tiers()) {
  return list.find((tier) => level >= tier.fromLevel)?.rate ?? 1;
}

function applyTier(event) {
  if (event.allow === false || !event.player || !event.skill) return;
  const level = event.player.getSkillManager?.()?.getMaxLevel?.(event.skill);
  if (!Number.isFinite(level)) return;
  event.multiplier *= rateForLevel(level);
}

function init(pluginApi) {
  api = pluginApi;
}

module.exports = {
  name: "TieredExperience",
  description: "Tiered experience rate: fast early levels, slower near 99 (by default x25 from level 1, x15 from 50, x10 from 80, x5 from 90), quest and reward experience included.",
  config: {
    [TIERS_CONFIG]: {
      type: "json",
      label: "Experience tiers",
      defaultText: "x25 from 1, x15 from 50, x10 from 80, x5 from 90",
      help: "A list of { \"fromLevel\": <level>, \"rate\": <multiplier> }; a skill's rate is the tier with the highest fromLevel it has reached. Comes on top of experienceMultiplier.",
    },
  },
  register(pluginApi) {
    init(pluginApi);
    pluginApi.onCanGainExperience(applyTier);
  },
  _test: { applyTier, rateForLevel, tiers, init, DEFAULT_TIERS },
};
