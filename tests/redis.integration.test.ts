import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Data-layer tests against a real Redis REST endpoint. They run only when
 * TEST_UPSTASH_REDIS_REST_URL / TEST_UPSTASH_REDIS_REST_TOKEN are set, and
 * use fresh random ids so they never touch existing data. Point them at a
 * disposable database, never production.
 */
const url = process.env.TEST_UPSTASH_REDIS_REST_URL;
const token = process.env.TEST_UPSTASH_REDIS_REST_TOKEN;

type Modules = {
  projects: typeof import("@/lib/redis/projects");
  members: typeof import("@/lib/redis/members");
  search: typeof import("@/lib/redis/search");
  modules: typeof import("@/lib/redis/modules");
  tasks: typeof import("@/lib/redis/tasks");
  timeLogs: typeof import("@/lib/redis/timeLogs");
  client: typeof import("@/lib/redis/client");
  users: typeof import("@/lib/redis/users");
  serialize: typeof import("@/lib/redis/serialize");
  keys: typeof import("@/lib/redis/keys");
};

describe.skipIf(!url || !token)("Redis data layer", () => {
  let m: Modules;
  const person = (name: string) => {
    const id = randomUUID();
    const handle = `${name.toLowerCase()}${id.slice(0, 6)}`;
    return { id, name, username: handle, email: `${handle}@test.local` };
  };
  const ownerP = person("Olivia Owner");
  const aliceP = person("Alice Anggota");
  const bobP = person("Bob Builder");
  const owner = ownerP.id;
  const alice = aliceP.id;
  const bob = bobP.id;
  const key = `T${randomUUID().replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}`;

  beforeAll(async () => {
    process.env.UPSTASH_REDIS_REST_URL = url;
    process.env.UPSTASH_REDIS_REST_TOKEN = token;
    m = {
      projects: await import("@/lib/redis/projects"),
      members: await import("@/lib/redis/members"),
      search: await import("@/lib/redis/search"),
      modules: await import("@/lib/redis/modules"),
      tasks: await import("@/lib/redis/tasks"),
      timeLogs: await import("@/lib/redis/timeLogs"),
      client: await import("@/lib/redis/client"),
      users: await import("@/lib/redis/users"),
      serialize: await import("@/lib/redis/serialize"),
      keys: await import("@/lib/redis/keys"),
    };
    // Member pages resolve user records, so the test people exist as users.
    const now = Date.now();
    for (const p of [ownerP, aliceP, bobP]) {
      const user = {
        ...p,
        emailVerified: now,
        avatar: null,
        providerAvatar: null,
        jobTitle: "",
        bio: "",
        whatsapp: "",
        location: "",
        timezone: "Asia/Jakarta",
        themePreference: "system" as const,
        provider: "test",
        providerAccountId: p.id,
        status: "VERIFIED" as const,
        role: "USER" as const,
        sessionVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      await m.client.redis().hset(m.keys.keys.user(p.id), m.serialize.toHash({ ...user }));
      await m.users.reindexUserSearch(null, user);
    }
  });

  afterAll(async () => {
    if (!m) return;
    const { searchTermsFor } = await import("./helpers/user-cleanup");
    for (const p of [ownerP, aliceP, bobP]) {
      await m.client.redis().del(m.keys.keys.user(p.id), m.keys.keys.userProjects(p.id));
      const terms = searchTermsFor(p);
      if (terms.length > 0) await m.client.redis().zrem(m.keys.keys.usersSearch(), ...terms);
    }
  });

  const hget = async (k: string, f: string) => Number((await m.client.redis().hget<string>(k, f)) ?? 0);

  async function setup() {
    const project = await m.projects.createProject(
      { key: `${key}${Math.floor(Math.random() * 9)}`.slice(0, 6), name: "Website Desa", description: "", icon: "globe", color: "blue", status: "ACTIVE", startDate: null, dueDate: null },
      ownerP,
    );
    await m.members.addMember(project.id, aliceP, "MEMBER");
    await m.members.addMember(project.id, bobP, "MEMBER");
    const frontend = await m.modules.createModule(project.id, { name: "Frontend", description: "", status: "IN_PROGRESS", leadId: null });
    const backend = await m.modules.createModule(project.id, { name: "Backend", description: "", status: "PLANNED", leadId: null });
    const landing = await m.modules.createSubModule(frontend, { name: "Landing Page", description: "", status: "PLANNED", leadId: null });
    const dashboard = await m.modules.createSubModule(frontend, { name: "Dashboard", description: "", status: "PLANNED", leadId: null });
    const task = await m.tasks.createTask(
      {
        projectId: project.id,
        moduleId: frontend.id,
        subModuleId: landing.id,
        title: "Hero section",
        description: "",
        status: "TODO",
        priority: "HIGH",
        assigneeIds: [alice, bob],
        startDate: "2026-10-01",
        dueDate: "2026-10-05",
        labels: [],
        estimatedMinutes: null,
      },
      owner,
      project.key,
    );
    return { project, frontend, backend, landing, dashboard, task };
  }

  it("rejects a duplicate project key", async () => {
    const { project } = await setup();
    await expect(
      m.projects.createProject({ key: project.key, name: "Dup", description: "", icon: "folder", color: "slate", status: "ACTIVE", startDate: null, dueDate: null }, ownerP),
    ).rejects.toThrow();
    await m.projects.deleteProjectCascade(project);
  });

  it("indexes a new task at every level of the hierarchy", async () => {
    const { project, frontend, landing, task } = await setup();
    const r = m.client.redis();
    expect(await r.zscore(m.keys.keys.projectTasks(project.id), task.id)).not.toBeNull();
    expect(await r.zscore(m.keys.keys.moduleTasks(frontend.id), task.id)).not.toBeNull();
    expect(await r.zscore(m.keys.keys.subModuleTasks(landing.id), task.id)).not.toBeNull();
    expect(await r.zscore(m.keys.keys.userTasks(alice), task.id)).not.toBeNull();
    expect(await r.zscore(m.keys.keys.userTasks(bob), task.id)).not.toBeNull();
    expect(await hget(m.keys.keys.subModuleStats(landing.id), "total")).toBe(1);
    expect(await hget(m.keys.keys.moduleStats(frontend.id), "total")).toBe(1);
    expect(await hget(m.keys.keys.projectStats(project.id), "total")).toBe(1);

    const tree = await m.modules.listProjectStructure(project.id);
    expect(tree.map((x) => x.name)).toEqual(["Frontend", "Backend"]);
    expect(tree[0]?.subModules.map((s) => s.name)).toEqual(["Landing Page", "Dashboard"]);
    await m.projects.deleteProjectCascade(project);
  });

  it("counts DONE once under concurrent status changes", async () => {
    const { project, frontend, landing, task } = await setup();
    await Promise.all(Array.from({ length: 6 }, () => m.tasks.setTaskStatus(task, "DONE")));
    for (const k of [m.keys.keys.projectStats(project.id), m.keys.keys.moduleStats(frontend.id), m.keys.keys.subModuleStats(landing.id)]) {
      expect(await hget(k, "done")).toBe(1);
    }
    await m.tasks.setTaskStatus(task, "IN_PROGRESS");
    expect(await hget(m.keys.keys.subModuleStats(landing.id), "done")).toBe(0);
    await m.projects.deleteProjectCascade(project);
  });

  it("allows only one running timer per user and records time at every level", async () => {
    const { project, frontend, landing, task } = await setup();
    const first = await m.timeLogs.claimTimer(alice, task.id, project.id);
    const second = await m.timeLogs.claimTimer(alice, task.id, project.id);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const released = await m.timeLogs.releaseTimer(alice);
    expect(released?.taskId).toBe(task.id);
    expect(await m.timeLogs.releaseTimer(alice)).toBeNull();

    const start = Date.now() - 125_000;
    await m.timeLogs.recordTimeLog(task, { userId: alice, startedAt: start, endedAt: start + 125_000, source: "timer", note: "" });
    expect(await hget(m.keys.keys.task(task.id), "trackedSeconds")).toBe(125);
    for (const k of [
      m.keys.keys.taskTime(task.id),
      m.keys.keys.subModuleTime(landing.id),
      m.keys.keys.moduleTime(frontend.id),
      m.keys.keys.projectTime(project.id),
    ]) {
      expect(await hget(k, "total")).toBe(125);
      expect(await hget(k, alice)).toBe(125);
    }
    await m.projects.deleteProjectCascade(project);
  });

  it("moves progress and tracked time when a task changes module", async () => {
    const { project, frontend, backend, landing, task } = await setup();
    await m.tasks.setTaskStatus(task, "DONE");
    const start = Date.now() - 60_000;
    await m.timeLogs.recordTimeLog(task, { userId: bob, startedAt: start, endedAt: start + 60_000, source: "manual", note: "" });
    const fresh = await m.tasks.getTask(task.id);
    if (!fresh) throw new Error("task missing");
    await m.tasks.updateTask(fresh, { moduleId: backend.id, subModuleId: null }, project.key);

    expect(await hget(m.keys.keys.moduleStats(frontend.id), "total")).toBe(0);
    expect(await hget(m.keys.keys.subModuleStats(landing.id), "done")).toBe(0);
    expect(await hget(m.keys.keys.moduleStats(backend.id), "done")).toBe(1);
    expect(await hget(m.keys.keys.moduleTime(frontend.id), bob)).toBe(0);
    expect(await hget(m.keys.keys.moduleTime(backend.id), bob)).toBe(60);
    expect(await hget(m.keys.keys.projectTime(project.id), "total")).toBe(60);
    await m.projects.deleteProjectCascade(project);
  });

  it("deleting a task cleans indexes, counters and time aggregates", async () => {
    const { project, frontend, landing, task } = await setup();
    const start = Date.now() - 30_000;
    await m.timeLogs.recordTimeLog(task, { userId: alice, startedAt: start, endedAt: start + 30_000, source: "timer", note: "" });
    expect(await m.tasks.deleteTask(task, project.key)).toBe(true);
    expect(await m.tasks.deleteTask(task, project.key)).toBe(false);
    const r = m.client.redis();
    expect(await r.exists(m.keys.keys.task(task.id), m.keys.keys.taskTimeLogs(task.id), m.keys.keys.taskTime(task.id))).toBe(0);
    expect(await r.zscore(m.keys.keys.userTasks(alice), task.id)).toBeNull();
    expect(await r.zcard(m.keys.keys.userTimeLogs(alice))).toBe(0);
    expect(await hget(m.keys.keys.subModuleStats(landing.id), "total")).toBe(0);
    expect(await hget(m.keys.keys.moduleTime(frontend.id), "total")).toBe(0);
    await m.projects.deleteProjectCascade(project);
  });

  it("removing a member unassigns their tasks and stops their timer on that project", async () => {
    const { project, task } = await setup();
    await m.timeLogs.claimTimer(bob, task.id, project.id);
    await m.members.removeMember(project.id, bobP);
    const fresh = await m.tasks.getTask(task.id);
    expect(fresh?.assigneeIds).toEqual([alice]);
    expect(await m.timeLogs.getActiveTimer(bob)).toBeNull();
    expect(await m.client.redis().zscore(m.keys.keys.userTasks(bob), task.id)).toBeNull();
    await m.projects.deleteProjectCascade(project);
  });

  it("keeps Kanban columns, status counts and user indexes in sync", async () => {
    const { project, frontend, task } = await setup();
    const today = "2026-10-03";
    let board = await m.tasks.listBoard(project.id, 50);
    expect(board.find((c) => c.status === "TODO")?.total).toBe(1);
    expect((await m.tasks.getUserTaskCounts(alice, today, 0)).open).toBe(1);

    await m.tasks.setTaskStatus(task, "BLOCKED");
    board = await m.tasks.listBoard(project.id, 50);
    expect(board.find((c) => c.status === "TODO")?.total).toBe(0);
    expect(board.find((c) => c.status === "BLOCKED")?.tasks.map((t) => t.id)).toEqual([task.id]);
    const summary = (await m.projects.getProjectSummaries([project.id], 0)).get(project.id);
    expect(summary?.statusCounts.BLOCKED).toBe(1);
    // Due 2026-10-05 is not overdue on 10-03 but is on 10-06.
    expect(await m.tasks.countOverdue(project.id, today)).toBe(0);
    expect(await m.tasks.countOverdue(project.id, "2026-10-06")).toBe(1);

    await m.tasks.setTaskStatus(task, "DONE");
    const counts = await m.tasks.getUserTaskCounts(alice, "2026-10-06", 0);
    expect(counts).toEqual({ open: 0, overdue: 0, doneSince: 1 });
    expect((await m.tasks.listUserDone(alice, 5)).map((t) => t.id)).toEqual([task.id]);
    expect(await m.tasks.countOverdue(project.id, "2026-10-06")).toBe(0);

    // Unassigning removes it from the user's indexes.
    const fresh = await m.tasks.getTask(task.id);
    if (!fresh) throw new Error("task missing");
    await m.tasks.updateTask(fresh, { assigneeIds: [bob] }, project.key);
    expect((await m.tasks.listUserDone(alice, 5)).length).toBe(0);
    expect((await m.tasks.listUserDone(bob, 5)).map((t) => t.id)).toEqual([task.id]);
    expect((await m.tasks.listNodeTasks(frontend.id, fresh.subModuleId, 0, 10)).tasks.length).toBe(1);
    await m.projects.deleteProjectCascade(project);
  });

  it("pages and searches members through the indexes", async () => {
    const { project } = await setup();
    const page1 = await m.members.listMembersPage(project.id, { limit: 2 });
    expect(page1.items.map((x) => x.name)).toEqual(["Alice Anggota", "Bob Builder"]);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await m.members.listMembersPage(project.id, { limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((x) => x.name)).toEqual(["Olivia Owner"]);
    expect(page2.nextCursor).toBeNull();

    const owners = await m.members.listMembersPage(project.id, { role: "OWNER", limit: 10 });
    expect(owners.items.map((x) => x.id)).toEqual([owner]);
    expect((await m.members.countMembersByRole(project.id)).MEMBER).toBe(2);

    expect((await m.members.searchMembers(project.id, "bui", { limit: 5 })).map((x) => x.id)).toEqual([bob]);
    expect((await m.members.searchMembers(project.id, bobP.username.slice(0, 5), { limit: 5 })).map((x) => x.id)).toContain(bob);
    expect(await m.members.searchMembers(project.id, "zzzz", { limit: 5 })).toEqual([]);

    await m.members.setMemberRole(project.id, bobP, "MEMBER", "LEAD");
    expect((await m.members.countMembersByRole(project.id)).LEAD).toBe(1);
    expect((await m.members.searchMembers(project.id, "", { minRole: "LEAD", limit: 5 })).map((x) => x.id).sort()).toEqual([bob, owner].sort());

    await m.members.removeMember(project.id, bobP);
    expect(await m.members.searchMembers(project.id, "bui", { limit: 5 })).toEqual([]);
    expect(await m.members.countMembers(project.id)).toBe(2);
    await m.projects.deleteProjectCascade(project);
  });

  it("finds tasks by title prefix and forgets them after rename", async () => {
    const { project, task } = await setup();
    const hits = await m.search.searchProjects([project.id], "hero", 20);
    expect(hits.some((h) => h.kind === "task" && h.id === task.id)).toBe(true);
    const fresh = await m.tasks.getTask(task.id);
    if (!fresh) throw new Error("task missing");
    await m.tasks.updateTask(fresh, { title: "Footer links" }, project.key);
    expect((await m.search.searchProjects([project.id], "hero", 20)).some((h) => h.id === task.id)).toBe(false);
    expect((await m.search.searchProjects([project.id], "foot", 20)).some((h) => h.id === task.id)).toBe(true);
    await m.projects.deleteProjectCascade(project);
  });

  it("deleting a project leaves no orphaned keys", async () => {
    const { project, frontend, backend, landing, dashboard, task } = await setup();
    await m.timeLogs.claimTimer(alice, task.id, project.id);
    await m.timeLogs.recordTimeLog(task, { userId: bob, startedAt: Date.now() - 1000, endedAt: Date.now(), source: "timer", note: "" });
    await m.projects.deleteProjectCascade(project);
    const ids = [project.id, frontend.id, backend.id, landing.id, dashboard.id, task.id];
    // KEYS is acceptable here: a test against a disposable database, never in request code.
    const all = (await m.client.redis().keys("*")).map(String);
    expect(all.filter((k) => ids.some((id) => k.includes(id)))).toEqual([]);
    expect(await m.timeLogs.getActiveTimer(alice)).toBeNull();
    expect(await m.client.redis().zscore(m.keys.keys.userProjects(alice), project.id)).toBeNull();
    expect(await m.client.redis().zcard(m.keys.keys.userTimeLogs(bob))).toBe(0);
  });
});
