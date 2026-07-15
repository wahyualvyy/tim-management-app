"use client";

import { useState } from "react";
import Link from "next/link";

interface SearchItem {
  id: string;
  title: string;
  type: "PROJECT" | "TASK";
  projectId: string;
}

export default function SidebarSearch({
  initialItems,
}: {
  initialItems: SearchItem[];
}) {
  const [query, setQuery] = useState("");

  const filteredItems =
    query.trim() === ""
      ? []
      : initialItems
          .filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5);

  return (
    <div className="px-2 mb-4 relative z-[2000]">
      <div className="relative">
        <input
          type="text"
          placeholder="Cari proyek atau task..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {filteredItems.length > 0 && (
        <div className="absolute left-4 right-4 mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 mb-1">
            Hasil Pencarian
          </span>
          <div className="space-y-0.5">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={
                  item.type === "PROJECT"
                    ? `/dashboard/projects/${item.id}`
                    : `/dashboard/projects/${item.projectId}/tasks/${item.id}`
                }
                onClick={() => setQuery("")}
                className="flex flex-col rounded md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200 truncate">
                  {item.title}
                </span>
                <span className="text-[9px] text-zinc-400 uppercase tracking-tight mt-0.5">
                  {item.type === "PROJECT" ? "📁 Proyek" : "📋 Tugas"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {query && filteredItems.length === 0 && (
        <div className="absolute left-4 right-4 mt-1 rounded-lg border border-zinc-200 bg-white p-3 text-center text-xs text-zinc-400 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          Tidak ada hasil ditemukan.
        </div>
      )}
    </div>
  );
}