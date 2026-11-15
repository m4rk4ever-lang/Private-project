#!/usr/bin/env bash
# Stops a running game: its server, client and admin panel, from any terminal, also one that
# hangs while shutting down or that another terminal (or the codespace itself) started.
# Used by `update` and before every `yarn start`, so a second copy never fights the first
# over the ports. Exits 1 when a port stays busy.
#
# A codespace does not let us see which process holds a port (ss shows no owner, and other
# processes' /proc/<pid>/fd and cwd are closed to us), so the game's processes are found by
# their command line, which stays readable: a node, yarn or tsx process whose command names
# this checkout. VS Code's own processes are never touched.
set -uo pipefail
cd "$(dirname "$0")/.."
PORTS_RE=':(3000|43594|49600) '
ports_busy() { ss -ltnH 2>/dev/null | grep -qE "$PORTS_RE"; }
if ! ports_busy; then exit 0; fi
echo "[game] Er draait nog een spel. Dat stop ik eerst..."

SUDO=""
if sudo -n true 2>/dev/null; then SUDO="sudo -n"; fi
repo=$(pwd)
repo_real=$(pwd -P)

# This script and the processes that started it (the `yarn start` or `update` running it).
keep=" $$ "
p=$$
while [ -n "$p" ] && [ "$p" -gt 1 ]; do
  p=$(awk '/^PPid:/ { print $2 }' "/proc/$p/status" 2>/dev/null)
  keep="$keep$p "
done

game_pids() {
  for dir in /proc/[0-9]*; do
    pid=${dir#/proc/}
    case "$keep" in *" $pid "*) continue ;; esac
    cmd=$(tr '\0' ' ' < "$dir/cmdline" 2>/dev/null) || continue
    [ -n "$cmd" ] || continue
    # The editor (VS Code's server, extensions, terminals) also runs node.
    case "$cmd" in *vscode*|*code-server*) continue ;; esac
    exe=${cmd%% *}
    case "${exe##*/}" in node|yarn|tsx|npm|npx|nodemon|ts-node|concurrently|esbuild|sh|bash) ;; *) continue ;; esac
    # Ours: the command names this checkout, or one of the game's own scripts.
    case "$cmd" in
      *"$repo/"*|*"$repo_real/"*|*elvarg/Server.ts*|*local-panel.cjs*|*craco*|*run-with-env.mjs*|*"--names server,client"*) echo "$pid" ;;
    esac
  done
}

stop_all() {
  local signal=$1
  for pid in $(game_pids); do $SUDO kill "-$signal" "$pid" 2>/dev/null; done
}

# Politely first: the server saves everyone before it stops. Up to 20 seconds.
stop_all TERM
for _ in $(seq 1 20); do
  ports_busy || break
  sleep 1
done
# Whatever is left (a server that hangs while shutting down, an orphaned client): force it.
if ports_busy; then
  stop_all KILL
  for _ in $(seq 1 10); do
    ports_busy || break
    sleep 1
  done
fi
if ports_busy; then
  echo "[game] Er draait nog iets op poort 3000, 43594 of 49600 dat ik niet kan stoppen:"
  ss -ltnH 2>/dev/null | grep -E "$PORTS_RE"
  echo "[game] Gebruiker: $(whoami), sudo: $([ -n "$SUDO" ] && echo ja || echo nee)"
  ps -eo pid,ppid,stat,etime,args 2>/dev/null | grep -E 'node|yarn|tsx' | grep -v -E 'grep|vscode' | cut -c1-160
  echo "[game] Stop de codespace op github.com/codespaces en open hem weer; dan is de poort vrij."
  echo "[game] Stuur deze regels door, dan los ik het op."
  exit 1
fi
echo "[game] Gestopt."
