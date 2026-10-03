import Link from "next/link";
import { ChevronRight, ListTodo } from "lucide-react";
import { createTaskContext, loadProjectPage, loadStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { hasFilters, parseTaskQuery, queryProjectTasks } from "@/lib/domain/task-query";
import { getProjectSummaries } from "@/lib/redis/projects";
import { getMemberRole } from "@/lib/redis/members";
import { getUser } from "@/lib/redis/users";
import { todayIn } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { TaskList } from "@/components/task/task-row";
import { TaskFilters } from "@/components/task/task-filters";
import { CreateTaskButton } from "@/components/task/create-task-dialog";
import type { PersonOption } from "@/types/views";

const PAGE_SIZE = 50;
const FILTER_KEYS = ["q", "status", "priority", "assignee", "module"] as const;

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
  const structure = await loadStructure(project.id);
  const today = todayIn(user.timezone, requestTime());

  const query = parseTaskQuery(sp, (id) => {
    const mod = structure.find((m) => m.id === id);
    if (mod) return { moduleId: mod.id, subModuleId: null };
    const parent = structure.find((m) => m.subModules.some((s) => s.id === id));
    return parent ? { moduleId: parent.id, subModuleId: id } : null;
  });
  const cursor = Math.max(0, Math.min(Math.floor(Number(sp.after)) || 0, 1_000_000));
  const filtered = hasFilters(query);
  const assigneeId = query.assignee && query.assignee !== "none" ? query.assignee : null;

  const [result, summaries, assigneeUser, assigneeRole] = await Promise.all([
    queryProjectTasks(project, query, cursor, PAGE_SIZE),
    getProjectSummaries([project.id], 0),
    assigneeId ? getUser(assigneeId) : Promise.resolve(null),
    assigneeId ? getMemberRole(project.id, assigneeId) : Promise.resolve(null),
  ]);
  const total = summaries.get(project.id)?.stats.total ?? 0;
  const items = await toTaskItems(result.tasks, { projects: [project], structure });
  const ctx = createTaskContext(project, role, user, structure);
  const nodes = structure.flatMap((m) => [{ id: m.id, name: m.name }, ...m.subModules.map((s) => ({ id: s.id, name: `${m.name} / ${s.name}` }))]);
  // The selected person is shown only if they are a member, so the filter cannot be used to look up users.
  const selectedAssignee: PersonOption | null =
    assigneeUser && assigneeRole
      ? { id: assigneeUser.id, name: assigneeUser.name, username: assigneeUser.username, avatar: assigneeUser.avatar, jobTitle: assigneeUser.jobTitle }
      : null;

  const base = `/projects/${project.id}/tasks`;
  const keep = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (v) keep.set(k, v);
  }
  const withCursor = (after: number) => {
    const p = new URLSearchParams(keep);
    p.set("after", String(after));
    return `${base}?${p.toString()}`;
  };
  const nextHref = result.nextCursor !== null ? withCursor(result.nextCursor) : null;
  const firstHref = keep.toString() ? `${base}?${keep.toString()}` : base;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <TaskFilters projectId={project.id} modules={nodes} selectedAssignee={selectedAssignee} />
        {ctx ? <CreateTaskButton context={ctx} /> : null}
      </div>
      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted">
          {filtered ? `${items.length} tugas cocok di halaman ini` : `${total} tugas`} · terbaru lebih dulu
          {cursor > 0 ? " · halaman lanjutan" : ""}
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-5 w-5" />}
            title="Belum ada tugas"
            description="Buat tugas pertama di proyek ini."
            action={ctx ? <CreateTaskButton context={ctx} /> : undefined}
          />
        ) : (
          <TaskList
            tasks={items}
            today={today}
            empty={result.partial ? "Belum ada yang cocok di bagian ini. Lanjutkan pencarian." : "Tidak ada tugas yang cocok dengan filter."}
          />
        )}
      </Card>
      {cursor > 0 || nextHref ? (
        <nav className="mt-4 flex items-center justify-between" aria-label="Halaman">
          {cursor > 0 ? (
            <Link href={firstHref} className={buttonClasses("outline", "sm")}>
              Kembali ke awal
            </Link>
          ) : (
            <span />
          )}
          {nextHref ? (
            <Link href={nextHref} className={buttonClasses("outline", "sm")}>
              {result.partial ? "Lanjutkan pencarian" : "Berikutnya"} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
