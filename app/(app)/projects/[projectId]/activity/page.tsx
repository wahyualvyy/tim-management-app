import { loadProjectPage } from "@/lib/domain/project-page";
import { requestTime } from "@/lib/domain/views";
import { listProjectActivity } from "@/lib/redis/repositories/activity.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
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
  const { items, hasMore } = await listProjectActivity(project.id, (page - 1) * PAGE_SIZE, PAGE_SIZE);
  const users = await getUsers(items.map((a) => a.actorId));
  const userMap = new Map([...users].map(([id, u]) => [id, toPublicUser(u)]));

  return (
    <>
      <Card className="px-4 py-5 sm:px-6">
        <ActivityFeed items={items} users={userMap} now={requestTime()} />
      </Card>
      <Pagination basePath={`/projects/${project.id}/activity`} page={page} hasMore={hasMore} />
    </>
  );
}
