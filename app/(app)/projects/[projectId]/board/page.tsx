import Link from "next/link";
import { loadProjectPage } from "@/lib/domain/project-page";
import { createTaskContext, loadProjectStructure, movableTaskIds } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listProjectTasks } from "@/lib/redis/repositories/task.repository";
import { todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "@/components/task/kanban-board";
import { CreateTaskButton } from "@/components/task/create-task-dialog";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ module?: string; mine?: string }>;
}) {
  const { projectId } = await params;
  const { module: moduleFilter, mine } = await searchParams;
  const { user, project, role } = await loadProjectPage(projectId);
  const [tasks, { modules, members }] = await Promise.all([listProjectTasks(project.id), loadProjectStructure(project.id)]);

  const activeModule = modules.find((m) => m.id === moduleFilter);
  const filtered = tasks.filter(
    (t) => (!activeModule || t.moduleId === activeModule.id) && (mine !== "1" || t.assigneeId === user.id),
  );
  const items = await toTaskItems(filtered, [project]);
  const ctx = createTaskContext(project, role, user.id, modules, members);
  const base = `/projects/${project.id}/board`;
  const query = (next: { module?: string; mine?: string }) => {
    const p = new URLSearchParams();
    if (next.module) p.set("module", next.module);
    if (next.mine) p.set("mine", next.mine);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors",
      active ? "border-fg bg-fg text-background" : "border-border text-muted hover:border-border-strong hover:text-fg",
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="scroll-thin flex flex-1 gap-1.5 overflow-x-auto pb-1">
          <Link href={query({ mine })} className={chip(!activeModule)}>
            All modules
          </Link>
          {modules.map((m) => (
            <Link key={m.id} href={query({ module: m.id, mine })} className={cn(chip(activeModule?.id === m.id), "shrink-0")}>
              {m.name}
            </Link>
          ))}
        </div>
        <Link href={query({ module: activeModule?.id, mine: mine === "1" ? undefined : "1" })} className={chip(mine === "1")}>
          Only mine
        </Link>
        {ctx ? <CreateTaskButton context={ctx} defaultModuleId={activeModule?.id} /> : null}
      </div>
      <KanbanBoard
        tasks={items}
        today={todayIn(user.timezone, requestTime())}
        showModule={!activeModule}
        movableTaskIds={movableTaskIds(project, role, user.id, filtered)}
      />
    </div>
  );
}
