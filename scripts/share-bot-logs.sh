#!/usr/bin/env bash
# Shares the adventurers' logs from this machine through the repo, so a Claude session elsewhere
# can read what the bots did and where quests got stuck: the last part of each log goes into
# docs/bot-logs/ (committed and pushed on the branch you are on). Run: bash scripts/share-bot-logs.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p docs/bot-logs
for name in adventurers-activity adventurer-quest-feedback; do
  file="server/logs/$name.jsonl"
  if [ -f "$file" ]; then
    tail -n 5000 "$file" > "docs/bot-logs/$name.jsonl"
    echo "$name: $(wc -l < "docs/bot-logs/$name.jsonl") regels"
  fi
done
git add docs/bot-logs
if git diff --cached --quiet -- docs/bot-logs; then
  echo "Geen nieuwe logregels."
  exit 0
fi
git commit -q -m "Bot logs from $(hostname) ($(date -u +%Y-%m-%dT%H:%MZ))" -- docs/bot-logs
git push -q
echo "Gedeeld in docs/bot-logs/."
