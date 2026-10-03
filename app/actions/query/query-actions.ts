"use server";

import { z } from "zod";
import { requireAuth, requireProjectAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { getMemberRoles, searchMembers } from "@/lib/redis/members";
import { searchUsers } from "@/lib/redis/users";
import { getModule } from "@/lib/redis/modules";
import { listColumnPage, listNodeTasks } from "@/lib/redis/tasks";
import { toTaskItems } from "@/lib/domain/views";
import { movableTaskIds } from "@/lib/domain/project-data";
import { enforceRateLimit } from "@/lib/rate-limit";
import { atLeast } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { idSchema } from "@/schemas/common";
import { TASK_STATUSES } from "@/types/task";
import type { ActionResult } from "@/types/action";
import type { PersonOption, TaskItem } from "@/types/views";

/**
 * Read-only actions used by client components to page and search data on
 * demand. Every one checks the session and project membership; none returns
 * more than one page.
 */

const PAGE = 50;
const query = z.string().trim().max(80).default("");

const memberSearchSchema = z.object({
  projectId: idSchema,
  query,
  /** Only people who can work on tasks (for assignee and lead pickers). */
  workersOnly: z.boolean().default(false),
});

export async function searchProjectMembersAction(input: unknown): Promise<ActionResult<PersonOption[]>> {
  return runAction("searchProjectMembers", async () => {
    const user = await requireAuth();
    const { projectId, query: q, workersOnly } = parseInput(memberSearchSchema, input);
    await requireProjectAccess(user, projectId);
    await enforceRateLimit("search", user.id);
    const members = await searchMembers(projectId, q, { minRole: workersOnly ? "MEMBER" : undefined, limit: 20 });
    return members.map((m) => ({ id: m.id, name: m.name, username: m.username, avatar: m.avatar, jobTitle: m.jobTitle }));
  });
}

const inviteSearchSchema = z.object({ projectId: idSchema, query });

/** People who may be invited: registered, not suspended, not yet members. Leads and owners only. */
export async function searchInvitableUsersAction(input: unknown): Promise<ActionResult<(PersonOption & { email: string })[]>> {
  return runAction("searchInvitableUsers", async () => {
    const user = await requireAuth();
    const { projectId, query: q } = parseInput(inviteSearchSchema, input);
    const { role } = await requireProjectAccess(user, projectId);
    if (!atLeast(role, "LEAD")) return [];
    if (q.length < 2) return [];
    await enforceRateLimit("search", user.id);
    const found = (await searchUsers(q, 30)).filter((u) => u.status !== "SUSPENDED");
    const roles = await getMemberRoles(projectId, found.map((u) => u.id));
    return found
      .filter((u) => !roles.get(u.id))
      .slice(0, 15)
      .map((u) => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, jobTitle: u.jobTitle, email: u.email }));
  });
}

const columnSchema = z.object({ projectId: idSchema, status: z.enum(TASK_STATUSES), offset: z.number().int().min(0).max(1_000_000) });

/** Next cards of one Kanban column. */
export async function loadColumnAction(input: unknown): Promise<ActionResult<{ tasks: TaskItem[]; hasMore: boolean; movable: string[] }>> {
  return runAction("loadColumn", async () => {
    const user = await requireAuth();
    const { projectId, status, offset } = parseInput(columnSchema, input);
    const { project, role } = await requireProjectAccess(user, projectId);
    const page = await listColumnPage(projectId, status, offset, PAGE);
    return {
      tasks: await toTaskItems(page.tasks, { projects: [project] }),
      hasMore: page.hasMore,
      movable: movableTaskIds(project, role, user.id, page.tasks),
    };
  });
}

const nodeSchema = z.object({
  projectId: idSchema,
  moduleId: idSchema,
  subModuleId: idSchema.nullable(),
  offset: z.number().int().min(0).max(1_000_000),
});

/** Tasks of one sub module (or directly under a module) for the structure tree. */
export async function loadNodeTasksAction(input: unknown): Promise<ActionResult<{ tasks: TaskItem[]; hasMore: boolean }>> {
  return runAction("loadNodeTasks", async () => {
    const user = await requireAuth();
    const { projectId, moduleId, subModuleId, offset } = parseInput(nodeSchema, input);
    const { project } = await requireProjectAccess(user, projectId);
    const mod = await getModule(moduleId);
    if (!mod || mod.projectId !== project.id) throw new NotFoundError("Modul tidak ditemukan.");
    const page = await listNodeTasks(moduleId, subModuleId, offset, 25);
    // A sub module id from the client must belong to this module.
    const tasks = page.tasks.filter((t) => t.projectId === project.id && t.moduleId === moduleId);
    return { tasks: await toTaskItems(tasks, { projects: [project] }), hasMore: page.hasMore };
  });
}
