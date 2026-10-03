import { createTaskContext, loadProjectPage, loadStructure } from "@/lib/domain/project-data";
import { requestTime } from "@/lib/domain/views";
import { getUsers } from "@/lib/redis/users";
import { canManageStructure, isWritable } from "@/lib/permissions";
import { todayIn } from "@/lib/dates";
import { StructureTree } from "@/components/module/structure-tree";
import type { PersonOption } from "@/types/views";

export default async function StructurePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const structure = await loadStructure(project.id);
  // Only the leads are resolved here; tasks load per node when it is opened.
  const leadIds = structure.flatMap((m) => [m.leadId, ...m.subModules.map((s) => s.leadId)]).filter((id): id is string => Boolean(id));
  const users = await getUsers(leadIds);
  const leads: PersonOption[] = [...users.values()].map((u) => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, jobTitle: u.jobTitle }));
  const now = requestTime();

  return (
    <StructureTree
      projectId={project.id}
      modules={structure}
      canManage={isWritable(project) && canManageStructure(role)}
      createContext={createTaskContext(project, role, user, structure)}
      leads={leads}
      today={todayIn(user.timezone, now)}
      version={now}
    />
  );
}
