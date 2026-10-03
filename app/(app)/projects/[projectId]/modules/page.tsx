import { Boxes, ChevronRight } from "lucide-react";
import { loadProjectPage } from "@/lib/domain/project-page";
import { createTaskContext, loadProjectStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listProjectTasks } from "@/lib/redis/repositories/task.repository";
import { canManageModules, isWritable } from "@/lib/permissions";
import { todayIn } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card, EmptyState, Progress } from "@/components/ui/primitives";
import { TaskList } from "@/components/task/task-row";
import { CreateTaskButton } from "@/components/task/create-task-dialog";
import { ModuleActions, NewModuleButton } from "@/components/project/module-controls";
import { MODULE_STATUS_LABEL } from "@/lib/labels";

export default async function ModulesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const [tasks, { modules, members }] = await Promise.all([listProjectTasks(project.id), loadProjectStructure(project.id)]);
  const items = await toTaskItems(tasks, [project]);
  const today = todayIn(user.timezone, requestTime());
  const canManage = canManageModules(role) && isWritable(project);
  const ctx = createTaskContext(project, role, user.id, modules, members);
  const owners = members.filter((m) => m.role !== "VIEWER").map((m) => ({ id: m.id, name: m.name }));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const orderedIds = modules.map((m) => m.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {modules.length} {modules.length === 1 ? "module" : "modules"} · {tasks.length} tasks
        </p>
        {canManage ? <NewModuleButton projectId={project.id} owners={owners} /> : null}
      </div>

      {modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No modules yet"
            description="Modules group related tasks, like a feature or a workstream."
          />
        </Card>
      ) : (
        modules.map((m) => {
          const moduleTasks = items.filter((t) => t.moduleId === m.id);
          const pct = m.stats.total > 0 ? (m.stats.done / m.stats.total) * 100 : 0;
          const owner = m.ownerId ? memberMap.get(m.ownerId) : undefined;
          return (
            <Card key={m.id} className="scroll-mt-20">
              <details id={`module-${m.id}`} open={moduleTasks.length > 0 && moduleTasks.length <= 25} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-90" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      <Badge tone={m.status === "DONE" ? "success" : m.status === "IN_PROGRESS" ? "accent" : "neutral"}>
                        {MODULE_STATUS_LABEL[m.status]}
                      </Badge>
                    </div>
                    {m.description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted">{m.description}</p> : null}
                  </div>
                  {owner ? (
                    <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                      <Avatar name={owner.name} src={owner.avatar} size="xs" />
                      {owner.name}
                    </span>
                  ) : null}
                  <div className="hidden w-32 sm:block">
                    <Progress value={pct} label={`${m.name} progress`} />
                  </div>
                  <span className="tabular w-12 text-right text-xs text-muted">
                    {m.stats.done}/{m.stats.total}
                  </span>
                  {canManage ? <ModuleActions module={m} owners={owners} orderedIds={orderedIds} /> : null}
                </summary>
                <div className="border-t border-border">
                  <TaskList tasks={moduleTasks} today={today} showModule={false} empty="No tasks in this module yet." />
                  {ctx ? (
                    <div className="border-t border-border px-2 py-1.5">
                      <CreateTaskButton context={ctx} defaultModuleId={m.id} variant="ghost" label="Add task" />
                    </div>
                  ) : null}
                </div>
              </details>
            </Card>
          );
        })
      )}
    </div>
  );
}
