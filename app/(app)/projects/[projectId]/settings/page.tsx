import { notFound } from "next/navigation";
import { loadProjectPage } from "@/lib/domain/project-page";
import { canDeleteProject, canEditProject } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/primitives";
import {
  ArchiveControl,
  DeleteProjectControl,
  ProjectDetailsForm,
} from "@/components/project/project-settings-forms";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, role } = await loadProjectPage(projectId);
  if (!canEditProject(role)) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Project details" />
        <div className="px-4 py-4">
          <ProjectDetailsForm project={project} disabled={project.archived} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={project.archived ? "Restore project" : "Archive project"}
          description={
            project.archived
              ? "Make the project editable again and show it in the sidebar."
              : "Archived projects are read-only and hidden from the sidebar. You can restore them later."
          }
          action={<ArchiveControl project={project} />}
        />
      </Card>

      {canDeleteProject(role) ? (
        <Card className="border-danger/30">
          <CardHeader
            title="Delete project"
            description="Permanently delete this project and everything in it. This can't be undone."
            action={<DeleteProjectControl project={project} />}
          />
        </Card>
      ) : null}
    </div>
  );
}
