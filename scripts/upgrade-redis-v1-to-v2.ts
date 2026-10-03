/**
 * Upgrades data written by the first Redis version of Tim (flat Project →
 * Module → Task, single assignee) to the current model (sub modules,
 * multiple assignees, per-level time aggregates). Never runs automatically.
 *
 * Usage:
 *   npm run upgrade:redis            # dry run: prints what would change
 *   npm run upgrade:redis -- --apply # writes
 *
 * Target comes from UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 * It is idempotent: records already in the new shape are left alone, and the
 * run is recorded under "schema:version". Back up the database first
 * (Upstash console → Backups) when running against production.
 */
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { asStringArray, toRawHash } from "@/lib/redis/serialize";

const APPLY = process.argv.includes("--apply");
const log = (msg: string) => console.log(`${APPLY ? "" : "[dry] "}${msg}`);

async function rename(from: string, to: string): Promise<void> {
  const r = redis();
  if (!(await r.exists(from))) return;
  if (await r.exists(to)) {
    log(`skip rename ${from} → ${to} (target exists)`);
    return;
  }
  log(`rename ${from} → ${to}`);
  if (APPLY) await r.rename(from, to);
}

async function hset(key: string, values: Record<string, string>): Promise<void> {
  if (Object.keys(values).length === 0) return;
  log(`update ${key}: ${Object.keys(values).join(", ")}`);
  if (APPLY) await redis().hset(key, values);
}

const PROJECT_STATUS: Record<string, string> = { PLANNED: "PLANNING", ACTIVE: "ACTIVE", ON_HOLD: "ON_HOLD", COMPLETED: "COMPLETED" };
const TASK_STATUS: Record<string, string> = { BACKLOG: "TODO", TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", REVIEW: "REVIEW", BLOCKED: "BLOCKED", DONE: "DONE" };
const PRIORITY: Record<string, string> = { NONE: "MEDIUM", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", URGENT: "URGENT" };

async function main() {
  const r = redis();
  console.log(APPLY ? "Mode: APPLY" : "Mode: dry run (add --apply to write)");
  if ((await r.get<string>("schema:version")) === "2") {
    console.log("Already at schema version 2. Nothing to do.");
    return;
  }

  // Users: per-user index names changed; profile fields are completed on next sign-in.
  const userKeys = asStringArray(await r.keys("user:*")).filter((k) => /^user:[0-9a-f-]{36}$/.test(k));
  for (const key of userKeys) {
    const id = key.slice("user:".length);
    await rename(`user:${id}:assigned`, keys.userTasks(id));
    await rename(`user:${id}:time_logs`, keys.userTimeLogs(id));
    await rename(`timer:${id}`, keys.userTimer(id));
    const u = toRawHash(await r.hgetall(key)) ?? {};
    const patch: Record<string, string> = {};
    if (!u.status) patch.status = u.emailVerified ? "VERIFIED" : "UNVERIFIED";
    if (!u.role) patch.role = "USER";
    if (!u.providerAvatar && u.avatar) patch.providerAvatar = u.avatar;
    await hset(key, patch);
    if (APPLY) await r.zadd(keys.users(), { score: Number(u.createdAt) || Date.now(), member: id });
  }

  const projectIds = asStringArray(await r.keys("project:*"))
    .filter((k) => /^project:[0-9a-f-]{36}$/.test(k))
    .map((k) => k.slice("project:".length));

  for (const projectId of projectIds) {
    const p = toRawHash(await r.hgetall(keys.project(projectId))) ?? {};
    const patch: Record<string, string> = {};
    if (p.targetDate !== undefined && p.dueDate === undefined) patch.dueDate = p.targetDate;
    if (p.archived === "1") patch.status = "ARCHIVED";
    else if (p.status && PROJECT_STATUS[p.status] && PROJECT_STATUS[p.status] !== p.status) patch.status = PROJECT_STATUS[p.status] ?? "ACTIVE";
    if (!p.color) patch.color = "blue";
    await hset(keys.project(projectId), patch);
    if (APPLY && (p.targetDate !== undefined || p.archived !== undefined)) await r.hdel(keys.project(projectId), "targetDate", "archived");
    await rename(`project:${projectId}:activity`, keys.projectActivities(projectId));

    // Modules: ownerId → leadId.
    for (const moduleId of asStringArray(await r.zrange(keys.projectModules(projectId), 0, -1))) {
      const m = toRawHash(await r.hgetall(keys.module(moduleId))) ?? {};
      if (m.ownerId !== undefined && m.leadId === undefined) {
        await hset(keys.module(moduleId), { leadId: m.ownerId });
        if (APPLY) await r.hdel(keys.module(moduleId), "ownerId");
      }
    }

    // Tasks: new field names and values, renamed child keys, rebuilt time aggregates.
    const projectTime: Record<string, number> = {};
    const moduleTime = new Map<string, Record<string, number>>();
    for (const taskId of asStringArray(await r.zrange(keys.projectTasks(projectId), 0, -1))) {
      const t = toRawHash(await r.hgetall(keys.task(taskId))) ?? {};
      if (!t.id) continue;
      const tp: Record<string, string> = {};
      if (t.assigneeIds === undefined) tp.assigneeIds = JSON.stringify(t.assigneeId ? [t.assigneeId] : []);
      if (t.estimatedMinutes === undefined) tp.estimatedMinutes = t.estimateMinutes ?? "";
      if (t.subModuleId === undefined) tp.subModuleId = "";
      if (t.order === undefined) tp.order = t.createdAt ?? String(Date.now());
      const status = TASK_STATUS[t.status ?? ""] ?? "TODO";
      if (status !== t.status) tp.status = status;
      const priority = PRIORITY[t.priority ?? ""] ?? "MEDIUM";
      if (priority !== t.priority) tp.priority = priority;
      await hset(keys.task(taskId), tp);
      if (APPLY && (t.assigneeId !== undefined || t.estimateMinutes !== undefined)) {
        await r.hdel(keys.task(taskId), "assigneeId", "estimateMinutes");
      }
      await rename(`task:${taskId}:time_logs`, keys.taskTimeLogs(taskId));
      await rename(`task:${taskId}:activity`, keys.taskActivities(taskId));

      const taskTime: Record<string, number> = {};
      const logIds = asStringArray(await r.zrange(APPLY ? keys.taskTimeLogs(taskId) : `task:${taskId}:time_logs`, 0, -1));
      for (const logId of logIds) {
        await rename(`time_log:${logId}`, keys.timeLog(logId));
        const l = toRawHash(await r.hgetall(APPLY ? keys.timeLog(logId) : `time_log:${logId}`)) ?? {};
        const seconds = Number(l.durationSeconds) || 0;
        const userId = l.userId ?? "";
        if (!l.createdAt) await hset(keys.timeLog(logId), { createdAt: l.endedAt ?? String(Date.now()) });
        for (const bucket of [taskTime, projectTime]) {
          bucket.total = (bucket.total ?? 0) + seconds;
          if (userId) bucket[userId] = (bucket[userId] ?? 0) + seconds;
        }
        const mt = moduleTime.get(t.moduleId ?? "") ?? {};
        mt.total = (mt.total ?? 0) + seconds;
        if (userId) mt[userId] = (mt[userId] ?? 0) + seconds;
        moduleTime.set(t.moduleId ?? "", mt);
      }
      if (Object.keys(taskTime).length > 0) {
        log(`rebuild ${keys.taskTime(taskId)}`);
        if (APPLY) {
          await r.del(keys.taskTime(taskId));
          await r.hset(keys.taskTime(taskId), Object.fromEntries(Object.entries(taskTime).map(([k, v]) => [k, String(v)])));
        }
      }
    }
    if (APPLY) {
      await r.del(keys.projectTime(projectId));
      if (Object.keys(projectTime).length > 0) {
        await r.hset(keys.projectTime(projectId), Object.fromEntries(Object.entries(projectTime).map(([k, v]) => [k, String(v)])));
      }
      for (const [moduleId, values] of moduleTime) {
        if (!moduleId) continue;
        await r.del(keys.moduleTime(moduleId));
        await r.hset(keys.moduleTime(moduleId), Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])));
      }
    }
    log(`project ${projectId}: done`);
  }

  if (APPLY) await r.set("schema:version", "2");
  console.log(APPLY ? "Upgrade complete." : "Dry run complete. Nothing was written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
