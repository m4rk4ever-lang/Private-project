/**
 * Save backups: every hour, and when the server stops, a copy of data/saves (the players
 * database, accounts.json, display names, clans, bans ...) in data/backups/<time>/, only when
 * something changed since the last copy. The newest `SaveBackups:keep` copies (48 by default,
 * two days of hourly copies) are kept.
 *
 * Once a week (at most once every 7 days, checked hourly while the server runs: a codespace sleeps
 * when idle, so a fixed day would be missed) the newest copy also goes to the repository's `saves`
 * branch through scripts/push-saves.sh, which refuses while the repository is public. Turn this off
 * with `SaveBackups:pushWeekly` false; push by hand with `yarn saves:push`.
 *
 * The database is copied with VACUUM INTO, as the rollback and import scripts do, so a copy
 * taken while the server writes is still consistent. Restore by stopping the server and copying
 * a backup's files back into data/saves (players.sqlite and accounts.json together, see
 * docs/player-saves.md).
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { spawn } = require("node:child_process");

const KEEP_CONFIG = "SaveBackups:keep";
const PUSH_CONFIG = "SaveBackups:pushWeekly";
const PUSH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
/** A failed push (a public repository, no network) is tried again a day later, not every hour. */
const PUSH_RETRY_MS = 24 * 60 * 60 * 1000;
const PUSH_STAMP_FILE = "last-push.txt";
const PUSH_LOG_FILE = "push.log";
const DEFAULT_KEEP = 48;
const TICKS_PER_HOUR = 6000; // 0.6 s ticks
const FINGERPRINT_FILE = "fingerprint.txt";
const DATABASE_FILE = "players.sqlite";
/** Files SQLite keeps beside the database while it is open; the VACUUM copy replaces them. */
const SKIPPED = /\.sqlite(-wal|-shm|-journal)?$|\.pid$|\.tmp$/;

let api = null;
let lastPushAttempt = 0;

function savesDirectory() {
  return path.join(process.cwd(), "data", "saves");
}

function backupsDirectory() {
  return path.join(process.cwd(), "data", "backups");
}

function databasePath() {
  return process.env.PLAYER_SAVE_DATABASE_PATH
    ? path.resolve(process.env.PLAYER_SAVE_DATABASE_PATH)
    : path.join(savesDirectory(), DATABASE_FILE);
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function hashFile(file, hash) {
  hash.update(path.basename(file));
  hash.update(fs.readFileSync(file));
}

/** The newest backup's fingerprint, or null when there is none. */
function lastFingerprint(root) {
  if (!fs.existsSync(root)) return null;
  const newest = fs.readdirSync(root).filter((name) => fs.existsSync(path.join(root, name, FINGERPRINT_FILE))).sort().at(-1);
  return newest ? fs.readFileSync(path.join(root, newest, FINGERPRINT_FILE), "utf8").trim() : null;
}

/** Deletes all but the newest `keep` backups. */
function prune(root, keep) {
  const backups = fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory()).sort();
  for (const name of backups.slice(0, Math.max(0, backups.length - keep))) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true });
  }
}

/**
 * Copies the saves into a new backup directory; keeps it only when it differs from the newest one.
 * Returns the directory it kept, or null when nothing changed or there was nothing to copy.
 */
function backup({ saves = savesDirectory(), database = databasePath(), root = backupsDirectory(), keep = DEFAULT_KEEP, now = new Date() } = {}) {
  if (!fs.existsSync(saves) && !fs.existsSync(database)) return null;
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, stamp(now));
  const working = `${target}.tmp`;
  fs.rmSync(working, { recursive: true, force: true });
  fs.mkdirSync(working, { recursive: true });
  try {
    const hash = crypto.createHash("sha256");
    if (fs.existsSync(database)) {
      const copy = path.join(working, DATABASE_FILE);
      const source = new DatabaseSync(database);
      try {
        source.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
      } finally {
        source.close();
      }
      hashFile(copy, hash);
    }
    if (fs.existsSync(saves)) {
      for (const name of fs.readdirSync(saves).sort()) {
        const file = path.join(saves, name);
        if (SKIPPED.test(name) || !fs.statSync(file).isFile()) continue;
        fs.copyFileSync(file, path.join(working, name));
        hashFile(file, hash);
      }
    }
    const fingerprint = hash.digest("hex");
    if (fingerprint === lastFingerprint(root)) {
      fs.rmSync(working, { recursive: true, force: true });
      return null;
    }
    fs.writeFileSync(path.join(working, FINGERPRINT_FILE), `${fingerprint}\n`);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(working, target);
    prune(root, keep);
    return target;
  } catch (error) {
    fs.rmSync(working, { recursive: true, force: true });
    throw error;
  }
}

function keepCount() {
  const value = Number(api?.getPluginConfig?.(KEEP_CONFIG, DEFAULT_KEEP));
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_KEEP;
}

function runBackup(reason) {
  try {
    const kept = backup({ keep: keepCount() });
    if (kept) console.info(`[backups] ${reason}: saved ${path.relative(process.cwd(), kept)}`);
  } catch (error) {
    console.warn(`[backups] ${reason} backup failed:`, error);
  }
}

/** Seconds-since-epoch of the last successful push (the script writes it), or 0. */
function lastPushTime(root = backupsDirectory()) {
  try {
    return Number(fs.readFileSync(path.join(root, PUSH_STAMP_FILE), "utf8").trim()) * 1000 || 0;
  } catch {
    return 0;
  }
}

/** Whether a weekly push is due: a week since the last one, and a day since the last attempt. */
function pushDue(now = Date.now(), lastPush = lastPushTime(), lastAttempt = lastPushAttempt) {
  return now - lastPush >= PUSH_EVERY_MS && now - lastAttempt >= PUSH_RETRY_MS;
}

function maybePushWeekly() {
  if (api?.getPluginConfig?.(PUSH_CONFIG, true) === false || !pushDue()) return;
  const script = path.resolve(process.cwd(), "..", "scripts", "push-saves.sh");
  if (!fs.existsSync(script)) return;
  lastPushAttempt = Date.now();
  fs.mkdirSync(backupsDirectory(), { recursive: true });
  const log = fs.openSync(path.join(backupsDirectory(), PUSH_LOG_FILE), "a");
  const child = spawn("bash", [script], { cwd: path.dirname(path.dirname(script)), stdio: ["ignore", log, log], detached: true });
  child.on("exit", (code) => console.info(`[backups] weekly push to the saves branch ${code === 0 ? "done" : `failed (see data/backups/${PUSH_LOG_FILE})`}`));
  child.unref();
}

function startHourlyBackups() {
  const { Task, TaskManager } = api.core;
  TaskManager.submit(new (class extends Task {
    constructor() { super(TICKS_PER_HOUR, false); }
    execute() {
      runBackup("hourly");
      maybePushWeekly();
    }
  })());
}

function backupOnShutdown() {
  runBackup("shutdown");
}

function init(pluginApi) {
  api = pluginApi;
}

module.exports = {
  name: "SaveBackups",
  description: "Copies data/saves to data/backups every hour and when the server stops, only when something changed, keeping the newest 48 copies; weekly the newest goes to the repository's saves branch.",
  config: {
    [PUSH_CONFIG]: {
      type: "boolean", label: "Push backups weekly", default: true,
      help: "Once every 7 days, store the newest backup on the repository's saves branch (only while the repository is private).",
    },
    [KEEP_CONFIG]: {
      type: "number", label: "Backups kept", default: DEFAULT_KEEP, min: 1,
      help: "How many backups of data/saves to keep; the oldest go first. One is made each hour something changed.",
    },
  },
  register(pluginApi) {
    init(pluginApi);
    pluginApi.onServerStartup(startHourlyBackups);
    pluginApi.onServerShutdown(backupOnShutdown);
  },
  _test: { backup, prune, stamp, pushDue, PUSH_EVERY_MS, PUSH_RETRY_MS },
};
