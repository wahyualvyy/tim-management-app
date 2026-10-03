import "server-only";
import { keys } from "@/lib/redis/keys";
import { getTasks, pageIndex } from "@/lib/redis/tasks";
import { searchProjects } from "@/lib/redis/search";
import { matchesAllWords } from "@/lib/search-terms";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "@/types/task";

export interface TaskQuery {
  q: string;
  status: TaskStatus | "open" | null;
  priority: TaskPriority | null;
  /** A user id, "none" for unassigned, or null. */
  assignee: string | null;
  /** A module or sub module id. */
  node: { moduleId: string; subModuleId: string | null } | null;
}

export function parseTaskQuery(
  sp: Record<string, string | undefined>,
  resolveNode: (id: string) => TaskQuery["node"],
): TaskQuery {
  const status = sp.status === "open" ? "open" : (TASK_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as TaskStatus) : null;
  const priority = (TASK_PRIORITIES as readonly string[]).includes(sp.priority ?? "") ? (sp.priority as TaskPriority) : null;
  return {
    q: (sp.q ?? "").trim().slice(0, 100),
    status,
    priority,
    assignee: sp.assignee && /^[\w-]{1,64}$/.test(sp.assignee) ? sp.assignee : null,
    node: sp.module ? resolveNode(sp.module) : null,
  };
}

export function hasFilters(query: TaskQuery): boolean {
  return Boolean(query.q || query.status || query.priority || query.assignee || query.node);
}

function matches(task: Task, projectId: string, projectKey: string, query: TaskQuery): boolean {
  if (task.projectId !== projectId) return false;
  if (query.status === "open" ? task.status === "DONE" : query.status && task.status !== query.status) return false;
  if (query.priority && task.priority !== query.priority) return false;
  if (query.assignee === "none" ? task.assigneeIds.length > 0 : query.assignee && !task.assigneeIds.includes(query.assignee)) return false;
  if (query.node) {
    if (task.moduleId !== query.node.moduleId) return false;
    if (query.node.subModuleId && task.subModuleId !== query.node.subModuleId) return false;
  }
  if (query.q && !matchesAllWords(`${projectKey}-${task.number} ${task.title} ${task.labels.join(" ")}`, query.q)) return false;
  return true;
}

/** How many index entries one request may read while filtering. */
const SCAN_BUDGET = 2000;
const CHUNK = 200;
/** Text search reads at most this many index hits. */
const SEARCH_HITS = 300;

export interface TaskQueryPage {
  tasks: Task[];
  /** Index offset to continue from, or null at the end. */
  nextCursor: number | null;
  /** The scan budget ran out before a full page was found. */
  partial: boolean;
}

/**
 * One page of a project's tasks matching the filters, newest first. Reads
 * the narrowest index (status, assignee, module, or the text index) in
 * chunks and stops after a page or a fixed budget, so the cost per request
 * is bounded regardless of project size.
 */
export async function queryProjectTasks(
  project: { id: string; key: string },
  query: TaskQuery,
  cursor: number,
  limit: number,
): Promise<TaskQueryPage> {
  if (query.q) {
    const hits = (await searchProjects([project.id], query.q, SEARCH_HITS)).filter((h) => h.kind === "task");
    const tasks = (await getTasks(hits.map((h) => h.id)))
      .filter((t) => matches(t, project.id, project.key, query))
      .sort((a, b) => b.createdAt - a.createdAt);
    const page = tasks.slice(cursor, cursor + limit);
    return { tasks: page, nextCursor: tasks.length > cursor + limit ? cursor + limit : null, partial: false };
  }

  // Board-ordered status index; newest-first for the others.
  const [key, rev] =
    query.status && query.status !== "open"
      ? [keys.projectStatus(project.id, query.status), false]
      : query.assignee && query.assignee !== "none"
        ? [keys.userTasks(query.assignee), true]
        : query.node?.subModuleId
          ? [keys.subModuleTasks(query.node.subModuleId), true]
          : query.node
            ? [keys.moduleTasks(query.node.moduleId), true]
            : [keys.projectTasks(project.id), true];

  const found: Task[] = [];
  let offset = cursor;
  let scanned = 0;
  let more = true;
  while (found.length <= limit && more && scanned < SCAN_BUDGET) {
    const chunk = await pageIndex(key, offset, CHUNK, rev);
    more = chunk.hasMore;
    const tasks = new Map((await getTasks(chunk.ids)).map((t) => [t.id, t] as const));
    for (let i = 0; i < chunk.ids.length; i++) {
      const task = tasks.get(chunk.ids[i] ?? "");
      offset += 1;
      if (task && matches(task, project.id, project.key, query)) {
        found.push(task);
        if (found.length === limit) {
          // Stop exactly after the last task of this page so the cursor resumes there.
          const rest = chunk.ids.length - i - 1;
          return { tasks: found, nextCursor: rest > 0 || more ? offset : null, partial: false };
        }
      }
    }
    scanned += chunk.ids.length;
    if (chunk.ids.length === 0) break;
  }
  return { tasks: found, nextCursor: more ? offset : null, partial: more };
}
