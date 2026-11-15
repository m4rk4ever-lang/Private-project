/**
 * Membership as the client shows it. On a members world every account has members access, but
 * the client only knows what the server tells it: without these the Account Management tab says
 * "Membership: None", and the skill tab and quest list treat the player as free-to-play.
 *
 * At login, on a members world (cache rev 242, osrs-dumps 853150e):
 * - varp 1780 (account_credit), the days of membership left, above 99999: the most the cache's
 *   account_billing_update (proc 2503) can show ("Membership: 99999+ days left");
 * - clientscript 2498 (account_info_update) sets varc 103 (playermember) and redraws the tab;
 * - two ticks later, once the client's own redraw on that varp's transmit has run,
 *   account:billing_text (109:31) reads "Membership: Unlimited". Should the cache redraw it again
 *   (it does on account_credit, account_messages, mobile_options_transmit, tob_temp_transmit_2 or
 *   armourhitsound changing), it falls back to the 99999+ days text.
 */
const ACCOUNT_CREDIT_VARP = 1780;
const UNLIMITED_CREDIT = 100000;
const ACCOUNT_INFO_UPDATE_SCRIPT = 2498;
const BILLING_TEXT_UID = (109 << 16) | 31;
const BILLING_TEXT = "Membership: Unlimited";
const TEXT_DELAY_TICKS = 2;

let api = null;

function later(player, ticks, action) {
  const { Task, TaskManager } = api.core;
  TaskManager.submit(new (class extends Task {
    constructor() { super(ticks, player, false); }
    execute() {
      this.stop();
      action();
    }
  })());
}

function showMembership({ player }) {
  if (!player || player.isPlayerBot?.() === true || !api.core.WorldDefinition.isMembersWorld()) return;
  player.getPacketSender()
    .sendConfig(ACCOUNT_CREDIT_VARP, UNLIMITED_CREDIT)
    .sendClientScript(ACCOUNT_INFO_UPDATE_SCRIPT, 1, 0, 0);
  later(player, TEXT_DELAY_TICKS, () => {
    if (player.isRegistered?.() !== false) player.getPacketSender().sendString(BILLING_TEXT, BILLING_TEXT_UID);
  });
}

function init(pluginApi) {
  api = pluginApi;
}

module.exports = {
  name: "MembershipDisplay",
  description: "On a members world, the client shows every account as a member: unlimited membership in Account Management, members skills and quests unlocked in the side tabs.",
  register(pluginApi) {
    init(pluginApi);
    pluginApi.onPlayerLogin(showMembership);
  },
  _test: { showMembership, init, ACCOUNT_CREDIT_VARP, UNLIMITED_CREDIT, ACCOUNT_INFO_UPDATE_SCRIPT, BILLING_TEXT_UID, BILLING_TEXT },
};
