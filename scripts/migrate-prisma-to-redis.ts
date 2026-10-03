/**
 * Optional one-off migration from the old Prisma/PostgreSQL database to the
 * Redis data model. It is never run automatically.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgresql://... npm run migrate:prisma            # dry run, no writes
 *   SOURCE_DATABASE_URL=postgresql://... npm run migrate:prisma -- --apply # write to Redis
 *
 * Target Redis comes from UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 * The source database is only read. Re-running is safe: every migrated record
 * is remembered under "migration:prisma:*" and skipped next time.
 *
 * Mapping:
 * - User           → user (provider "legacy"); linked to Google on first sign-in by email
 * - Project        → project with a generated key; creator becomes OWNER
 * - ProjectMember  → membership (LEAD/MEMBER/VIEWER kept)
 * - Task           → task in a module "Umum" (no sub module); old ids are replaced by UUIDs
 * - Comment, TimeLog → comments and time logs with original timestamps
 * - Notification, ActivityLog → not migrated (free-text, transient history)
 * - Task.proof_image (base64) → not copied into Redis; reported so files can be re-uploaded
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { toHash } from "@/lib/redis/serialize";
import { createProject } from "@/lib/redis/projects";
import { addMember } from "@/lib/redis/members";
import { createModule } from "@/lib/redis/modules";
import { createTask } from "@/lib/redis/tasks";
import { createComment } from "@/lib/redis/comments";
import { recordTimeLog } from "@/lib/redis/timeLogs";
import { getUser, normalizeUsername, reindexUserSearch } from "@/lib/redis/users";
import type { ProjectRole, ProjectStatus } from "@/types/project";
import type { Task, TaskPriority, TaskStatus } from "@/types/task";
import type { User } from "@/types/user";

const APPLY = process.argv.includes("--apply");
const mapKey = (kind: string, oldId: string) => `migration:prisma:${kind}:${oldId}`;

interface Row {
  [column: string]: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const ms = (v: unknown) => (v instanceof Date ? v.getTime() : v ? new Date(String(v)).getTime() : Date.now());
const isoDate = (v: unknown) => (v ? new Date(ms(v)).toISOString().slice(0, 10) : null);

async function mapped(kind: string, oldId: string): Promise<string | null> {
  return (await redis().get<string>(mapKey(kind, oldId))) ?? null;
}

async function remember(kind: string, oldId: string, newId: string): Promise<void> {
  if (APPLY) await redis().set(mapKey(kind, oldId), newId);
}

async function query(db: Client, sql: string): Promise<Row[]> {
  try {
    return (await db.query(sql)).rows as Row[];
  } catch (error) {
    console.warn(`  ! skipped query (${(error as Error).message})`);
    return [];
  }
}

async function claimUsername(base: string, userId: string): Promise<string> {
  const root = normalizeUsername(base).padEnd(3, "0");
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 26)}${i + 1}`;
    if ((await redis().set(keys.userByUsername(candidate), userId, { nx: true })) === "OK") return candidate;
  }
  return `${root.slice(0, 20)}${randomUUID().slice(0, 8)}`;
}

async function freeProjectKey(name: string): Promise<string> {
  const letters = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  let base = (letters.length > 1 ? letters.map((w) => w[0]).join("") : (letters[0] ?? "PRJ")).slice(0, 4);
  if (!/^[A-Z]/.test(base)) base = `P${base}`.slice(0, 4);
  base = base.padEnd(2, "X");
  for (let i = 0; i < 99; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 4)}${i + 1}`;
    if (!(await redis().exists(keys.projectByKey(candidate)))) return candidate;
  }
  return `P${randomUUID().replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase()}`;
}

const STATUS: Record<string, TaskStatus> = { TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", REVIEW: "REVIEW", DONE: "DONE" };
const PRIORITY: Record<string, TaskPriority> = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" };
const PROJECT_STATUS: Record<string, ProjectStatus> = { ACTIVE: "ACTIVE", COMPLETED: "COMPLETED", ARCHIVED: "ARCHIVED" };
const ROLE: Record<string, ProjectRole> = { LEAD: "LEAD", MEMBER: "MEMBER", VIEWER: "VIEWER" };

async function main() {
  const source = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!source) throw new Error("Set SOURCE_DATABASE_URL to the old PostgreSQL database.");
  console.log(APPLY ? "Mode: APPLY (writes to Redis)" : "Mode: dry run (no writes). Add --apply to migrate.");

  const db = new Client({ connectionString: source });
  await db.connect();
  const counts = { users: 0, projects: 0, members: 0, tasks: 0, comments: 0, timeLogs: 0, skippedProofImages: 0 };

  // Users
  const accounts = await query(db, `SELECT "userId", provider, "providerAccountId" FROM "Account"`);
  const userMap = new Map<string, string>();
  for (const u of await query(db, `SELECT * FROM "User" WHERE email IS NOT NULL`)) {
    const oldId = str(u.id);
    const email = str(u.email).toLowerCase();
    const existing = (await mapped("user", oldId)) ?? ((await redis().get<string>(keys.userByEmail(email))) ?? null);
    if (existing) {
      userMap.set(oldId, existing);
      continue;
    }
    const id = randomUUID();
    userMap.set(oldId, id);
    counts.users++;
    if (!APPLY) continue;
    if ((await redis().set(keys.userByEmail(email), id, { nx: true })) !== "OK") continue;
    const account = accounts.find((a) => str(a.userId) === oldId);
    const now = Date.now();
    const user: User = {
      id,
      name: str(u.name) || email.split("@")[0] || email,
      username: await claimUsername(str(u.github_username) || email.split("@")[0] || "user", id),
      email,
      emailVerified: u.emailVerified ? ms(u.emailVerified) : null,
      avatar: str(u.image) || null,
      providerAvatar: str(u.image) || null,
      jobTitle: "",
      bio: "",
      whatsapp: "",
      location: "",
      timezone: "Asia/Jakarta",
      themePreference: "system",
      provider: "legacy",
      providerAccountId: account ? `${str(account.provider)}:${str(account.providerAccountId)}` : oldId,
      // Old GitHub logins were not email-verified; the account verifies on its first Google sign-in.
      status: "UNVERIFIED",
      role: str(u.role) === "ADMIN" ? "ADMIN" : "USER",
      sessionVersion: 0,
      createdAt: ms(u.created_at),
      updatedAt: now,
    };
    await redis().hset(keys.user(id), toHash({ ...user }));
    await redis().zadd(keys.users(), { score: user.createdAt, member: id });
    await reindexUserSearch(null, user);
    await remember("user", oldId, id);
  }

  // Projects, members and a default module per project
  const members = await query(db, `SELECT * FROM "ProjectMember"`);
  const moduleOf = new Map<string, string>();
  const projectKeyOf = new Map<string, string>();
  for (const p of await query(db, `SELECT * FROM "Project"`)) {
    const oldId = str(p.id);
    const done = await mapped("project", oldId);
    if (done) {
      const mod = await mapped("module", oldId);
      if (mod) moduleOf.set(oldId, mod);
      projectKeyOf.set(oldId, str(await redis().hget<string>(keys.project(done), "key")));
      continue;
    }
    const ownerId = userMap.get(str(p.created_by));
    const owner = ownerId && APPLY ? await getUser(ownerId) : null;
    if (!ownerId || (APPLY && !owner)) {
      console.warn(`  ! project ${oldId} skipped: creator not migrated`);
      continue;
    }
    counts.projects++;
    const projectMembers = members.filter((m) => str(m.project_id) === oldId && str(m.user_id) !== str(p.created_by));
    counts.members += projectMembers.length;
    if (!APPLY || !owner) {
      moduleOf.set(oldId, "dry-run");
      continue;
    }
    const project = await createProject(
      {
        key: await freeProjectKey(str(p.name)),
        name: str(p.name).slice(0, 80) || "Proyek",
        description: str(p.description).slice(0, 2000),
        icon: "folder",
        color: "blue",
        status: PROJECT_STATUS[str(p.status)] ?? "ACTIVE",
        startDate: isoDate(p.start_date),
        dueDate: isoDate(p.deadline),
      },
      owner,
    );
    await redis().hset(keys.project(project.id), { createdAt: String(ms(p.created_at)) });
    for (const m of projectMembers) {
      const uid = userMap.get(str(m.user_id));
      const member = uid ? await getUser(uid) : null;
      if (member) await addMember(project.id, member, ROLE[str(m.role)] ?? "MEMBER", ms(p.created_at));
    }
    const mod = await createModule(project.id, { name: "Umum", description: "Tugas hasil migrasi dari sistem lama.", status: "IN_PROGRESS", leadId: null });
    moduleOf.set(oldId, mod.id);
    projectKeyOf.set(oldId, project.key);
    await remember("project", oldId, project.id);
    await remember("module", oldId, mod.id);
  }

  // Tasks
  const taskMap = new Map<string, Task>();
  for (const t of await query(db, `SELECT * FROM "Task" ORDER BY created_at`)) {
    const oldId = str(t.id);
    const already = await mapped("task", oldId);
    if (already) continue;
    const projectId = await mapped("project", str(t.project_id));
    const moduleId = moduleOf.get(str(t.project_id));
    const creator = userMap.get(str(t.created_by));
    if (!moduleId || !creator || (APPLY && !projectId)) continue;
    counts.tasks++;
    if (t.proof_image) counts.skippedProofImages++;
    if (!APPLY || !projectId) continue;
    const assignee = t.assigned_to ? userMap.get(str(t.assigned_to)) : undefined;
    const startDate = isoDate(t.start_date);
    let dueDate = isoDate(t.deadline);
    if (startDate && dueDate && dueDate < startDate) dueDate = startDate;
    const task = await createTask(
      {
        projectId,
        moduleId,
        subModuleId: null,
        title: str(t.title).slice(0, 200) || "Tugas",
        description: str(t.description).slice(0, 10_000),
        status: STATUS[str(t.status)] ?? "TODO",
        priority: PRIORITY[str(t.priority)] ?? "MEDIUM",
        assigneeIds: assignee ? [assignee] : [],
        startDate,
        dueDate,
        labels: [],
        estimatedMinutes: null,
        order: ms(t.created_at),
      },
      creator,
      projectKeyOf.get(str(t.project_id)) ?? "PRJ",
    );
    const notes = str(t.notes).slice(0, 3800);
    await redis().hset(keys.task(task.id), {
      createdAt: String(ms(t.created_at)),
      completionNotes: t.proof_image ? `${notes}${notes ? "\n\n" : ""}(Bukti gambar lama tidak dimigrasikan.)` : notes,
    });
    taskMap.set(oldId, task);
    await remember("task", oldId, task.id);
  }

  // Comments and time logs for tasks migrated in this run
  for (const c of await query(db, `SELECT * FROM "Comment" ORDER BY created_at`)) {
    const task = taskMap.get(str(c.task_id));
    const author = userMap.get(str(c.user_id));
    if (!task || !author) continue;
    counts.comments++;
    const comment = await createComment(task.id, author, str(c.content).slice(0, 5000));
    const at = ms(c.created_at);
    await redis().hset(keys.comment(comment.id), { createdAt: String(at), updatedAt: String(at) });
    await redis().zadd(keys.taskComments(task.id), { score: at, member: comment.id });
  }
  for (const l of await query(db, `SELECT * FROM "TimeLog"`)) {
    const task = taskMap.get(str(l.task_id));
    const userId = userMap.get(str(l.user_id));
    const seconds = Number(l.duration) || 0;
    if (!task || !userId || seconds <= 0) continue;
    counts.timeLogs++;
    const endedAt = ms(l.created_at);
    await recordTimeLog(task, { userId, startedAt: endedAt - seconds * 1000, endedAt, source: "timer", note: "Migrasi" });
  }

  await db.end();
  console.log("Summary:", counts);
  if (counts.skippedProofImages > 0) {
    console.log(`  ${counts.skippedProofImages} task(s) had base64 proof images. They were not copied; re-upload them as attachments if needed.`);
  }
  if (!APPLY) console.log("Dry run only. Nothing was written. Comments and time logs are counted when applying.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
