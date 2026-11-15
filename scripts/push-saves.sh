#!/usr/bin/env bash
# `yarn saves:push`: stores the newest save backup (server/data/backups) on the branch `saves`
# of this repository, so the saves outlive the codespace. Each push is a commit: the branch's
# history holds every weekly copy. The game server runs it itself at most once every 7 days
# (plugins/persistence/SaveBackups.plugin.js).
#
# The saves hold password hashes, so this refuses unless the repository is private.
#
# Restore: stop the game, then
#   git fetch origin saves && git checkout origin/saves -- latest
#   cp latest/* server/data/saves/ && rm -rf latest
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
BACKUPS="$ROOT/server/data/backups"
STAMP_FILE="$BACKUPS/last-push.txt"
BRANCH="saves"

remote=$(git remote get-url origin)
repo=$(printf '%s' "$remote" | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')
if ! command -v gh >/dev/null 2>&1; then
  echo "[saves] gh ontbreekt: kan niet controleren of de repo privé is. Niets gepusht."
  exit 1
fi
private=$(gh api "repos/$repo" --jq .private 2>/dev/null || echo "unknown")
if [ "$private" != "true" ]; then
  echo "[saves] De repo $repo is niet privé (of dat is niet na te gaan). De saves bevatten wachtwoord-hashes, dus ik push niets."
  exit 1
fi

newest=$(ls -1d "$BACKUPS"/*/ 2>/dev/null | sort | tail -n 1 || true)
if [ -z "$newest" ]; then
  echo "[saves] Nog geen backup in server/data/backups. Niets gepusht."
  exit 1
fi

work=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$work" >/dev/null 2>&1 || rm -rf "$work"' EXIT
if git fetch -q origin "$BRANCH" 2>/dev/null; then
  git worktree add -q --force "$work" "origin/$BRANCH"
  git -C "$work" switch -q -C "$BRANCH"
else
  git worktree add -q --force --detach "$work"
  git -C "$work" switch -q --orphan "$BRANCH"
  git -C "$work" rm -rq --cached . >/dev/null 2>&1 || true
  find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
fi

rm -rf "$work/latest"
mkdir -p "$work/latest"
cp -R "$newest". "$work/latest/"
cat > "$work/README.md" <<EOF
# Saves van Realm of Eeshwar

\`latest/\` is de nieuwste backup van \`server/data/saves\` (uit \`$(basename "$newest")\`).
Elke week komt er een commit bij; oudere versies staan in de geschiedenis van deze branch.

Terugzetten: stop het spel, dan
\`\`\`
git fetch origin saves && git checkout origin/saves -- latest
cp latest/* server/data/saves/ && rm -rf latest
\`\`\`
EOF

git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "[saves] Niets veranderd sinds de vorige push."
else
  git -C "$work" -c user.name="Save backups" -c user.email="saves@localhost" commit -q -m "Saves $(basename "$newest")"
  git -C "$work" push -q origin "$BRANCH"
  echo "[saves] Backup $(basename "$newest") gepusht naar branch $BRANCH."
fi
date -u +%s > "$STAMP_FILE"
