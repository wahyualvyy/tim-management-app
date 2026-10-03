import type { Metadata } from "next";
import Link from "next/link";
import { Archive, FolderPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProjectSummaries, getProjects, listUserProjectIds } from "@/lib/redis/repositories/project.repository";
import { formatCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Progress } from "@/components/ui/primitives";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectButton } from "@/components/project/new-project-button";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const ids = await listUserProjectIds(user.id);
  const [projects, summaries] = await Promise.all([getProjects(ids), getProjectSummaries(ids, user.id)]);
  const visible = projects.filter((p) => p.archived === showArchived);
  const archivedCount = projects.filter((p) => p.archived).length;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything you're a member of."
        actions={<NewProjectButton />}
      />

      <div className="mb-4 flex gap-1 text-[13px]" role="tablist">
        <Link
          href="/projects"
          role="tab"
          aria-selected={!showArchived}
          className={cn("rounded-md px-2.5 py-1", !showArchived ? "bg-hover font-medium" : "text-muted hover:text-fg")}
        >
          Active
        </Link>
        <Link
          href="/projects?view=archived"
          role="tab"
          aria-selected={showArchived}
          className={cn("rounded-md px-2.5 py-1", showArchived ? "bg-hover font-medium" : "text-muted hover:text-fg")}
        >
          Archived{archivedCount ? ` · ${archivedCount}` : ""}
        </Link>
      </div>

      {visible.length === 0 ? (
        <Card>
          {showArchived ? (
            <EmptyState icon={<Archive className="h-5 w-5" />} title="No archived projects" />
          ) : (
            <EmptyState
              icon={<FolderPlus className="h-5 w-5" />}
              title="Create your first project"
              description="Organize work into modules and tasks."
              action={<NewProjectButton />}
            />
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const s = summaries.get(p.id);
            const total = s?.stats.total ?? 0;
            const done = s?.stats.done ?? 0;
            const pct = total > 0 ? (done / total) * 100 : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
              >
                <div className="flex items-start gap-3">
                  <ProjectIcon icon={p.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="font-mono text-[11px] text-subtle">{p.key}</p>
                  </div>
                  <Badge tone={p.status === "COMPLETED" ? "success" : p.status === "ON_HOLD" ? "warning" : "neutral"}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5em] text-[13px] text-muted">
                  {p.description || "No description."}
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span className="tabular">
                      {done} / {total} tasks
                    </span>
                    <span className="tabular">{Math.round(pct)}%</span>
                  </div>
                  <Progress value={pct} label={`${p.name} progress`} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {s?.memberCount ?? 1}
                  </span>
                  {p.targetDate ? <span>Target {formatCalendarDate(p.targetDate, { year: "numeric" })}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
