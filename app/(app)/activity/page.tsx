import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProjects, listUserProjectIds } from "@/lib/redis/projects";
import { listRecentActivities } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { requestTime } from "@/lib/domain/views";
import { toPublicUser } from "@/types/user";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const metadata: Metadata = { title: "Aktivitas" };

const PAGE_SIZE = 40;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const page = parsePage((await searchParams).page);
  const projectIds = await listUserProjectIds(user.id);
  const [projects, { items, hasMore }] = await Promise.all([
    getProjects(projectIds),
    listRecentActivities(projectIds, (page - 1) * PAGE_SIZE, PAGE_SIZE),
  ]);
  const users = await getUsers(items.map((a) => a.actorId));

  return (
    <>
      <PageHeader title="Aktivitas" description="Apa yang terjadi di semua proyek Anda." />
      <Card className="px-4 py-5 sm:px-6">
        {items.length === 0 ? (
          <EmptyState icon={<Activity className="h-5 w-5" />} title="Belum ada aktivitas" description="Aktivitas tim akan muncul di sini." />
        ) : (
          <ActivityFeed
            items={items}
            users={new Map([...users].map(([id, u]) => [id, toPublicUser(u)]))}
            now={requestTime()}
            projectNames={new Map(projects.map((p) => [p.id, p.name]))}
          />
        )}
      </Card>
      <Pagination basePath="/activity" page={page} hasMore={hasMore} />
    </>
  );
}
