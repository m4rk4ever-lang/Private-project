#!/usr/bin/env bash
# Runs on every codespace start.
# Older codespaces were set up with the server name "Codespace": use the world's name.
if [ -f .env ] && grep -q '^REACT_APP_DEFAULT_SERVER_NAME=Codespace$' .env; then
  sed -i 's/^REACT_APP_DEFAULT_SERVER_NAME=Codespace$/REACT_APP_DEFAULT_SERVER_NAME=Realm of Eeshwar/' .env
fi
# Codespaces made before the full-cache setting: every graphics request goes through GitHub's
# port forwarding, so the client downloads the whole cache once and keeps it (game/Caches.ts).
if [ -n "${CODESPACE_NAME:-}" ] && [ -f .env ] && ! grep -q '^REACT_APP_FULL_CACHE=' .env; then
  echo 'REACT_APP_FULL_CACHE=1' >> .env
fi
# The game client's page (port 3000) stays private:
# only you, signed in to GitHub, can open it. The browser's WebSocket to the game
# server (port 43594) cannot send that GitHub sign-in, so that port must be public.
if [ -n "${CODESPACE_NAME:-}" ]; then
  # The server is not listening yet when the codespace starts (it starts on attach), and a port
  # that is not forwarded yet cannot be made public: keep trying in the background for 15 minutes.
  (
    for _ in $(seq 1 90); do
      if gh codespace ports visibility 43594:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
          && [ "$(gh codespace ports -c "$CODESPACE_NAME" --json sourcePort,visibility --jq '.[] | select(.sourcePort == 43594) | .visibility' 2>/dev/null)" = "public" ]; then
        echo "Port 43594 is public."
        exit 0
      fi
      sleep 10
    done
    echo "Could not make port 43594 public. In the Ports tab: right-click 43594 > Port Visibility > Public."
  ) > /tmp/ports-visibility.log 2>&1 &
fi
# The Quest Helper bridge for codespaces made before it was set up automatically: token, upstream
# and build in the background (skipped when done; needs the Java 21 of a rebuilt container).
(bash scripts/quest-helper-setup.sh > /tmp/quest-helper-setup.log 2>&1 &)
