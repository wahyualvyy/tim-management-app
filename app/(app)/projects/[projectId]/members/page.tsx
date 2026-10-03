import { loadProjectPage } from "@/lib/domain/project-page";
import { loadProjectStructure } from "@/lib/domain/project-data";
import { assignableRoles, canManageMember, canManageMembers, isWritable } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { AddMemberForm, MemberRoleSelect, RemoveMemberButton } from "@/components/project/member-controls";
import { ROLE_DESCRIPTION } from "@/lib/labels";
import { PROJECT_ROLES } from "@/types/project";

export default async function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const { members } = await loadProjectStructure(project.id);
  const writable = isWritable(project);
  const manage = writable && canManageMembers(role);
  const roles = assignableRoles(role);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        {manage ? (
          <Card>
            <CardHeader title="Add a member" />
            <div className="px-4 py-4">
              <AddMemberForm projectId={project.id} roles={roles} />
            </div>
          </Card>
        ) : null}
        <Card>
          <CardHeader title={`Members · ${members.length}`} />
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const self = m.id === user.id;
              const canChange = manage && !self && canManageMember(role, m.role);
              const canRemove = writable && m.role !== "OWNER" && (self || canChange);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} src={m.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {m.name}
                      {self ? <span className="font-normal text-muted"> (you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted">{m.jobTitle || m.email}</p>
                  </div>
                  {canChange ? (
                    <MemberRoleSelect projectId={project.id} userId={m.id} role={m.role} roles={roles} />
                  ) : (
                    <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{m.role.toLowerCase()}</Badge>
                  )}
                  {canRemove ? (
                    <RemoveMemberButton projectId={project.id} userId={m.id} name={m.name} self={self} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Roles" />
        <dl className="space-y-3 px-4 py-4">
          {PROJECT_ROLES.map((r) => (
            <div key={r}>
              <dt className="text-[13px] font-medium">{r.charAt(0) + r.slice(1).toLowerCase()}</dt>
              <dd className="text-xs text-muted">
                {ROLE_DESCRIPTION[r]}
                {r === "VIEWER" && project.allowViewerComments ? ". Can comment in this project." : ""}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
