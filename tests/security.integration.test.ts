import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";

/**
 * Calls the real server actions as different signed-in users against a
 * disposable Redis (same TEST_UPSTASH_* variables as the data-layer tests).
 * Only the session lookup and Next.js request APIs are replaced; every
 * permission check runs as in production.
 */
const url = process.env.TEST_UPSTASH_REDIS_REST_URL;
const token = process.env.TEST_UPSTASH_REDIS_REST_TOKEN;

const session: { user: User | null } = { user: null };

vi.mock("@/lib/auth/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  const requireActionUser = async () => {
    if (!session.user) throw new UnauthorizedError();
    if (session.user.status === "SUSPENDED") throw new ForbiddenError("Akun Anda ditangguhkan. Hubungi admin.");
    return session.user;
  };
  return {
    getCurrentUser: async () => session.user,
    requireUser: requireActionUser,
    requireActionUser,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT;${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
}));

describe.skipIf(!url || !token)("server action authorization", () => {
  let users: typeof import("@/lib/redis/users");
  let actions: {
    project: typeof import("@/app/actions/project/create-project");
    updateProject: typeof import("@/app/actions/project/update-project");
    deleteProject: typeof import("@/app/actions/project/delete-project");
    member: typeof import("@/app/actions/member/member-actions");
    module: typeof import("@/app/actions/module/module-actions");
    task: typeof import("@/app/actions/task/create-task");
    updateTask: typeof import("@/app/actions/task/update-task");
    deleteTask: typeof import("@/app/actions/task/delete-task");
    detail: typeof import("@/app/actions/task/get-task-detail");
    comment: typeof import("@/app/actions/comment/comment-actions");
    query: typeof import("@/app/actions/query/query-actions");
    admin: typeof import("@/app/actions/admin/admin-actions");
    timer: typeof import("@/app/actions/timer/timer-actions");
    upload: typeof import("@/app/actions/upload/upload-actions");
  };
  const people: Record<"owner" | "lead" | "member" | "viewer" | "outsider", User> = {} as never;
  let projectId = "";
  let moduleId = "";
  let taskId = "";
  const as = (who: keyof typeof people | null) => {
    session.user = who ? people[who] : null;
  };

  beforeAll(async () => {
    process.env.UPSTASH_REDIS_REST_URL = url;
    process.env.UPSTASH_REDIS_REST_TOKEN = token;
    process.env.RATE_LIMIT_DISABLED = "1";
    users = await import("@/lib/redis/users");
    actions = {
      project: await import("@/app/actions/project/create-project"),
      updateProject: await import("@/app/actions/project/update-project"),
      deleteProject: await import("@/app/actions/project/delete-project"),
      member: await import("@/app/actions/member/member-actions"),
      module: await import("@/app/actions/module/module-actions"),
      task: await import("@/app/actions/task/create-task"),
      updateTask: await import("@/app/actions/task/update-task"),
      deleteTask: await import("@/app/actions/task/delete-task"),
      detail: await import("@/app/actions/task/get-task-detail"),
      comment: await import("@/app/actions/comment/comment-actions"),
      query: await import("@/app/actions/query/query-actions"),
      admin: await import("@/app/actions/admin/admin-actions"),
      timer: await import("@/app/actions/timer/timer-actions"),
      upload: await import("@/app/actions/upload/upload-actions"),
    };
    for (const who of ["owner", "lead", "member", "viewer", "outsider"] as const) {
      const tag = randomUUID().slice(0, 8);
      people[who] = await users.upsertOAuthUser({
        provider: "test",
        providerAccountId: `${who}-${tag}`,
        email: `${who}.${tag}@test.local`,
        name: `Sec ${who} ${tag}`,
        image: null,
        emailVerified: true,
        isAdmin: false,
      });
    }

    as("owner");
    const key = `S${randomUUID().replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}`;
    const created = await actions.project.createProjectAction({ name: "Proyek Rahasia", key });
    if (!created.ok) throw new Error(created.error);
    projectId = created.data.projectId;
    for (const [who, role] of [["lead", "LEAD"], ["member", "MEMBER"], ["viewer", "VIEWER"]] as const) {
      const r = await actions.member.addMemberAction({ projectId, userId: people[who].id, role });
      if (!r.ok) throw new Error(r.error);
    }
    const mod = await actions.module.createModuleAction({ projectId, name: "Backend" });
    if (!mod.ok) throw new Error(mod.error);
    moduleId = mod.data.moduleId;
    const task = await actions.task.createTaskAction({ projectId, moduleId, title: "Tugas lead", assigneeIds: [people.lead.id] });
    if (!task.ok) throw new Error(task.error);
    taskId = task.data.taskId;
  });

  afterAll(async () => {
    if (!projectId) return;
    as("owner");
    const { getProject } = await import("@/lib/redis/projects");
    const project = await getProject(projectId);
    // A successful delete redirects to /projects; that redirect is the expected outcome here.
    if (project) await actions.deleteProject.deleteProjectAction({ projectId, confirmKey: project.key }).catch(() => undefined);
    expect(await getProject(projectId)).toBeNull();
  });

  it("rejects every action without a session", async () => {
    as(null);
    expect((await actions.detail.getTaskDetailAction({ taskId })).ok).toBe(false);
    expect((await actions.task.createTaskAction({ projectId, moduleId, title: "x" })).ok).toBe(false);
    expect((await actions.query.searchProjectMembersAction({ projectId, query: "" })).ok).toBe(false);
  });

  it("hides a project from outsiders as not found (no existence leak)", async () => {
    as("outsider");
    const detail = await actions.detail.getTaskDetailAction({ taskId });
    expect(detail.ok).toBe(false);
    if (!detail.ok) expect(detail.code).toBe("NOT_FOUND");
    const missing = await actions.detail.getTaskDetailAction({ taskId: randomUUID() });
    expect(!missing.ok && missing.code).toBe(!detail.ok && detail.code);
    expect((await actions.query.loadColumnAction({ projectId, status: "TODO", offset: 0 })).ok).toBe(false);
    expect((await actions.query.searchProjectMembersAction({ projectId, query: "sec" })).ok).toBe(false);
    expect((await actions.comment.addCommentAction({ taskId, body: "halo" })).ok).toBe(false);
    expect((await actions.updateTask.updateTaskAction({ taskId, title: "dibajak" })).ok).toBe(false);
    expect((await actions.deleteTask.deleteTaskAction({ taskId })).ok).toBe(false);
    expect((await actions.timer.startTimerAction({ taskId })).ok).toBe(false);
  });

  it("does not let an outsider join or add others", async () => {
    as("outsider");
    expect((await actions.member.addMemberAction({ projectId, userId: people.outsider.id, role: "LEAD" })).ok).toBe(false);
  });

  it("keeps viewers read-only", async () => {
    as("viewer");
    expect((await actions.detail.getTaskDetailAction({ taskId })).ok).toBe(true);
    expect((await actions.task.createTaskAction({ projectId, moduleId, title: "x" })).ok).toBe(false);
    expect((await actions.updateTask.updateTaskAction({ taskId, title: "x" })).ok).toBe(false);
    expect((await actions.comment.addCommentAction({ taskId, body: "x" })).ok).toBe(false);
    expect((await actions.timer.startTimerAction({ taskId })).ok).toBe(false);
    expect((await actions.module.createModuleAction({ projectId, name: "X" })).ok).toBe(false);
  });

  it("stops members from editing others' tasks or assigning other people", async () => {
    as("member");
    expect((await actions.updateTask.updateTaskAction({ taskId, title: "x" })).ok).toBe(false);
    expect((await actions.deleteTask.deleteTaskAction({ taskId })).ok).toBe(false);
    const other = await actions.task.createTaskAction({ projectId, moduleId, title: "untuk lead", assigneeIds: [people.lead.id] });
    expect(other.ok).toBe(false);
    const own = await actions.task.createTaskAction({ projectId, moduleId, title: "milik saya", assigneeIds: [people.member.id] });
    expect(own.ok).toBe(true);
  });

  it("rejects assigning someone who is not a member", async () => {
    as("lead");
    const r = await actions.task.createTaskAction({ projectId, moduleId, title: "x", assigneeIds: [people.outsider.id] });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown fields instead of mass-assigning them", async () => {
    as("lead");
    const r = await actions.updateTask.updateTaskAction({ taskId, title: "ok", creatorId: people.outsider.id, projectId: randomUUID() });
    expect(r.ok).toBe(false);
  });

  it("prevents privilege escalation through member management", async () => {
    as("member");
    expect((await actions.member.changeMemberRoleAction({ projectId, userId: people.member.id, role: "LEAD" })).ok).toBe(false);
    expect((await actions.member.addMemberAction({ projectId, userId: people.outsider.id, role: "MEMBER" })).ok).toBe(false);
    as("lead");
    // OWNER is not an assignable role, and a lead cannot touch the owner.
    expect((await actions.member.changeMemberRoleAction({ projectId, userId: people.member.id, role: "OWNER" })).ok).toBe(false);
    expect((await actions.member.changeMemberRoleAction({ projectId, userId: people.owner.id, role: "VIEWER" })).ok).toBe(false);
    expect((await actions.member.removeMemberAction({ projectId, userId: people.owner.id })).ok).toBe(false);
    as("owner");
    expect((await actions.member.removeMemberAction({ projectId, userId: people.owner.id })).ok).toBe(false);
  });

  it("only lets owners change or delete the project", async () => {
    as("lead");
    expect((await actions.deleteProject.deleteProjectAction({ projectId, confirmKey: "X" })).ok).toBe(false);
    as("member");
    expect((await actions.updateProject.setProjectStatusAction({ projectId, status: "ARCHIVED" })).ok).toBe(false);
  });

  it("limits invite search to leads and never returns existing members", async () => {
    as("member");
    const denied = await actions.query.searchInvitableUsersAction({ projectId, query: "sec" });
    expect(denied.ok && denied.data).toEqual([]);
    as("lead");
    const found = await actions.query.searchInvitableUsersAction({ projectId, query: "sec outsider" });
    expect(found.ok).toBe(true);
    if (found.ok) {
      const ids = found.data.map((u) => u.id);
      expect(ids).not.toContain(people.member.id);
      expect(ids).not.toContain(people.owner.id);
    }
  });

  it("reserves admin actions for global admins", async () => {
    as("owner");
    expect((await actions.admin.setGlobalRoleAction({ userId: people.owner.id, role: "ADMIN" })).ok).toBe(false);
    expect((await actions.admin.setAccountStatusAction({ userId: people.member.id, status: "SUSPENDED" })).ok).toBe(false);
  });

  it("refuses uploads to tasks the user cannot edit", async () => {
    as("viewer");
    const r = await actions.upload.registerUploadAction({
      target: { kind: "attachment", taskId },
      url: "https://example.public.blob.vercel-storage.com/x.png",
      pathname: "x.png",
      filename: "x.png",
      contentType: "image/png",
    });
    expect(r.ok).toBe(false);
    as("lead");
    // A path outside the authorized folder is rejected even for an editor.
    const outside = await actions.upload.registerUploadAction({
      target: { kind: "attachment", taskId },
      url: "https://example.public.blob.vercel-storage.com/avatars/other/x.png",
      pathname: "avatars/other/x.png",
      filename: "x.png",
      contentType: "image/png",
    });
    expect(outside.ok).toBe(false);
  });

  it("blocks suspended accounts", async () => {
    as("member");
    session.user = { ...people.member, status: "SUSPENDED" };
    expect((await actions.detail.getTaskDetailAction({ taskId })).ok).toBe(false);
  });
});
