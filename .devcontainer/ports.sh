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
  if gh codespace ports visibility 43594:public -c "$CODESPACE_NAME" >/dev/null 2>&1; then
    echo "Port 43594 is public."
  else
    echo "Could not make port 43594 public. In the Ports tab: right-click 43594 > Port Visibility > Public."
  fi
fi
