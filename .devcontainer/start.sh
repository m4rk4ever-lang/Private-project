#!/usr/bin/env bash
# Runs whenever you open the codespace: starts the Quest Helper bridge (if it is built and not
# running yet) and the game (if it is not running yet).
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ -x tools/quest-helper-bridge/build/install/offline-quest-helper-bridge/bin/offline-quest-helper-bridge ] \
    && ! curl -fs --max-time 2 http://127.0.0.1:16471/health >/dev/null 2>&1; then
  nohup yarn bridge > /tmp/quest-helper-bridge.log 2>&1 &
  echo "Quest Helper bridge starting (log: /tmp/quest-helper-bridge.log)"
fi
# The adventurers' logs go to the branch bot-logs every 5 minutes from the game itself
# (Adventurers.PlayerBots.js, scripts/share-bot-logs.sh); an old separate loop is stopped.
pkill -f 'share-bot-logs.sh --loop' 2>/dev/null || true
# Idle Gradle daemons (left by the bridge build or by VS Code's Java/Gradle extensions) hold
# several GB in an 8 GB codespace; the game ran out of memory beside them. They are only for
# builds, so stop them; a build starts a new one when it needs it.
pkill -f 'org.gradle.launcher.daemon.bootstrap.GradleDaemon' 2>/dev/null && echo "Gradle-daemons gestopt (geheugen vrij voor het spel)."
# Only when no game runs yet: not by its ports alone (a game that is still starting has none
# open yet), also by its processes. A second `yarn start` would stop the running game first.
if ss -ltnH | grep -qE ':(3000|43594) ' || pgrep -f 'elvarg/Server.ts|local-panel.cjs|craco.js start' >/dev/null; then
  echo "Het spel draait al."
else
  yarn start
fi
