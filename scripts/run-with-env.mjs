import { spawnSync } from "node:child_process";
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
    // about the game (they stay in `yarn build`).
    env.DISABLE_ESLINT_PLUGIN ??= "true";
  }
}
// Node's "SQLite is an experimental feature" notice on every server start.
if (packageDir === resolve(rootDir, "server") && !String(env.NODE_OPTIONS ?? "").includes("--disable-warning")) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --disable-warning=ExperimentalWarning`.trim();
}

const result = spawnSync(
  process.execPath,
  command,
  { env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
