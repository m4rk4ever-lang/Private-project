#!/usr/bin/env bash
# `yarn update` (or `update` in a codespace terminal): stops the running game, fetches the
# newest version from GitHub, installs new dependencies when they changed, and starts the
# game again. Run it from any terminal; a game running in another terminal is stopped too.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "[update] Spel stoppen..."
# The game's own processes only (server panel, its nodemon and server, the client), never this script.
pkill -f "scripts/local-panel.cjs" 2>/dev/null
pkill -f "nodemon" 2>/dev/null
pkill -f "elvarg/Server.ts" 2>/dev/null
pkill -f "craco.js start" 2>/dev/null
pkill -f "concurrently.*--names server,client" 2>/dev/null
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! ss -ltn 2>/dev/null | grep -qE ':(3000|43594|49600) '; then break; fi
  sleep 1
done
if ss -ltn 2>/dev/null | grep -qE ':(3000|43594|49600) '; then
  echo "[update] Er draait nog iets op poort 3000, 43594 of 49600. Probeer het over een paar seconden opnieuw."
  exit 1
fi

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

echo "[update] Spel starten..."
exec yarn start
