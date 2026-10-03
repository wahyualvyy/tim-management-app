"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, ChevronRight, Clock3, FolderTree, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { reorderModulesAction } from "@/app/actions/module/module-actions";
import { reorderSubModulesAction } from "@/app/actions/module/submodule-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { Badge, EmptyState, ProgressSummary } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { CreateTaskDialog, type TaskDefaults } from "@/components/task/create-task-dialog";
import { formatDuration } from "@/lib/dates";
import { STRUCTURE_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ModuleWithStats, StructureStatus, SubModuleWithStats } from "@/types/module";
import type { CreateTaskContext, PersonOption } from "@/types/views";
import { NodeTasks } from "./node-tasks";
import { DeleteStructureDialog, StructureDialog, type DeleteTarget, type StructureTarget } from "./structure-dialogs";

type Person = PersonOption;

/** Tasks directly under a module: the module total minus its sub modules. */
function directCount(m: ModuleWithStats): number {
  return Math.max(0, m.stats.total - m.subModules.reduce((n, s) => n + s.stats.total, 0));
}

const STATUS_TONE: Record<StructureStatus, "neutral" | "accent" | "success"> = {
  PLANNED: "neutral",
  IN_PROGRESS: "accent",
  DONE: "success",
};

function useReorder<T extends { id: string }>(items: T[], persist: (ids: string[]) => Promise<{ ok: boolean; error?: string }>) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [ordered, setOrdered] = useOptimistic(items);
  const onDragEnd = (event: DragEndEvent) => {
    const from = ordered.findIndex((i) => i.id === event.active.id);
    const to = ordered.findIndex((i) => i.id === event.over?.id);
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(ordered, from, to);
    startTransition(async () => {
      setOrdered(next);
      const result = await persist(next.map((i) => i.id));
      if (!result.ok) toast.error(result.error ?? "Gagal menyimpan urutan.");
    });
  };
  return { ordered, onDragEnd };
}

function SortableRow({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = disabled ? null : (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-subtle hover:text-fg active:cursor-grabbing"
      aria-label="Seret untuk mengurutkan"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80")}
    >
      {children(handle)}
    </div>
  );
}

/** On small screens the meta wraps under the name instead of squeezing it. */
function NodeMeta({ status, lead, trackedSeconds, done, total }: { status: StructureStatus; lead?: Person; trackedSeconds: number; done: number; total: number }) {
  return (
    <div className="order-last flex w-full shrink-0 items-center gap-3 pl-11 sm:order-none sm:w-auto sm:pl-0">
      <Badge tone={STATUS_TONE[status]} className="hidden sm:inline-flex">
        {STRUCTURE_STATUS_LABEL[status]}
      </Badge>
      {lead ? (
        <Tooltip content={`Penanggung jawab: ${lead.name}`}>
          <span>
            <Avatar name={lead.name} src={lead.avatar} size="xs" />
          </span>
        </Tooltip>
      ) : null}
      {trackedSeconds > 0 ? (
        <span className="tabular hidden items-center gap-1 text-[11px] text-muted md:inline-flex">
          <Clock3 className="h-3 w-3" aria-hidden />
          {formatDuration(trackedSeconds)}
        </span>
      ) : null}
      <ProgressSummary done={done} total={total} className="flex-1 sm:w-36 sm:flex-none" />
    </div>
  );
}

export function StructureTree({
  projectId,
  modules,
  canManage,
  createContext,
  leads,
  today,
  version,
}: {
  projectId: string;
  modules: ModuleWithStats[];
  canManage: boolean;
  createContext: CreateTaskContext | null;
  /** Module and sub module leads, resolved on the server. */
  leads: Person[];
  today: string;
  /** Changes on every server render; open nodes reload their tasks. */
  version: number;
}) {
  // Modules start open and sub modules closed, so only opened nodes load tasks.
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<StructureTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [createFor, setCreateFor] = useState<TaskDefaults | null>(null);
  const peopleById = new Map(leads.map((p) => [p.id, p] as const));
  const totalTasks = modules.reduce((n, m) => n + m.stats.total, 0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const moduleOrder = useReorder(modules, (ids) => reorderModulesAction({ projectId, moduleIds: ids }));

  const toggle = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (modules.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="Belum ada modul"
          description="Modul mengelompokkan pekerjaan, misalnya Frontend, Backend atau Deployment."
          action={
            canManage ? (
              <Button variant="primary" onClick={() => setDialog({ mode: "create-module", projectId })}>
                <Plus className="h-4 w-4" aria-hidden /> Tambah modul
              </Button>
            ) : undefined
          }
        />
        <StructureDialog target={dialog} onClose={() => setDialog(null)} leadsById={peopleById} />
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {modules.length} modul · {modules.reduce((n, m) => n + m.subModules.length, 0)} sub modul · {totalTasks} tugas
        </p>
        {canManage ? (
          <Button variant="primary" onClick={() => setDialog({ mode: "create-module", projectId })}>
            <Plus className="h-4 w-4" aria-hidden /> Modul
          </Button>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={moduleOrder.onDragEnd}>
        <SortableContext items={moduleOrder.ordered.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {moduleOrder.ordered.map((m) => (
              <SortableRow key={m.id} id={m.id} disabled={!canManage}>
                {(handle) => (
                  <ModuleNode
                    module={m}
                    handle={handle}
                    open={!toggled.has(m.id)}
                    isSubOpen={(id) => toggled.has(id)}
                    onToggle={toggle}
                    canManage={canManage}
                    canCreateTask={createContext !== null}
                    lead={m.leadId ? peopleById.get(m.leadId) : undefined}
                    peopleById={peopleById}
                    projectId={projectId}
                    version={version}
                    today={today}
                    sensors={sensors}
                    onEdit={(target) => setDialog(target)}
                    onDelete={setDeleting}
                    onAddTask={setCreateFor}
                  />
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <StructureDialog target={dialog} onClose={() => setDialog(null)} leadsById={peopleById} />
      <DeleteStructureDialog target={deleting} onClose={() => setDeleting(null)} />
      {createContext ? (
        <CreateTaskDialog
          open={createFor !== null}
          onOpenChange={(open) => (open ? undefined : setCreateFor(null))}
          context={createContext}
          defaults={createFor ?? undefined}
        />
      ) : null}
    </>
  );
}

function ModuleNode({
  module: m,
  handle,
  open,
  isSubOpen,
  onToggle,
  canManage,
  canCreateTask,
  lead,
  peopleById,
  projectId,
  version,
  today,
  sensors,
  onEdit,
  onDelete,
  onAddTask,
}: {
  module: ModuleWithStats;
  handle: ReactNode;
  open: boolean;
  isSubOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  canManage: boolean;
  canCreateTask: boolean;
  lead?: Person;
  peopleById: Map<string, Person>;
  projectId: string;
  version: number;
  today: string;
  sensors: ReturnType<typeof useSensors>;
  onEdit: (target: StructureTarget) => void;
  onDelete: (target: DeleteTarget) => void;
  onAddTask: (defaults: TaskDefaults) => void;
}) {
  const subOrder = useReorder(m.subModules, (ids) => reorderSubModulesAction({ moduleId: m.id, subModuleIds: ids }));
  const direct = directCount(m);

  return (
    <section id={`node-${m.id}`} className="scroll-mt-20 rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-2.5 sm:flex-nowrap sm:px-3">
        {handle}
        <button
          type="button"
          onClick={() => onToggle(m.id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
        >
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-90")} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{m.name}</span>
            {m.description ? <span className="block truncate text-xs text-muted">{m.description}</span> : null}
          </span>
        </button>
        <NodeMeta status={m.status} lead={lead} trackedSeconds={m.trackedSeconds} done={m.stats.done} total={m.stats.total} />
        <NodeMenu
          label={`Aksi untuk modul ${m.name}`}
          canManage={canManage}
          canCreateTask={canCreateTask}
          onEdit={() => onEdit({ mode: "edit-module", module: m })}
          onAddChild={() => onEdit({ mode: "create-submodule", module: m })}
          onAddTask={() => onAddTask({ moduleId: m.id, subModuleId: null })}
          onDelete={() =>
            onDelete({ kind: "module", id: m.id, name: m.name, subModules: m.subModules.length, tasks: m.stats.total })
          }
        />
      </div>

      {open ? (
        <div className="border-t border-border pb-1">
          {m.subModules.length === 0 && direct === 0 ? (
            <div className="flex flex-wrap items-center gap-2 px-4 py-4 text-[13px] text-subtle">
              <FolderTree className="h-4 w-4" aria-hidden />
              Belum ada sub modul atau tugas.
              {canManage ? (
                <Button size="sm" variant="ghost" onClick={() => onEdit({ mode: "create-submodule", module: m })}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Sub modul
                </Button>
              ) : null}
            </div>
          ) : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={subOrder.onDragEnd}>
            <SortableContext items={subOrder.ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {subOrder.ordered.map((s) => (
                <SortableRow key={s.id} id={s.id} disabled={!canManage}>
                  {(subHandle) => (
                    <SubModuleNode
                      subModule={s}
                      handle={subHandle}
                      open={isSubOpen(s.id)}
                      onToggle={onToggle}
                      canManage={canManage}
                      canCreateTask={canCreateTask}
                      lead={s.leadId ? peopleById.get(s.leadId) : undefined}
                      projectId={projectId}
                      moduleId={m.id}
                      version={version}
                      today={today}
                      onEdit={() => onEdit({ mode: "edit-submodule", subModule: s })}
                      onDelete={() => onDelete({ kind: "submodule", id: s.id, name: s.name, tasks: s.stats.total })}
                      onAddTask={() => onAddTask({ moduleId: m.id, subModuleId: s.id })}
                    />
                  )}
                </SortableRow>
              ))}
            </SortableContext>
          </DndContext>

          {direct > 0 ? (
            <div className="mx-2 mt-1 sm:mx-3">
              <p className="px-1 pb-1 pt-2 text-[11px] font-medium text-subtle">Tugas langsung di modul · {direct}</p>
              <div className="rounded-md border border-border">
                <NodeTasks projectId={projectId} moduleId={m.id} subModuleId={null} today={today} version={version} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SubModuleNode({
  subModule: s,
  handle,
  open,
  onToggle,
  canManage,
  canCreateTask,
  lead,
  projectId,
  moduleId,
  version,
  today,
  onEdit,
  onDelete,
  onAddTask,
}: {
  subModule: SubModuleWithStats;
  handle: ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  canManage: boolean;
  canCreateTask: boolean;
  lead?: Person;
  projectId: string;
  moduleId: string;
  version: number;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
}) {
  return (
    <div id={`node-${s.id}`} className="scroll-mt-20 border-b border-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 pl-5 pr-2 sm:flex-nowrap sm:pl-8 sm:pr-3">
        {handle}
        <button type="button" onClick={() => onToggle(s.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-subtle transition-transform", open && "rotate-90")} aria-hidden />
          <span className="truncate text-[13px] font-medium">{s.name}</span>
        </button>
        <NodeMeta status={s.status} lead={lead} trackedSeconds={s.trackedSeconds} done={s.stats.done} total={s.stats.total} />
        <NodeMenu
          label={`Aksi untuk sub modul ${s.name}`}
          canManage={canManage}
          canCreateTask={canCreateTask}
          onEdit={onEdit}
          onAddTask={onAddTask}
          onDelete={onDelete}
        />
      </div>
      {open ? (
        <div className="pb-2 pl-10 pr-2 sm:pl-14 sm:pr-3">
          {s.stats.total > 0 ? (
            <div className="rounded-md border border-border">
              <NodeTasks projectId={projectId} moduleId={moduleId} subModuleId={s.id} today={today} version={version} />
            </div>
          ) : (
            <p className="py-1 text-xs text-subtle">Belum ada tugas di sub modul ini.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NodeMenu({
  label,
  canManage,
  canCreateTask,
  onEdit,
  onAddChild,
  onAddTask,
  onDelete,
}: {
  label: string;
  canManage: boolean;
  canCreateTask: boolean;
  onEdit: () => void;
  onAddChild?: () => void;
  onAddTask: () => void;
  onDelete: () => void;
}) {
  if (!canManage && !canCreateTask) return null;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {canCreateTask ? (
          <MenuItem onSelect={onAddTask}>
            <Plus className="h-4 w-4 text-muted" aria-hidden /> Tambah tugas
          </MenuItem>
        ) : null}
        {canManage && onAddChild ? (
          <MenuItem onSelect={onAddChild}>
            <FolderTree className="h-4 w-4 text-muted" aria-hidden /> Tambah sub modul
          </MenuItem>
        ) : null}
        {canManage ? (
          <>
            <MenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4 text-muted" aria-hidden /> Ubah
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden /> Hapus
            </MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  );
}
