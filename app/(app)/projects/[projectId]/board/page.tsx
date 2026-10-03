import Link from "next/link";
import { createTaskContext, loadProjectPage, loadStructure, movableTaskIds } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listBoard, listFilteredTasks } from "@/lib/redis/tasks";
import { TASK_STATUSES, type Task } from "@/types/task";
import { todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { KanbanBoard, type BoardColumnData, type QuickAddTarget } from "@/components/task/kanban-board";

/** Cards per column on first load; more load on demand. */
const PER_COLUMN = 50;
/** Most recent tasks a filtered board reads. */
const FILTER_LIMIT = 500;
import { CreateTaskButton } from "@/components/task/create-task-dialog";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ module?: string; sub?: string; mine?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { user, project, role } = await loadProjectPage(projectId);
  const structure = await loadStructure(project.id);

  const activeModule = structure.find((m) => m.id === sp.module);
  const activeSub = activeModule?.subModules.find((s) => s.id === sp.sub);
  const mine = sp.mine === "1";
  const filtered = Boolean(activeModule || mine);

  // Unfiltered: the first page of every status index. Filtered: the narrowest index, bounded.
  let rawColumns: { status: Task["status"]; tasks: Task[]; total: number }[];
  let truncated = false;
  if (!filtered) {
    rawColumns = await listBoard(project.id, PER_COLUMN);
  } else {
    const result = await listFilteredTasks(
      project.id,
      { moduleId: activeModule?.id, subModuleId: activeSub?.id, userId: mine ? user.id : undefined },
      FILTER_LIMIT,
    );
    truncated = result.truncated;
    rawColumns = TASK_STATUSES.map((status) => {
      const tasks = result.tasks.filter((t) => t.status === status);
      return { status, tasks, total: tasks.length };
    });
  }
  const allTasks = rawColumns.flatMap((c) => c.tasks);
  const items = new Map((await toTaskItems(allTasks, { projects: [project], structure })).map((t) => [t.id, t] as const));
  const columns: BoardColumnData[] = rawColumns.map((c) => ({
    status: c.status,
    total: c.total,
    tasks: c.tasks.flatMap((t) => {
      const item = items.get(t.id);
      return item ? [item] : [];
    }),
  }));
  const ctx = createTaskContext(project, role, user, structure);
  const target = activeModule ?? structure[0];
  const quickAdd: QuickAddTarget | null =
    ctx && target
      ? {
          projectId: project.id,
          moduleId: target.id,
          subModuleId: activeSub?.id ?? (activeModule ? null : (target.subModules[0]?.id ?? null)),
        }
      : null;

  const base = `/projects/${project.id}/board`;
  const href = (next: { module?: string; sub?: string; mine?: boolean }) => {
    const p = new URLSearchParams();
    if (next.module) p.set("module", next.module);
    if (next.sub) p.set("sub", next.sub);
    if (next.mine) p.set("mine", "1");
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-xs transition-colors",
      active ? "bg-fg text-background" : "bg-surface-2 text-muted hover:text-fg",
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="scroll-thin flex w-full min-w-0 gap-1.5 overflow-x-auto pb-1 sm:w-auto sm:flex-1">
          <Link href={href({ mine })} className={chip(!activeModule)}>
            Semua modul
          </Link>
          {structure.map((m) => (
            <Link key={m.id} href={href({ module: m.id, mine })} className={chip(activeModule?.id === m.id)}>
              {m.name}
            </Link>
          ))}
        </div>
        <Link href={href({ module: activeModule?.id, sub: activeSub?.id, mine: !mine })} className={cn(chip(mine), "ml-auto sm:ml-0")} aria-pressed={mine}>
          Hanya tugas saya
        </Link>
        {ctx ? (
          <CreateTaskButton context={ctx} defaults={{ moduleId: activeModule?.id, subModuleId: activeSub ? activeSub.id : undefined }} />
        ) : null}
      </div>
      {activeModule && activeModule.subModules.length > 0 ? (
        <div className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <Link href={href({ module: activeModule.id, mine })} className={chip(!activeSub)}>
            Semua sub modul
          </Link>
          {activeModule.subModules.map((s) => (
            <Link key={s.id} href={href({ module: activeModule.id, sub: s.id, mine })} className={chip(activeSub?.id === s.id)}>
              {s.name}
            </Link>
          ))}
        </div>
      ) : null}
      {truncated ? (
        <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          Menampilkan {FILTER_LIMIT} tugas terbaru yang cocok. Gunakan halaman Daftar Tugas untuk hasil lengkap.
        </p>
      ) : null}
      <KanbanBoard
        columns={columns}
        projectId={project.id}
        paginated={!filtered}
        today={todayIn(user.timezone, requestTime())}
        showModule={!activeSub}
        movableTaskIds={movableTaskIds(project, role, user.id, allTasks)}
        quickAdd={quickAdd}
      />
    </div>
  );
}
