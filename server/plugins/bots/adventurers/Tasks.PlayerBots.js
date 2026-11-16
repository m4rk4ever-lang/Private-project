"use strict";

/**
 * An adventurer's current job, saved so a restart does not cost it the job: one record
 * (attribute adventurers:task) that is overwritten when a job starts and every few minutes while
 * it runs, never appended. After a restart it takes the job up again for the time it had left.
 */

/** A saved job older than this is stale (the world moved on): it plans afresh. */
const TASK_STALE_MS = 6 * 60 * 60_000;
/** A resumed job runs at least this long, so it is worth the walk back (not two fish and off). */
const MIN_RESUME_MS = 10 * 60_000;

/** The job as a plain record (a boss by its id), or null for one that is not saved. */
function taskRecord(entry, nowMs, wallMs) {
  const plan = entry?.plan;
  if (!plan || (entry.phase !== "training" && entry.phase !== "boss")) return null;
  if (plan.kind !== "train" && plan.kind !== "boss") return null;
  return {
    kind: plan.kind,
    mode: plan.mode ?? null,
    skill: plan.skill ?? null,
    reason: plan.reason ?? null,
    style: plan.style ?? null,
    // The level the stretch was for (a quest's combat 10): without it a resumed job ran on.
    target: plan.target?.skill ? { skill: plan.target.skill, level: plan.target.level } : null,
    bossId: plan.boss?.id ?? null,
    activity: entry.activity ?? null,
    remainingMs: Math.max(0, Math.round((entry.until ?? nowMs) - nowMs)),
    savedAt: wallMs,
  };
}

/** The saved record, if it is recent and a kind it can take up again; else null. */
function freshTask(task, wallMs) {
  if (!task || typeof task !== "object" || (task.kind !== "train" && task.kind !== "boss")) return null;
  if (!Number.isFinite(task.savedAt) || wallMs - task.savedAt > TASK_STALE_MS || wallMs < task.savedAt - 60_000) return null;
  if (task.kind === "train" && !task.mode) return null;
  return task;
}

/**
 * The level a saved job was for: its own field, or read from its reason ("The Restless Ghost
 * (combat 10)") for a record saved before the field existed, so that job too stops there.
 */
function targetOf(task) {
  if (task?.target?.skill) return { skill: task.target.skill, level: task.target.level };
  const match = /\(([a-z]+) (\d+)\)\s*$/i.exec(String(task?.reason ?? ""));
  return match ? { skill: match[1].toUpperCase(), level: Number(match[2]) } : null;
}

/** The planner's plan for a saved record (a boss looked up by id), or null when it is gone. */
function planOf(task, bosses = []) {
  if (!task) return null;
  if (task.kind === "boss") {
    const boss = bosses.find((entry) => entry.id === task.bossId);
    return boss ? { kind: "boss", boss, reason: task.reason ?? "verder" } : null;
  }
  return {
    kind: "train", mode: task.mode, skill: task.skill, reason: task.reason ?? "verder",
    ...(task.style ? { style: task.style } : {}),
    ...(targetOf(task) ? { target: targetOf(task) } : {}),
  };
}

/** How long the resumed job still runs. */
function resumeMs(task) {
  return Math.max(MIN_RESUME_MS, Number(task?.remainingMs) || 0);
}

module.exports = { taskRecord, freshTask, planOf, resumeMs, TASK_STALE_MS, MIN_RESUME_MS };
