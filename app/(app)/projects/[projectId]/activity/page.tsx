import { loadProjectPage } from "@/lib/domain/project-data";
import { requestTime } from "@/lib/domain/views";
import { listProjectActivities } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { toPublicUser } from "@/types/user";
import { Card } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { ActivityFeed } from "@/components/activity/activity-feed";

const PAGE_SIZE = 40;

export default async function ProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { projectId } = await params;
  const page = parsePage((await searchParams).page);
  const { project } = await loadProjectPage(projectId);
  const { items, hasMore } = await listProjectActivities(project.id, (page - 1) * PAGE_SIZE, PAGE_SIZE);
  const users = await getUsers(items.map((a) => a.actorId));

  return (
    <>
      <Card className="px-4 py-5 sm:px-6">
        <ActivityFeed items={items} users={new Map([...users].map(([id, u]) => [id, toPublicUser(u)]))} now={requestTime()} />
      </Card>
      <Pagination basePath={`/projects/${project.id}/activity`} page={page} hasMore={hasMore} />
    </>
  );
}
