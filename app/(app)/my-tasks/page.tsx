import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getUserTaskCounts, listUserDone, listUserDueBetween, listUserOpenPage } from "@/lib/redis/tasks";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { addDays, todayIn, zonedMidnight } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { TaskList } from "@/components/task/task-row";
import type { TaskItem } from "@/types/views";

export const metadata: Metadata = { title: "Tugas Saya" };

const PAGE_SIZE = 25;
/** Upper bound for the dated groups; they come from the due-date index, earliest first. */
const DATED_LIMIT = 100;

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const page = parsePage((await searchParams).page);
  const today = todayIn(user.timezone, requestTime());
  const weekEnd = addDays(today, 7);
  const weekStart = zonedMidnight(addDays(today, -6), user.timezone);

  const [counts, dated, openPage, done] = await Promise.all([
    getUserTaskCounts(user.id, today, weekStart),
    page === 1 ? listUserDueBetween(user.id, null, weekEnd, DATED_LIMIT) : Promise.resolve([]),
    listUserOpenPage(user.id, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    page === 1 ? listUserDone(user.id, 10) : Promise.resolve([]),
  ]);
  const [datedItems, openItems, doneItems] = await Promise.all([toTaskItems(dated), toTaskItems(openPage.tasks), toTaskItems(done)]);

  const groups: { title: string; tasks: TaskItem[]; empty: string; always?: boolean }[] =
    page === 1
      ? [
          { title: "Terlambat", tasks: datedItems.filter((t) => (t.dueDate ?? "") < today), empty: "" },
          { title: "Hari ini", tasks: datedItems.filter((t) => t.dueDate === today), empty: "Tidak ada tenggat hari ini.", always: true },
          { title: "7 hari ke depan", tasks: datedItems.filter((t) => (t.dueDate ?? "") > today), empty: "" },
        ]
      : [];

  const nothing = counts.open === 0 && doneItems.length === 0 && page === 1;

  return (
    <>
      <PageHeader title="Tugas Saya" description={`${counts.open} tugas belum selesai ditugaskan kepada Anda`} />
      {nothing ? (
        <Card>
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title="Belum ada tugas untuk Anda"
            description="Tugas yang ditugaskan kepada Anda di proyek mana pun akan muncul di sini."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.tasks.length > 0 || g.always)
            .map((g) => (
              <Card key={g.title}>
                <CardHeader title={`${g.title} · ${g.tasks.length}`} />
                <TaskList tasks={g.tasks} today={today} showProject empty={g.empty} />
              </Card>
            ))}
          <Card>
            <CardHeader title={`Semua tugas terbuka · ${counts.open}`} description="Terbaru lebih dulu" />
            <TaskList tasks={openItems} today={today} showProject empty="Tidak ada tugas terbuka." />
          </Card>
          <Pagination basePath="/my-tasks" page={page} hasMore={openPage.hasMore} />
          {doneItems.length > 0 ? (
            <Card>
              <CardHeader title="Baru selesai" />
              <TaskList tasks={doneItems} today={today} showProject empty="" />
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
