"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Opens the task drawer by adding ?task= to the current URL, keeping other params. */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = useCallback(
    (taskId: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("task", taskId);
      return `${pathname}?${next.toString()}`;
    },
    [params, pathname],
  );

  const open = useCallback(
    (taskId: string) => router.push(hrefFor(taskId), { scroll: false }),
    [hrefFor, router],
  );

  return { open, hrefFor };
}
