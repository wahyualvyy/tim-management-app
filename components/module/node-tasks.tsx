"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { loadNodeTasksAction } from "@/app/actions/query/query-actions";
import { TaskList } from "@/components/task/task-row";
import type { TaskItem } from "@/types/views";

/**
 * Tasks of one module (direct) or sub module, loaded when the node is opened,
 * 25 at a time. `version` changes on every server render so edits elsewhere
 * refresh the list.
 */
export function NodeTasks({
  projectId,
  moduleId,
  subModuleId,
  today,
  version,
}: {
  projectId: string;
  moduleId: string;
  subModuleId: string | null;
  today: string;
  version: number;
}) {
  const key = `${moduleId}:${subModuleId ?? ""}:${version}`;
  const [state, setState] = useState<{ key: string; tasks: TaskItem[]; hasMore: boolean; error: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    loadNodeTasksAction({ projectId, moduleId, subModuleId, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setState(res.ok ? { key, tasks: res.data.tasks, hasMore: res.data.hasMore, error: null } : { key, tasks: [], hasMore: false, error: res.error });
      })
      .catch(() => {
        if (!cancelled) setState({ key, tasks: [], hasMore: false, error: "Gagal memuat tugas." });
      });
    return () => {
      cancelled = true;
    };
  }, [key, projectId, moduleId, subModuleId]);

  const current = state?.key === key ? state : null;
  if (!current) {
    return (
      <p className="flex items-center gap-2 px-3 py-3 text-xs text-subtle">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Memuat tugas…
      </p>
    );
  }
  if (current.error) return <p className="px-3 py-3 text-xs text-danger">{current.error}</p>;

  function loadMore() {
    if (!current) return;
    const offset = current.tasks.length;
    startTransition(async () => {
      const res = await loadNodeTasksAction({ projectId, moduleId, subModuleId, offset });
      if (!res.ok) return;
      setState((prev) =>
        prev && prev.key === key
          ? { ...prev, tasks: [...prev.tasks, ...res.data.tasks.filter((t) => !prev.tasks.some((p) => p.id === t.id))], hasMore: res.data.hasMore }
          : prev,
      );
    });
  }

  return (
    <>
      <TaskList tasks={current.tasks} today={today} showModule={false} empty="Belum ada tugas." />
      {current.hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={pending}
          className="flex h-8 w-full items-center justify-center gap-1.5 border-t border-border text-xs text-muted hover:bg-hover hover:text-fg disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Muat lebih banyak
        </button>
      ) : null}
    </>
  );
}
