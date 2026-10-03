import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { loadProjectPage } from "@/lib/domain/project-page";
import { canEditProject } from "@/lib/permissions";
import { Badge } from "@/components/ui/primitives";
import { ProjectIcon } from "@/components/project/project-icon";
import { ProjectTabs } from "@/components/project/project-tabs";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const { project } = await loadProjectPage(projectId);
  return { title: project.name };
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await loadProjectPage(projectId);

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <ProjectIcon icon={project.icon} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
            <Badge>
              <span className="font-mono">{project.key}</span>
            </Badge>
            <Badge tone={project.status === "COMPLETED" ? "success" : project.status === "ON_HOLD" ? "warning" : "neutral"}>
              {PROJECT_STATUS_LABEL[project.status]}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted">Your role: {role.toLowerCase()}</p>
        </div>
      </div>
      {project.archived ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted">
          <Archive className="h-4 w-4" aria-hidden />
          This project is archived and read-only.
          {canEditProject(role) ? " Restore it from Settings to make changes." : ""}
        </div>
      ) : null}
      <ProjectTabs projectId={project.id} showSettings={canEditProject(role)} />
      <div className="pt-5">{children}</div>
    </>
  );
}
