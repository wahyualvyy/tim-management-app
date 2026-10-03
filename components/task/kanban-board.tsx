"use client";

import { useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Plus } from "lucide-react";
import { createTaskAction } from "@/app/actions/task/create-task";
import { loadColumnAction } from "@/app/actions/query/query-actions";
import { moveTaskAction } from "@/app/actions/task/move-task";
import { useToast } from "@/components/ui/toast";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { TaskItem } from "@/types/views";
import { TaskCard } from "./task-card";
import { StatusIcon } from "./task-meta";
import { useOpenTask } from "./use-open-task";

/** One Kanban column as rendered on the server: the first page and the column size. */
export interface BoardColumnData {
  status: TaskStatus;
  tasks: TaskItem[];
  total: number;
}

export interface QuickAddTarget {
  projectId: string;
  moduleId: string;
  subModuleId: string | null;
}

const byOrder = (a: TaskItem, b: TaskItem) => a.order - b.order || a.createdAt - b.createdAt;

/** A position between the neighbours at `index`, so only the moved card is written. */
function orderAt(column: TaskItem[], index: number): number {
  const prev = column[index - 1]?.order;
  const next = column[index + 1]?.order;
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1000;
  if (next !== undefined) return next - 1000;
  return Date.now();
}

function SortableCard({ task, today, showModule, disabled }: { task: TaskItem; today: string; showModule: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  const { open } = useOpenTask();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation rounded-lg focus-visible:outline-offset-2", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${task.ref} ${task.title}. Tekan Enter untuk membuka, Spasi untuk memindahkan.`}
      onClick={() => open(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") open(task.id);
        else listeners?.onKeyDown?.(e);
      }}
    >
      <TaskCard task={task} today={today} showModule={showModule} />
    </div>
  );
}

function QuickAdd({ status, target }: { status: TaskStatus; target: QuickAddTarget }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs text-subtle hover:bg-hover hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Tambah cepat
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = title.trim();
        if (!value) return;
        startTransition(async () => {
          const result = await createTaskAction({ ...target, title: value, status, placeOnTop: true });
          if (result.ok) setTitle("");
          else toast.error(result.error);
        });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        disabled={pending}
        autoFocus
        maxLength={200}
        placeholder="Judul tugas, lalu Enter"
        aria-label={`Tugas baru di ${TASK_STATUS_LABEL[status]}`}
        className="h-8 w-full rounded-md border border-accent bg-surface px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </form>
  );
}

function Column({
  status,
  tasks,
  today,
  showModule,
  canMove,
  quickAdd,
  count,
  onLoadMore,
  loadingMore,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  today: string;
  showModule: boolean;
  canMove: (task: TaskItem) => boolean;
  quickAdd: QuickAddTarget | null;
  count: number;
  onLoadMore: (() => void) | null;
  loadingMore: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-w-[264px] flex-1 basis-0 flex-col rounded-lg bg-surface-2/70 transition-colors lg:min-w-[212px]",
        isOver && "bg-accent-soft",
      )}
      aria-label={TASK_STATUS_LABEL[status]}
    >
      <header className="flex items-center gap-2 px-3 pb-1.5 pt-3">
        <StatusIcon status={status} />
        <h2 className="truncate text-[13px] font-medium">{TASK_STATUS_LABEL[status]}</h2>
        <span className="tabular ml-auto rounded-md bg-surface px-1.5 text-[11px] text-muted">{count}</span>
      </header>
      <div className="px-2 pb-1">{quickAdd ? <QuickAdd status={status} target={quickAdd} /> : null}</div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} today={today} showModule={showModule} disabled={!canMove(task)} />
          ))}
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-subtle">Belum ada tugas</p>
          ) : null}
          {onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="flex h-8 items-center justify-center gap-1.5 rounded-md text-xs text-muted hover:bg-hover hover:text-fg disabled:opacity-60"
            >
              {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Muat lagi ({count - tasks.length} lainnya)
            </button>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * Kanban with drag and drop between and within columns. The board updates
 * immediately; each drop persists the new status and position of the moved
 * card only. On failure the server state is restored.
 */
export function KanbanBoard({
  columns,
  projectId,
  paginated,
  today,
  showModule = true,
  movableTaskIds,
  quickAdd,
}: {
  columns: BoardColumnData[];
  projectId: string;
  /** Columns are pages of the full status index and can load more on demand. */
  paginated: boolean;
  today: string;
  showModule?: boolean;
  movableTaskIds: string[];
  quickAdd: QuickAddTarget | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  // Local copy for smooth dragging and appended pages; reset whenever the server sends new data.
  const [source, setSource] = useState(columns);
  const [items, setItems] = useState(() => columns.flatMap((c) => c.tasks));
  const [extraMovable, setExtraMovable] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Partial<Record<TaskStatus, number>>>({});
  const [loadingStatus, setLoadingStatus] = useState<TaskStatus | null>(null);
  if (columns !== source) {
    setSource(columns);
    setItems(columns.flatMap((c) => c.tasks));
    setExtraMovable([]);
    setLoaded({});
  }
  const tasks = source.flatMap((c) => c.tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<TaskStatus | null>(null);
  // The board before the current drag, to restore on cancel or a failed save.
  const [snapshot, setSnapshot] = useState<TaskItem[] | null>(null);
  const movable = new Set([...movableTaskIds, ...extraMovable]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const column = (status: TaskStatus, list = items) => list.filter((t) => t.status === status).sort(byOrder);

  /** Server size of a column, adjusted for cards moved in or out locally and pages appended. */
  function countOf(status: TaskStatus): number {
    const server = source.find((c) => c.status === status);
    const initial = tasks.filter((t) => t.status === status).length;
    const appended = loaded[status] ?? 0;
    return (server?.total ?? 0) + (column(status).length - initial - appended);
  }

  function loadMore(status: TaskStatus) {
    const offset = (source.find((c) => c.status === status)?.tasks.length ?? 0) + (loaded[status] ?? 0);
    setLoadingStatus(status);
    startTransition(async () => {
      const result = await loadColumnAction({ projectId, status, offset });
      setLoadingStatus(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLoaded((prev) => ({ ...prev, [status]: (prev[status] ?? 0) + result.data.tasks.length }));
      setExtraMovable((prev) => [...prev, ...result.data.movable]);
      setItems((list) => {
        const seen = new Set(list.map((t) => t.id));
        return [...list, ...result.data.tasks.filter((t) => !seen.has(t.id))];
      });
    });
  }
  const statusOf = (id: string): TaskStatus | null => {
    if ((TASK_STATUSES as readonly string[]).includes(id)) return id as TaskStatus;
    return items.find((t) => t.id === id)?.status ?? null;
  };

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    setDragFrom(statusOf(id));
    setSnapshot(items);
  }

  // Move the card into another column while hovering, so the drop position is visible.
  function onDragOver(event: DragOverEvent) {
    const id = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    const from = statusOf(id);
    const to = statusOf(overId);
    if (!from || !to || from === to) return;
    setItems((list) => {
      const target = column(to, list).filter((t) => t.id !== id);
      const overIndex = target.findIndex((t) => t.id === overId);
      const over = overIndex >= 0 ? target[overIndex] : undefined;
      const prev = overIndex > 0 ? target[overIndex - 1] : undefined;
      // Hovering a card places the dragged card just above it; hovering the column appends.
      const order = over
        ? prev
          ? (prev.order + over.order) / 2
          : over.order - 1000
        : (target[target.length - 1]?.order ?? Date.now()) + 1000;
      return list.map((t) => (t.id === id ? { ...t, status: to, order } : t));
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const from = dragFrom;
    const restore = snapshot ?? items;
    setActiveId(null);
    setDragFrom(null);
    setSnapshot(null);
    if (!overId || !from) {
      setItems(restore);
      return;
    }
    const status = statusOf(id);
    if (!status) return;
    let col = column(status);
    const oldIndex = col.findIndex((t) => t.id === id);
    const newIndex = (TASK_STATUSES as readonly string[]).includes(overId) ? col.length - 1 : col.findIndex((t) => t.id === overId);
    if (oldIndex !== newIndex && newIndex >= 0) col = arrayMove(col, oldIndex, newIndex);
    const index = col.findIndex((t) => t.id === id);
    const order = orderAt(col, index);
    const before = restore.find((t) => t.id === id);
    if (before && before.status === status && before.order === order) return;

    setItems((list) => list.map((t) => (t.id === id ? { ...t, status, order } : t)));
    startTransition(async () => {
      const result = await moveTaskAction({ taskId: id, status, order });
      if (!result.ok) {
        toast.error(result.error);
        setItems(restore);
      }
    });
  }

  const active = activeId ? items.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        if (snapshot) setItems(snapshot);
        setSnapshot(null);
      }}
    >
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-3">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={column(status)}
              today={today}
              showModule={showModule}
              canMove={(t) => movable.has(t.id)}
              quickAdd={quickAdd}
              count={paginated ? countOf(status) : column(status).length}
              onLoadMore={paginated && countOf(status) > column(status).length ? () => loadMore(status) : null}
              loadingMore={loadingStatus === status}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[248px]">
            <TaskCard task={active} today={today} showModule={showModule} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
