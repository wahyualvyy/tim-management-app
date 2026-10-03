"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import { getTaskDetailAction } from "@/app/actions/task/get-task-detail";
import { Sheet, SheetClose } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import type { ActionResult } from "@/types/action";
import type { TaskDetail } from "@/types/task-detail";
import { TaskDetailView } from "./task-detail";

interface Loaded {
  taskId: string;
  version: number;
  result: ActionResult<TaskDetail>;
}

/**
 * Global task drawer. Any page can open a task by adding ?task=<id> to the
 * URL, so links from search, notifications and the calendar all land here
 * without a separate task page.
 */
export function TaskDrawer({ timeZone, today }: { timeZone: string; today: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskId = params.get("task");
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    getTaskDetailAction({ taskId })
      .catch((): ActionResult<TaskDetail> => ({ ok: false, error: "Network error. Check your connection." }))
      .then((result) => {
        if (!cancelled) setLoaded({ taskId, version, result });
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, version]);

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const current = loaded && loaded.taskId === taskId ? loaded : null;

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => (open ? undefined : close())} title="Task details">
      {!current ? (
        <DrawerSkeleton />
      ) : current.result.ok ? (
        <TaskDetailView
          key={current.result.data.task.id}
          detail={current.result.data}
          timeZone={timeZone}
          today={today}
          onChanged={reload}
          onDeleted={close}
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex justify-end p-3">
            <SheetClose className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </SheetClose>
          </div>
          <EmptyState
            icon={<AlertCircle className="h-5 w-5" />}
            title="Can't open this task"
            description={current.result.error}
          />
        </div>
      )}
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}
