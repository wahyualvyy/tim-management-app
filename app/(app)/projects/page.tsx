import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CalendarClock, FolderPlus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProjectSummaries, getProjects, listUserProjectHeaders } from "@/lib/redis/projects";
import { getRolesInProjects } from "@/lib/redis/members";
import { getUsers } from "@/lib/redis/users";
import { requestTime } from "@/lib/domain/views";
import { formatCalendarDate, todayIn } from "@/lib/dates";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { matchesAllWords } from "@/lib/search-terms";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { Badge, Card, EmptyState, PageHeader, ProgressSummary } from "@/components/ui/primitives";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectButton } from "@/components/project/new-project-button";
import { AssigneeStack } from "@/components/task/assignee-stack";

export const metadata: Metadata = { title: "Proyek Saya" };

const PAGE_SIZE = 24;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const showArchived = params.view === "archived";
  const query = (params.q ?? "").trim().slice(0, 100);
  const page = parsePage(params.page);
  const today = todayIn(user.timezone, requestTime());

  // Headers (name, key, status) are small; full records and summaries load for one page only.
  const headers = await listUserProjectHeaders(user.id);
  const archivedCount = headers.filter((p) => p.status === "ARCHIVED").length;
  const matching = headers.filter(
    (p) => (p.status === "ARCHIVED") === showArchived && (!query || matchesAllWords(`${p.name} ${p.key}`, query)),
  );
  const pageIds = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => p.id);
  const [visible, summaries, roles] = await Promise.all([getProjects(pageIds), getProjectSummaries(pageIds, 4), getRolesInProjects(pageIds, user.id)]);
  const people = await getUsers(visible.flatMap((p) => summaries.get(p.id)?.previewMemberIds ?? []));

  const tab = (active: boolean) => cn("rounded-md px-2.5 py-1", active ? "bg-hover font-medium" : "text-muted hover:text-fg");

  return (
    <>
      <PageHeader title="Proyek Saya" description="Semua proyek tempat Anda menjadi anggota." actions={<NewProjectButton />} />

      <div className="mb-4 flex gap-1 text-[13px]">
        <Link href="/projects" aria-current={!showArchived ? "page" : undefined} className={tab(!showArchived)}>
          Berjalan
        </Link>
        <Link href="/projects?view=archived" aria-current={showArchived ? "page" : undefined} className={tab(showArchived)}>
          Diarsipkan{archivedCount ? ` · ${archivedCount}` : ""}
        </Link>
      </div>

      <form action="/projects" className="mb-4 flex max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:ring-2 focus-within:ring-ring/40">
        {showArchived ? <input type="hidden" name="view" value="archived" /> : null}
        <Search className="h-3.5 w-3.5 text-subtle" aria-hidden />
        <input
          name="q"
          defaultValue={query}
          placeholder="Cari nama atau kode proyek…"
          aria-label="Cari proyek"
          className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle focus-visible:outline-none"
        />
      </form>

      {visible.length === 0 ? (
        <Card>
          {query ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="Tidak ada proyek yang cocok" description={`Tidak ada hasil untuk "${query}".`} />
          ) : showArchived ? (
            <EmptyState icon={<Archive className="h-5 w-5" />} title="Tidak ada proyek yang diarsipkan" />
          ) : (
            <EmptyState
              icon={<FolderPlus className="h-5 w-5" />}
              title="Belum ada proyek"
              description="Mulai dengan membuat proyek pertama Anda."
              action={<NewProjectButton label="Tambah proyek" />}
            />
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const s = summaries.get(p.id);
            const members = (s?.previewMemberIds ?? []).flatMap((id) => {
              const u = people.get(id);
              return u ? [{ id: u.id, name: u.name, avatar: u.avatar }] : [];
            });
            const role = roles.get(p.id);
            const late = p.dueDate && p.dueDate < today && p.status !== "COMPLETED";
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-start gap-3">
                  <ProjectIcon icon={p.icon} color={p.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-[11px] text-subtle">
                      <span className="font-mono">{p.key}</span>
                      {role ? ` · ${ROLE_LABEL[role]}` : ""}
                    </p>
                  </div>
                  <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5em] text-[13px] text-muted">{p.description || "Belum ada deskripsi."}</p>
                <ProgressSummary done={s?.stats.done ?? 0} total={s?.stats.total ?? 0} className="mt-4" />
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
                  <AssigneeStack people={members} max={4} total={s?.memberCount} />
                  {p.dueDate ? (
                    <span className={cn("inline-flex items-center gap-1", late && "font-medium text-danger")}>
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      {formatCalendarDate(p.dueDate, { year: "numeric" })}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination
        basePath="/projects"
        query={{ view: showArchived ? "archived" : undefined, q: query || undefined }}
        page={page}
        hasMore={matching.length > page * PAGE_SIZE}
      />
    </>
  );
}
