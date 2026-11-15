// Run: node --test tests/save-backups.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const SaveBackups = require("../plugins/persistence/SaveBackups.plugin");

const { backup } = SaveBackups._test;

function world() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "save-backups-"));
  const saves = path.join(dir, "saves");
  const root = path.join(dir, "backups");
  fs.mkdirSync(saves);
  const database = path.join(saves, "players.sqlite");
  const db = new DatabaseSync(database);
  db.exec("CREATE TABLE players (name TEXT PRIMARY KEY, data TEXT)");
  db.exec("INSERT INTO players VALUES ('mark', 'level 3')");
  db.close();
  fs.writeFileSync(path.join(saves, "accounts.json"), "{}");
  fs.writeFileSync(path.join(saves, "players.sqlite.pid"), "123");
  return { dir, saves, root, database };
}

const at = (minutes) => new Date(Date.UTC(2026, 10, 15, 12, minutes));

test("a backup copies the database and the save files, but not SQLite's side files", () => {
  const { saves, root, database } = world();
  const kept = backup({ saves, database, root, now: at(0) });
  assert.ok(kept);
  const files = fs.readdirSync(kept).sort();
  assert.deepEqual(files, ["accounts.json", "fingerprint.txt", "players.sqlite"]);
  const copy = new DatabaseSync(path.join(kept, "players.sqlite"));
  assert.equal(copy.prepare("SELECT data FROM players WHERE name = 'mark'").get().data, "level 3");
  copy.close();
});

test("nothing changed: no new backup; a change: a new one", () => {
  const { saves, root, database } = world();
  assert.ok(backup({ saves, database, root, now: at(0) }));
  assert.equal(backup({ saves, database, root, now: at(60) }), null);
  fs.writeFileSync(path.join(saves, "accounts.json"), "{\"mark\":{}}");
  assert.ok(backup({ saves, database, root, now: at(120) }));
  const db = new DatabaseSync(database);
  db.exec("UPDATE players SET data = 'level 99' WHERE name = 'mark'");
  db.close();
  assert.ok(backup({ saves, database, root, now: at(180) }));
  assert.equal(fs.readdirSync(root).length, 3);
});

test("only the newest `keep` backups stay", () => {
  const { saves, root, database } = world();
  for (let hour = 0; hour < 5; hour++) {
    fs.writeFileSync(path.join(saves, "accounts.json"), JSON.stringify({ hour }));
    backup({ saves, database, root, keep: 3, now: at(hour * 60) });
  }
  const left = fs.readdirSync(root).sort();
  assert.equal(left.length, 3);
  assert.ok(left[0].startsWith("2026-11-15T14"), left[0]);
});

test("the weekly push is due a week after the last one, and retried a day after a failed try", () => {
  const { pushDue, PUSH_EVERY_MS, PUSH_RETRY_MS } = SaveBackups._test;
  const now = Date.UTC(2026, 10, 22);
  assert.equal(pushDue(now, 0, 0), true, "never pushed");
  assert.equal(pushDue(now, now - PUSH_EVERY_MS + 1000, 0), false, "pushed less than a week ago");
  assert.equal(pushDue(now, now - PUSH_EVERY_MS, 0), true);
  assert.equal(pushDue(now, 0, now - PUSH_RETRY_MS + 1000), false, "tried less than a day ago");
});
