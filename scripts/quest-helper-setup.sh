#!/usr/bin/env bash
# Sets up the Quest Helper bridge (tools/quest-helper-bridge) so the game's Quest Helper and the
# adventurer bots' quests work without hand work: a shared secret in the root .env, the upstream
# Quest Helper at the pinned commit, and the built bridge. Safe to run again: each step is skipped
# when it is already done. Needs Java 21 and git; a failure leaves the game itself untouched
# (without the bridge, Quest Helper says its engine is off and the bots skip helper quests).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bridge="$root/tools/quest-helper-bridge"
upstream="$bridge/quest-helper-upstream"
commit="06da90f982518a093f2fe1c9cfac5547fa7053d3"

# The server and the bridge share this secret (24+ characters); made once, kept in .env.
touch "$root/.env"
if ! grep -q '^QUEST_HELPER_TOKEN=.\{24,\}' "$root/.env"; then
  sed -i '/^QUEST_HELPER_TOKEN=/d' "$root/.env"
  echo "QUEST_HELPER_TOKEN=$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')" >> "$root/.env"
  echo "Quest Helper token written to .env"
fi

if [ -x "$bridge/build/install/offline-quest-helper-bridge/bin/offline-quest-helper-bridge" ]; then
  echo "Quest Helper bridge already built"
  exit 0
fi
if ! command -v java >/dev/null 2>&1; then
  echo "Quest Helper bridge not built: Java 21 is missing (the codespace installs it; elsewhere install a JDK 21)."
  exit 0
fi
if [ ! -d "$upstream/.git" ]; then
  git clone -q https://github.com/Zoinkwiz/quest-helper "$upstream"
fi
git -C "$upstream" fetch -q origin "$commit" 2>/dev/null || true
git -C "$upstream" checkout -q "$commit"
(cd "$bridge" && bash ./gradlew -q installDist)
echo "Quest Helper bridge built"
