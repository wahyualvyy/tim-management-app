import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProjects, listUserProjectIds } from "@/lib/redis/projects";
import { listScheduledTasks } from "@/lib/redis/tasks";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/ui/primitives";
import { parseSchedule, ScheduleView } from "@/components/calendar/schedule-view";

export const metadata: Metadata = { title: "Jadwal" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; at?: string }> }) {
  const user = await requireUser();
  const today = todayIn(user.timezone, requestTime());
  const range = parseSchedule(await searchParams, today);
  const projects = (await getProjects(await listUserProjectIds(user.id))).filter((p) => p.status !== "ARCHIVED");
  const tasks = await listScheduledTasks(
    projects.map((p) => p.id),
    range.from,
    range.to,
  );
  const items = await toTaskItems(tasks, { projects });

  return (
    <>
      <PageHeader title="Jadwal" description="Tanggal mulai dan tenggat tugas di semua proyek Anda." />
      <ScheduleView basePath="/calendar" range={range} today={today} tasks={items} showProject />
    </>
  );
}
