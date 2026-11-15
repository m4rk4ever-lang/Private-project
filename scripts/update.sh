#!/usr/bin/env bash
# `yarn update` (or `update` in a codespace terminal): stops the running game, fetches the
# newest version from GitHub, installs new dependencies when they changed, and starts the
# game again. Run it from any terminal; a game running in another terminal is stopped too.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "[update] Spel stoppen..."
PORTS_RE=':(3000|43594|49600) '
# Codespaces allow sudo without a password: it sees and stops processes of other users too
# (a game started by the codespace itself shows up as "process information unavailable").
SUDO=""
if sudo -n true 2>/dev/null; then SUDO="sudo -n"; fi
# The processes listening on the game's ports (client, game server, admin panel).
port_pids() {
  $SUDO ss -ltnpH 2>/dev/null | grep -E "$PORTS_RE" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}
ports_busy() {
  ss -ltnH 2>/dev/null | grep -qE "$PORTS_RE"
}
# First by name: the game's own processes (server panel, its nodemon and server, the client),
# never this script; then whatever still listens on the ports.
$SUDO pkill -f "scripts/local-panel.cjs" 2>/dev/null
$SUDO pkill -f "nodemon" 2>/dev/null
$SUDO pkill -f "elvarg/Server.ts" 2>/dev/null
$SUDO pkill -f "craco.js start" 2>/dev/null
$SUDO pkill -f "concurrently.*--names server,client" 2>/dev/null
for pid in $(port_pids); do $SUDO kill "$pid" 2>/dev/null; done
# The server saves everyone before it stops: give it up to 20 seconds, then force it.
for _ in $(seq 1 20); do
  ports_busy || break
  sleep 1
done
if ports_busy; then
  for pid in $(port_pids); do $SUDO kill -9 "$pid" 2>/dev/null; done
  sleep 2
fi
# A socket ss shows without its process (seen on port 3000): find its owner through /proc
# (the socket's inode in /proc/net/tcp, then the process holding that inode), and with
# fuser where it is installed.
inode_pids() {
  local port_hex inodes
  port_hex=$(printf '%04X' "$1")
  inodes=$(awk -v p=":$port_hex" '$2 ~ p"$" && $4 == "0A" { print $10 }' /proc/net/tcp /proc/net/tcp6 2>/dev/null | sort -u)
  for inode in $inodes; do
    $SUDO find /proc/[0-9]*/fd -lname "socket:\[$inode\]" 2>/dev/null | cut -d/ -f3
  done | sort -u
}
if ports_busy; then
  for port in 3000 43594 49600; do
    for pid in $(inode_pids "$port"); do $SUDO kill -9 "$pid" 2>/dev/null; done
    command -v fuser >/dev/null && $SUDO fuser -k -9 "$port/tcp" >/dev/null 2>&1
  done
  sleep 2
fi
# Last resort: every node, yarn or tsx process working inside this checkout (the game's server,
# client and their helpers), whoever started it. Never this script, its parents or the editor.
repo=$(pwd -P)
keep=" $$ $PPID "
p=$PPID
while [ -n "$p" ] && [ "$p" -gt 1 ]; do
  p=$(awk '/^PPid:/ { print $2 }' "/proc/$p/status" 2>/dev/null)
  keep="$keep$p "
done
game_pids() {
  for dir in /proc/[0-9]*; do
    pid=${dir#/proc/}
    case "$keep" in *" $pid "*) continue ;; esac
    comm=$(cat "$dir/comm" 2>/dev/null) || continue
    case "$comm" in node|yarn|tsx|npm|nodemon|concurrently|esbuild) ;; *) continue ;; esac
    cwd=$($SUDO readlink "$dir/cwd" 2>/dev/null) || continue
    case "$cwd" in "$repo"|"$repo"/*) echo "$pid" ;; esac
  done
}
if ports_busy; then
  for pid in $(game_pids); do $SUDO kill -9 "$pid" 2>/dev/null; done
  for _ in $(seq 1 10); do
    ports_busy || break
    sleep 1
  done
fi
if ports_busy; then
  echo "[update] Er draait nog iets op poort 3000, 43594 of 49600 dat ik niet kan stoppen:"
  $SUDO ss -ltnp 2>/dev/null | grep -E "$PORTS_RE"
  echo "[update] Gebruiker: $(whoami), sudo: $([ -n "$SUDO" ] && echo ja || echo nee)"
  ps -eo pid,user,stat,etime,args 2>/dev/null | grep -E 'node|yarn|tsx' | grep -v grep | cut -c1-160
  echo "[update] Stop de codespace op github.com/codespaces en open hem weer; dan is de poort vrij."
  echo "[update] Stuur deze regels door, dan los ik het op."
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

# Older codespaces were set up with the server name "Codespace": use the world's name.
if [ -f .env ] && grep -q '^REACT_APP_DEFAULT_SERVER_NAME=Codespace$' .env; then
  sed -i 's/^REACT_APP_DEFAULT_SERVER_NAME=Codespace$/REACT_APP_DEFAULT_SERVER_NAME=Realm of Eeshwar/' .env
fi

echo "[update] Spel starten..."
exec yarn start
