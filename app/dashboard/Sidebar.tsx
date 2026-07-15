import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ThemeToggle from "./ThemeToggle";
import SidebarSearch from "./SidebarSearch";
import SidebarClock from "./SidebarClock";

export default async function Sidebar() {
  const session = await getServerSession(authOptions);

  const projectsData = await prisma.project.findMany({
    where: {
      members: {
        some: { user_id: session?.user?.id || "" },
      },
    },
    include: {
      tasks: {
        where: {
          OR: [
            { assigned_to: session?.user?.id || "" },
            { created_by: session?.user?.id || "" },
          ],
        },
      },
    },
  });

  const searchItems: {
    id: string;
    title: string;
    type: "PROJECT" | "TASK";
    projectId: string;
  }[] = [];

  projectsData.forEach((project) => {
    searchItems.push({
      id: project.id,
      title: project.name,
      type: "PROJECT",
      projectId: project.id,
    });

    project.tasks.forEach((task) => {
      searchItems.push({
        id: task.id,
        title: task.title,
        type: "TASK",
        projectId: project.id,
      });
    });
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-[999] flex h-full w-64 flex-col border-r border-zinc-200 bg-white px-4 py-6 text-zinc-900 transition-colors dark:border-zinc-800 dark:bg-zinc-950 dark:text-white pointer-events-auto">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-sm font-black text-white dark:bg-white dark:text-black">
          W
        </div>
        <span className="font-semibold tracking-tight">Workspace</span>
      </div>

      {/* TAMPILKAN JAM DI SINI */}
      <SidebarClock />

      <SidebarSearch initialItems={searchItems} />

      <nav className="flex-1 space-y-1 relative z-[1000]">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Dashboard
        </Link>
        <Link
          href="/dashboard/schedule"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Lihat Jadwal
        </Link>
        <Link
          href="/dashboard/notifications"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Notifikasi
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Atur Profil
        </Link>

        <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800 relative z-[1001]">
          <ThemeToggle />
        </div>
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-zinc-200 pt-4 px-2 dark:border-zinc-800 relative z-[1000]">
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt="Profile"
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full border border-zinc-300 object-cover dark:border-zinc-700"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-200">
            {session?.user?.name}
          </span>
          <span className="truncate text-[10px] text-zinc-500">
            {session?.user?.email}
          </span>
        </div>
      </div>
    </aside>
  );
}
