"use client";

import { useEffect, useState } from "react";

export default function SidebarClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());

    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  if (!time) {
    return (
      <div className="mb-6 mx-2 flex h-14 animate-pulse flex-col rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50" />
    );
  }

  const formattedTime = time.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDate = time.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-6 mx-2 flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
        {formattedTime}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {formattedDate}
      </span>
    </div>
  );
}
