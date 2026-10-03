import { loadProjectPage, loadStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listScheduledTasks } from "@/lib/redis/tasks";
import { todayIn } from "@/lib/dates";
import { parseSchedule, ScheduleView } from "@/components/calendar/schedule-view";

export default async function ProjectSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; at?: string }>;
}) {
  const { projectId } = await params;
  const { user, project } = await loadProjectPage(projectId);
  const today = todayIn(user.timezone, requestTime());
  const range = parseSchedule(await searchParams, today);
  const [tasks, structure] = await Promise.all([listScheduledTasks([project.id], range.from, range.to), loadStructure(project.id)]);
  const items = await toTaskItems(tasks, { projects: [project], structure });

  return <ScheduleView basePath={`/projects/${project.id}/schedule`} range={range} today={today} tasks={items} showProject={false} />;
}
