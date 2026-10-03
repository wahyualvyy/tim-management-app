import { ListTodo } from "lucide-react";
import { loadProjectPage } from "@/lib/domain/project-page";
import { createTaskContext, loadProjectStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listProjectTasks } from "@/lib/redis/repositories/task.repository";
import { todayIn } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui/primitives";
import { parsePage } from "@/components/ui/pagination";
import { TaskList } from "@/components/task/task-row";
import { TaskFilters } from "@/components/task/task-filters";
import { CreateTaskButton } from "@/components/task/create-task-dialog";
import { PRIORITY_RANK } from "@/components/task/task-meta";
import { Pagination } from "@/components/ui/pagination";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/types/task";

const PAGE_SIZE = 50;
const STATUS_RANK = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i])) as Record<Task["status"], number>;

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { user, project, role } = await loadProjectPage(projectId);
  const [tasks, { modules, members }] = await Promise.all([listProjectTasks(project.id), loadProjectStructure(project.id)]);
  const today = todayIn(user.timezone, requestTime());

  const q = (sp.q ?? "").toLowerCase().trim();
  const filtered = tasks
    .filter((t) => {
      if (q && !`${project.key}-${t.number} ${t.title} ${t.labels.join(" ")}`.toLowerCase().includes(q)) return false;
      if (sp.status === "open" && t.status === "DONE") return false;
      if (sp.status && sp.status !== "open" && (TASK_STATUSES as readonly string[]).includes(sp.status) && t.status !== sp.status) return false;
      if (sp.priority && (TASK_PRIORITIES as readonly string[]).includes(sp.priority) && t.priority !== sp.priority) return false;
      if (sp.assignee === "none" && t.assigneeId) return false;
      if (sp.assignee && sp.assignee !== "none" && t.assigneeId !== sp.assignee) return false;
      if (sp.module && t.moduleId !== sp.module) return false;
      return true;
    })
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        b.number - a.number,
    );

  const page = parsePage(sp.page);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const items = await toTaskItems(slice, [project]);
  const ctx = createTaskContext(project, role, user.id, modules, members);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <TaskFilters
          modules={modules.map((m) => ({ id: m.id, name: m.name }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
        />
        {ctx ? <CreateTaskButton context={ctx} /> : null}
      </div>
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted">
          <span>
            {filtered.length} of {tasks.length} tasks
          </span>
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-5 w-5" />}
            title="No tasks yet"
            description="Create the first task in this project."
            action={ctx ? <CreateTaskButton context={ctx} /> : undefined}
          />
        ) : (
          <TaskList tasks={items} today={today} empty="No tasks match these filters." />
        )}
      </Card>
      <Pagination
        basePath={`/projects/${project.id}/tasks`}
        query={{ q: sp.q, status: sp.status, priority: sp.priority, assignee: sp.assignee, module: sp.module }}
        page={page}
        hasMore={filtered.length > page * PAGE_SIZE}
      />
    </div>
  );
}
