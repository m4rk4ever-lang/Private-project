#!/usr/bin/env bash
# `yarn update` (or `update` in a codespace terminal): stops the running game, fetches the
# newest version from GitHub, installs new dependencies when they changed, and starts the
# game again. Run it from any terminal; a game running in another terminal is stopped too.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "[update] Spel stoppen..."
bash scripts/stop-game.sh || exit 1
echo "[update] Nieuwste versie ophalen..."
before=$(git rev-parse HEAD)
if ! git pull --ff-only; then
  echo "[update] git pull lukte niet (zie hierboven). Er is niets gestart."
  exit 1
fi
after=$(git rev-parse HEAD)
if [ "$before" = "$after" ]; then
  echo "[update] Je had de nieuwste versie al."
else
  git log --oneline "$before..$after"
  if git diff --name-only "$before" "$after" | grep -qE '(^|/)(package\.json|yarn\.lock|package-lock\.json)$'; then
    echo "[update] Nieuwe onderdelen installeren..."
    npm run setup || { echo "[update] Installeren mislukte. Er is niets gestart."; exit 1; }
  fi
fi

# Older codespaces were set up with the server name "Codespace": use the world's name.
if [ -f .env ] && grep -q '^REACT_APP_DEFAULT_SERVER_NAME=Codespace$' .env; then
  sed -i 's/^REACT_APP_DEFAULT_SERVER_NAME=Codespace$/REACT_APP_DEFAULT_SERVER_NAME=Realm of Eeshwar/' .env
fi

echo "[update] Spel starten..."
exec yarn start
