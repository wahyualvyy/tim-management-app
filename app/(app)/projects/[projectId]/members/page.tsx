import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { loadProjectPage } from "@/lib/domain/project-data";
import { countMembersByRole, listMembersPage, searchMembers, type MemberSort } from "@/lib/redis/members";
import { assignableRoles, canManageMember, canManageMembers, isWritable } from "@/lib/permissions";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/labels";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { AddMemberForm, MemberRoleSelect, MemberToolbar, RemoveMemberButton } from "@/components/project/member-controls";
import { PROJECT_ROLES, type ProjectRole } from "@/types/project";

const PAGE_SIZE = 25;
const SORTS: readonly MemberSort[] = ["name", "name_desc", "joined"];

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; role?: string; sort?: string; cursor?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { user, project, role } = await loadProjectPage(projectId);
  const writable = isWritable(project);
  const manage = writable && canManageMembers(role);
  const roles = assignableRoles(role);

  const q = (sp.q ?? "").trim().slice(0, 80);
  const roleFilter = (PROJECT_ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as ProjectRole) : null;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as MemberSort) : "name";
  const cursor = sp.cursor && sp.cursor.length <= 300 ? sp.cursor : null;

  const [counts, page] = await Promise.all([
    countMembersByRole(project.id),
    q
      ? searchMembers(project.id, q, { role: roleFilter, limit: PAGE_SIZE }).then((items) => ({ items, nextCursor: null }))
      : listMembersPage(project.id, { role: roleFilter, sort, cursor, limit: PAGE_SIZE }),
  ]);
  const total = PROJECT_ROLES.reduce((n, r) => n + counts[r], 0);

  const base = `/projects/${project.id}/members`;
  const keep = new URLSearchParams();
  if (q) keep.set("q", q);
  if (roleFilter) keep.set("role", roleFilter);
  if (sort !== "name") keep.set("sort", sort);
  const nextHref = page.nextCursor
    ? `${base}?${new URLSearchParams([...keep.entries(), ["cursor", page.nextCursor]]).toString()}`
    : null;
  const firstHref = keep.toString() ? `${base}?${keep.toString()}` : base;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        {manage ? (
          <Card>
            <CardHeader title="Tambah anggota" />
            <div className="px-4 py-4">
              <AddMemberForm projectId={project.id} roles={roles} />
            </div>
          </Card>
        ) : null}
        <Card>
          <CardHeader title={`Anggota · ${total}`} description={q ? `Hasil pencarian "${q}" (maks. ${PAGE_SIZE})` : undefined} />
          <MemberToolbar counts={counts} />
          {page.items.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="Tidak ada anggota yang cocok" description="Ubah kata kunci atau filter peran." />
          ) : (
            <ul className="divide-y divide-border">
              {page.items.map((m) => {
                const self = m.id === user.id;
                const canChange = manage && !self && canManageMember(role, m.role);
                const canRemove = writable && m.role !== "OWNER" && (self || canChange);
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={m.name} src={m.avatar} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {m.name}
                        {self ? <span className="font-normal text-muted"> (Anda)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        @{m.username}
                        {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                      </p>
                    </div>
                    {canChange ? (
                      <MemberRoleSelect projectId={project.id} userId={m.id} role={m.role} roles={roles} />
                    ) : (
                      <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                    )}
                    {canRemove ? <RemoveMemberButton projectId={project.id} userId={m.id} name={m.name} self={self} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {cursor || nextHref ? (
          <nav className="flex items-center justify-between" aria-label="Halaman anggota">
            {cursor ? (
              <Link href={firstHref} className={buttonClasses("outline", "sm")}>
                Kembali ke awal
              </Link>
            ) : (
              <span />
            )}
            {nextHref ? (
              <Link href={nextHref} className={buttonClasses("outline", "sm")}>
                Berikutnya <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
      <aside className="h-fit">
        <h2 className="mb-3 text-sm font-semibold">Peran</h2>
        <dl className="space-y-3">
          {PROJECT_ROLES.map((r) => (
            <div key={r}>
              <dt className="text-[13px] font-medium">
                {ROLE_LABEL[r]} <span className="font-normal text-subtle">· {counts[r]}</span>
              </dt>
              <dd className="text-xs text-muted">
                {ROLE_DESCRIPTION[r]}
                {r === "VIEWER" && project.allowViewerComments ? " Di proyek ini pengamat boleh berkomentar." : ""}
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
