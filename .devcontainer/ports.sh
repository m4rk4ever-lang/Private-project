#!/usr/bin/env bash
# Runs on every codespace start. The game client's page (port 3000) stays private:
# only you, signed in to GitHub, can open it. The browser's WebSocket to the game
# server (port 43594) cannot send that GitHub sign-in, so that port must be public.
if [ -n "${CODESPACE_NAME:-}" ]; then
  if gh codespace ports visibility 43594:public -c "$CODESPACE_NAME" >/dev/null 2>&1; then
    echo "Port 43594 is public."
  else
    echo "Could not make port 43594 public. In the Ports tab: right-click 43594 > Port Visibility > Public."
  fi
fi
