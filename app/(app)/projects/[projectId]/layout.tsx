import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Archive, CalendarClock } from "lucide-react";
import { loadMemberPreview, loadProjectPage } from "@/lib/domain/project-data";
import { getProjectSummaries } from "@/lib/redis/projects";
import { requestTime } from "@/lib/domain/views";
import { canEditProject, isWritable } from "@/lib/permissions";
import { formatCalendarDate, todayIn } from "@/lib/dates";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Badge, ProgressSummary } from "@/components/ui/primitives";
import { ProjectIcon } from "@/components/project/project-icon";
import { ProjectTabs } from "@/components/project/project-tabs";
import { AssigneeStack } from "@/components/task/assignee-stack";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const { project } = await loadProjectPage(projectId);
  return { title: project.name };
}

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const [summaries, preview] = await Promise.all([getProjectSummaries([project.id], 0), loadMemberPreview(project.id)]);
  const stats = summaries.get(project.id)?.stats ?? { total: 0, done: 0 };
  const today = todayIn(user.timezone, requestTime());
  const late = project.dueDate && project.dueDate < today && project.status !== "COMPLETED";

  return (
    <>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProjectIcon icon={project.icon} color={project.color} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
              <Badge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              <span className="font-mono">{project.key}</span> · Peran Anda: {ROLE_LABEL[role]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ProgressSummary done={stats.done} total={stats.total} className="w-44" />
          <AssigneeStack people={preview.members} max={5} size="sm" total={preview.total} />
          {project.dueDate ? (
            <span className={cn("inline-flex items-center gap-1.5 text-xs", late ? "font-medium text-danger" : "text-muted")}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Tenggat {formatCalendarDate(project.dueDate, { year: "numeric" })}
            </span>
          ) : null}
        </div>
      </header>
      {!isWritable(project) ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
          <Archive className="h-4 w-4" aria-hidden />
          Proyek ini diarsipkan dan hanya dapat dilihat.
          {canEditProject(role) ? " Aktifkan kembali dari Pengaturan untuk melakukan perubahan." : ""}
        </div>
      ) : null}
      <ProjectTabs projectId={project.id} showSettings={canEditProject(role)} />
      <div className="pt-5">{children}</div>
    </>
  );
}
