#!/usr/bin/env bash
# Shares the adventurers' logs from this machine through the repo, so a Claude session elsewhere
# can read what the bots did, where quests got stuck and how the server kept up: the last part of
# each log is pushed as one commit to the branch `bot-logs` (replaced each time, so the repo does
# not grow). Your own branch, index and working tree are not touched.
#
#   bash scripts/share-bot-logs.sh          once
#   bash scripts/share-bot-logs.sh --loop   every 5 minutes (start.sh starts this with the game)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
root="$(pwd)"
# Another branch for a test run (BOT_LOGS_BRANCH=bot-logs-test), so the real one is left alone.
branch="${BOT_LOGS_BRANCH:-bot-logs}"

share() {
  local tmp index tree commit
  tmp="$(mktemp -d)"
  index="$tmp/index"
  for name in adventurers-activity adventurer-quest-feedback adventurers-metrics; do
    [ -f "server/logs/$name.jsonl" ] && tail -n 20000 "server/logs/$name.jsonl" > "$tmp/$name.jsonl"
  done
  if ! ls "$tmp"/*.jsonl >/dev/null 2>&1; then
    rm -rf "$tmp"
    echo "$(date -u +%H:%MZ) nog geen logs"
    return 0
  fi
  # A tree of only these files, built in a separate index: nothing of the checkout changes.
  for file in "$tmp"/*.jsonl; do
    GIT_INDEX_FILE="$index" git update-index --add --cacheinfo "100644,$(git hash-object -w "$file"),bot-logs/$(basename "$file")"
  done
  tree="$(GIT_INDEX_FILE="$index" git write-tree)"
  commit="$(git -c user.name="bot-logs" -c user.email="bot-logs@localhost" commit-tree "$tree" -m "Bot logs $(date -u +%Y-%m-%dT%H:%MZ)")"
  rm -rf "$tmp"
  if git push -q -f origin "$commit:refs/heads/$branch" 2>/dev/null; then
    echo "$(date -u +%H:%MZ) gedeeld op branch $branch"
  else
    echo "$(date -u +%H:%MZ) pushen naar $branch mislukt (netwerk of rechten); volgende keer opnieuw"
  fi
}

if [ "${1:-}" = "--loop" ]; then
  while true; do
    share
    sleep 300
  done
else
  share
fi
