import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const [mode, ...command] = process.argv.slice(2);
if (!mode || command.length === 0) {
  throw new Error("Usage: run-with-env.mjs <development|production|-> <script> [...args]");
}

const packageDir = process.cwd();
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFiles = [resolve(rootDir, ".env"), resolve(packageDir, ".env")];

if (mode !== "-") {
  envFiles.push(
    resolve(packageDir, `.env.${mode}`),
    resolve(packageDir, ".env.local"),
    resolve(packageDir, `.env.${mode}.local`),
  );
}

const loadedEnv = {};
for (const file of envFiles.filter(existsSync)) {
  Object.assign(loadedEnv, parseEnv(readFileSync(file, "utf8")));
}
const env = { ...loadedEnv, ...process.env };

if (packageDir === resolve(rootDir, "client")) {
  env.REACT_APP_WEBRTC_SIGNAL_URL ??= env.WEBRTC_SIGNAL_URL;
  env.REACT_APP_WEBRTC_ICE_SERVERS ??= env.WEBRTC_ICE_SERVERS;
  if (mode === "development") {
    // The dev server stops when its input closes unless CI is set, and `yarn start` runs it
    // without input (concurrently): it compiled and then exited, taking the server down too.
    env.CI ??= "true";
    // No lint pass on every start and rebuild: a page of style warnings that say nothing
    // about the game (they stay in `yarn build`). Read by craco.config.js.
    env.CLIENT_LINT ??= "0";
  }
}
// Node's "SQLite is an experimental feature" notice on every server start.
if (packageDir === resolve(rootDir, "server") && !String(env.NODE_OPTIONS ?? "").includes("--disable-warning")) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --disable-warning=ExperimentalWarning`.trim();
}

const isDevClient = packageDir === resolve(rootDir, "client") && mode === "development";

if (!isDevClient) {
  const result = spawnSync(
    process.execPath,
    command,
    { env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// The dev client: report who stopped it, and start it again when it stops on its own while
// nobody asked (a stop signal to this runner, such as Ctrl+C, ends it for good).
let stopping = null;
let child = null;
const restarts = [];
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!stopping) console.log(`[client] Stopsignaal ${signal} ontvangen: de client stopt.`);
    stopping = signal;
    killGroup(signal);
  });
}
// craco starts the dev server as a child of its own: signal the whole group, or that child
// lives on as an orphan holding port 3000.
function killGroup(signal) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
let runs = 0;
function run() {
  // A restart opens no new browser tabs: the game and the adventurers page are already open.
  const runEnv = runs++ === 0 ? env : { ...env, BROWSER: "none" };
  child = spawn(process.execPath, command, { env: runEnv, stdio: "inherit", detached: true });
  child.on("exit", (code, signal) => {
    // Its dev server too, before anything starts again.
    killGroup("SIGKILL");
    if (stopping) process.exit(code ?? 0);
    const now = Date.now();
    restarts.push(now);
    while (restarts.length > 0 && now - restarts[0] > 60_000) restarts.shift();
    const why = signal ? `signaal ${signal}` : `code ${code}`;
    if (restarts.length > 3) {
      console.log(`[client] De client stopte steeds (${why}). Ik stop met herstarten.`);
      process.exit(code ?? 1);
    }
    console.log(`[client] De client stopte onverwacht (${why}). Opnieuw starten...`);
    setTimeout(run, 2000);
  });
}
run();
