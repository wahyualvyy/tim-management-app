import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { countUsers, listUsers } from "@/lib/redis/users";
import { isAdmin } from "@/lib/permissions";
import { formatLongDate } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Card, PageHeader } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { AdminUserControls } from "@/components/profile/admin-user-controls";

export const metadata: Metadata = { title: "Kelola pengguna" };

const PAGE_SIZE = 30;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const viewer = await requireUser();
  if (!isAdmin(viewer)) notFound();
  const page = parsePage((await searchParams).page);
  const [{ users, hasMore }, total] = await Promise.all([listUsers((page - 1) * PAGE_SIZE, PAGE_SIZE), countUsers()]);

  return (
    <>
      <PageHeader title="Kelola pengguna" description={`${total} akun terdaftar. Admin ditentukan lewat ADMIN_EMAILS atau dari halaman ini.`} />
      <Card>
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={u.name} src={u.avatar} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted">
                  {u.email} · bergabung {formatLongDate(u.createdAt, viewer.timezone)}
                </p>
              </div>
              <AdminUserControls userId={u.id} name={u.name} status={u.status} role={u.role} self={u.id === viewer.id} />
            </li>
          ))}
        </ul>
      </Card>
      <Pagination basePath="/admin/users" page={page} hasMore={hasMore} />
    </>
  );
}
