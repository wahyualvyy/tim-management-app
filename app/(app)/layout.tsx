import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { getProjects, listUserProjectIds } from "@/lib/redis/repositories/project.repository";
import { countUnread } from "@/lib/redis/repositories/notification.repository";
import { getActiveTimer } from "@/lib/redis/repositories/timer.repository";
import { getTask } from "@/lib/redis/repositories/task.repository";
import { scanDeadlines } from "@/lib/domain/notify";
import { requestTime } from "@/lib/domain/views";
import { todayIn } from "@/lib/dates";
import { taskRef } from "@/lib/utils";
import { AppShell, SIDEBAR_COOKIE } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeSync } from "@/components/layout/theme-sync";
import { TimerProvider, type TimerView } from "@/components/timer/timer-provider";
import { MobileTimerBar } from "@/components/timer/timer-display";
import { TaskDrawer } from "@/components/task/task-drawer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [projectIds, unreadCount, timer, cookieStore] = await Promise.all([
    listUserProjectIds(user.id),
    countUnread(user.id),
    getActiveTimer(user.id),
    cookies(),
    // Deadline reminders are generated lazily and must never break the page.
    scanDeadlines(user).catch((error: unknown) => console.error("Deadline scan failed", error)),
  ]);
  const projects = await getProjects(projectIds);
  const activeProjects = projects.filter((p) => !p.archived);

  let timerView: TimerView | null = null;
  if (timer) {
    const task = await getTask(timer.taskId);
    const project = projects.find((p) => p.id === timer.projectId);
    // A timer whose task was deleted is still shown so it can be stopped (nothing is recorded).
    timerView = {
      taskId: timer.taskId,
      projectId: timer.projectId,
      startedAt: timer.startedAt,
      taskTitle: task?.title ?? "Deleted task",
      taskRef: task && project ? taskRef(project.key, task.number) : "—",
    };
  }
  const now = requestTime();

  return (
    <TimerProvider initial={timerView} serverNow={now}>
      <ThemeSync preference={user.themePreference} />
      <AppShell
        user={{ name: user.name, email: user.email, avatar: user.avatar }}
        projects={activeProjects.map((p) => ({ id: p.id, name: p.name, icon: p.icon }))}
        unreadCount={unreadCount}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      >
        {children}
      </AppShell>
      <MobileTimerBar />
      <CommandPalette />
      <Suspense fallback={null}>
        <TaskDrawer timeZone={user.timezone} today={todayIn(user.timezone, now)} />
      </Suspense>
    </TimerProvider>
  );
}
