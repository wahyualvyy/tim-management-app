"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { setTaskStatusAction } from "@/app/actions/task/set-task-status";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { TaskItem } from "@/types/views";
import { TaskCard } from "./task-card";
import { PRIORITY_RANK, STATUS_META, StatusIcon } from "./task-meta";
import { useOpenTask } from "./use-open-task";

function sortTasks(a: TaskItem, b: TaskItem): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1;
  return b.createdAt - a.createdAt;
}

function DraggableCard({
  task,
  today,
  showModule,
  disabled,
}: {
  task: TaskItem;
  today: string;
  showModule: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled });
  const { open } = useOpenTask();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${task.ref} ${task.title}`}
      onClick={() => open(task.id)}
      onKeyDown={(e) => {
        // Enter opens; Space is reserved for keyboard dragging.
        if (e.key === "Enter") open(task.id);
        else listeners?.onKeyDown?.(e);
      }}
    >
      <TaskCard task={task} today={today} showModule={showModule} />
    </div>
  );
}

function Column({
  status,
  tasks,
  today,
  showModule,
  canMove,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  today: string;
  showModule: boolean;
  canMove: (task: TaskItem) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-w-[260px] flex-1 basis-0 lg:min-w-[212px] flex-col rounded-xl border border-transparent bg-surface-2/60 transition-colors",
        isOver && "border-accent/40 bg-accent-soft",
      )}
      aria-label={meta.label}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <StatusIcon status={status} />
        <h2 className="text-[13px] font-medium">{meta.label}</h2>
        <span className="tabular text-xs text-subtle">{tasks.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} today={today} showModule={showModule} disabled={!canMove(task)} />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-subtle">
            Drop tasks here
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Kanban with drag and drop. A drop updates the board optimistically and
 * persists through a server action; on failure the optimistic state is
 * discarded and the server state is shown again.
 */
export function KanbanBoard({
  tasks,
  today,
  showModule = true,
  movableTaskIds,
}: {
  tasks: TaskItem[];
  today: string;
  showModule?: boolean;
  /** Tasks the viewer may move; the server re-checks on every move. */
  movableTaskIds: string[];
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticTasks, moveOptimistic] = useOptimistic(
    tasks,
    (state: TaskItem[], move: { id: string; status: TaskStatus }) =>
      state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const movable = new Set(movableTaskIds);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const id = String(event.active.id);
    const status = event.over?.id as TaskStatus | undefined;
    const task = optimisticTasks.find((t) => t.id === id);
    if (!task || !status || task.status === status) return;
    startTransition(async () => {
      moveOptimistic({ id, status });
      const result = await setTaskStatusAction({ taskId: id, status });
      if (!result.ok) toast.error(result.error);
    });
  }

  const active = activeId ? optimisticTasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-3">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={optimisticTasks.filter((t) => t.status === status).sort(sortTasks)}
              today={today}
              showModule={showModule}
              canMove={(t) => movable.has(t.id)}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[256px]">
            <TaskCard task={active} today={today} showModule={showModule} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
