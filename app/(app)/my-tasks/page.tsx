import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listAssignedTasks } from "@/lib/redis/repositories/task.repository";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { addDays, todayIn } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { TaskList } from "@/components/task/task-row";
import { PRIORITY_RANK } from "@/components/task/task-meta";
import type { TaskItem } from "@/types/views";

export const metadata: Metadata = { title: "My tasks" };

function byDueThenPriority(a: TaskItem, b: TaskItem): number {
  const d = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  return d !== 0 ? d : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export default async function MyTasksPage() {
  const user = await requireUser();
  const today = todayIn(user.timezone, requestTime());
  const weekEnd = addDays(today, 7);
  const items = (await toTaskItems(await listAssignedTasks(user.id))).sort(byDueThenPriority);

  const open = items.filter((t) => t.status !== "DONE");
  const groups: { title: string; tasks: TaskItem[]; empty: string }[] = [
    { title: "Overdue", tasks: open.filter((t) => t.dueDate && t.dueDate < today), empty: "Nothing overdue." },
    { title: "Today", tasks: open.filter((t) => t.dueDate === today), empty: "Nothing due today." },
    {
      title: "Next 7 days",
      tasks: open.filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd),
      empty: "Nothing due this week.",
    },
    {
      title: "Later or no date",
      tasks: open.filter((t) => !t.dueDate || t.dueDate > weekEnd),
      empty: "No other open tasks.",
    },
    {
      title: "Recently completed",
      tasks: items
        .filter((t) => t.status === "DONE")
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .slice(0, 10),
      empty: "Completed tasks appear here.",
    },
  ];

  return (
    <>
      <PageHeader title="My tasks" description={`${open.length} open ${open.length === 1 ? "task" : "tasks"} assigned to you`} />
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title="No tasks assigned to you"
            description="When someone assigns you a task, or you take one, it shows up here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.tasks.length > 0 || g.title === "Today")
            .map((g) => (
              <Card key={g.title}>
                <CardHeader title={`${g.title} · ${g.tasks.length}`} />
                <TaskList tasks={g.tasks} today={today} showProject empty={g.empty} />
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
