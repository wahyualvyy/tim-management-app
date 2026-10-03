import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { countUserProjects, getProject, getProjects, listUserProjectIds } from "@/lib/redis/projects";
import { countUnread } from "@/lib/redis/notifications";
import { getActiveTimer } from "@/lib/redis/timeLogs";
import { getTask } from "@/lib/redis/tasks";
import { scanDeadlines } from "@/lib/domain/notify";
import { requestTime } from "@/lib/domain/views";
import { todayIn } from "@/lib/dates";
import { isAdmin } from "@/lib/permissions";
import { taskRef } from "@/lib/utils";
import { AppShell, SIDEBAR_COOKIE } from "@/components/layout/app-shell";
import { logError } from "@/lib/log";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeSync } from "@/components/layout/theme-sync";
import { TimerProvider, type TimerView } from "@/components/timer/timer-provider";
import { MobileTimerBar } from "@/components/timer/timer-display";
import { TaskDrawer } from "@/components/task/task-drawer";

const SIDEBAR_PROJECTS = 8;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [projectIds, projectTotal, unreadCount, timer, cookieStore] = await Promise.all([
    // The sidebar shows only the most recent projects; the full list is paginated on /projects.
    listUserProjectIds(user.id, 0, SIDEBAR_PROJECTS),
    countUserProjects(user.id),
    countUnread(user.id),
    getActiveTimer(user.id),
    cookies(),
    // Deadline reminders are generated lazily and must never break the page.
    scanDeadlines(user).catch((error: unknown) => logError("deadlines.scan", error)),
  ]);
  const projects = await getProjects(projectIds);

  let timerView: TimerView | null = null;
  if (timer) {
    const [task, project] = await Promise.all([
      getTask(timer.taskId),
      projects.find((p) => p.id === timer.projectId) ?? getProject(timer.projectId),
    ]);
    // A timer whose task was deleted is still shown so it can be stopped (nothing is saved).
    timerView = {
      taskId: timer.taskId,
      projectId: timer.projectId,
      startedAt: timer.startedAt,
      taskTitle: task?.title ?? "Tugas yang dihapus",
      taskRef: task && project ? taskRef(project.key, task.number) : "",
    };
  }
  const now = requestTime();

  return (
    <TimerProvider initial={timerView} serverNow={now}>
      <ThemeSync preference={user.themePreference} />
      <AppShell
        user={{ name: user.name, username: user.username, avatar: user.avatar, isAdmin: isAdmin(user) }}
        projects={projects
          .filter((p) => p.status !== "ARCHIVED")
          .map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }))}
        projectTotal={projectTotal}
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
