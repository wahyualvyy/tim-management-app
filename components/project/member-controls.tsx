"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, UserPlus } from "lucide-react";
import { addMemberAction, changeMemberRoleAction, removeMemberAction } from "@/app/actions/member/member-actions";
import { searchInvitableUsersAction } from "@/app/actions/query/query-actions";
import { useAction } from "@/components/hooks/use-action";
import { useDebounced } from "@/components/hooks/use-debounced";
import { PersonSearchPopover } from "@/components/people/person-search";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/labels";
import { addMemberSchema } from "@/schemas/member.schema";
import { PROJECT_ROLES, type ProjectRole } from "@/types/project";
import type { PersonOption } from "@/types/views";

type Invitee = PersonOption & { email: string };

/**
 * Invite a registered user. People are searched on the server (at least two
 * characters, debounced), so the page never lists every account.
 */
export function AddMemberForm({ projectId, roles }: { projectId: string; roles: ProjectRole[] }) {
  const [person, setPerson] = useState<Invitee | null>(null);
  const [role, setRole] = useState<ProjectRole>(roles.includes("MEMBER") ? "MEMBER" : (roles[0] ?? "VIEWER"));
  const { run, pending, fieldErrors } = useAction(addMemberAction, {
    schema: addMemberSchema,
    successMessage: "Anggota berhasil ditambahkan.",
    onSuccess: () => setPerson(null),
  });
  const fetcher = useCallback((query: string) => searchInvitableUsersAction({ projectId, query }), [projectId]);

  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        if (person) void run({ projectId, userId: person.id, role });
      }}
    >
      <Field label="Orang" htmlFor="member-user" error={fieldErrors.userId} hint="Cari nama, username, atau email pengguna yang sudah pernah masuk.">
        <PersonSearchPopover<Invitee>
          fetcher={fetcher}
          minQuery={2}
          hint="Ketik minimal 2 huruf untuk mencari."
          emptyText="Tidak ada pengguna yang cocok atau semuanya sudah menjadi anggota."
          isSelected={(id) => person?.id === id}
          onPick={setPerson}
          trigger={
            <button
              id="member-user"
              type="button"
              data-invalid={fieldErrors.userId ? "" : undefined}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-sm hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[invalid]:border-danger"
            >
              {person ? (
                <>
                  <Avatar name={person.name} src={person.avatar} size="xs" />
                  <span className="min-w-0 flex-1 truncate">
                    {person.name} <span className="text-subtle">· {person.email}</span>
                  </span>
                </>
              ) : (
                <span className="flex flex-1 items-center gap-2 text-subtle">
                  <Search className="h-3.5 w-3.5" aria-hidden /> Pilih pengguna…
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
            </button>
          }
        />
      </Field>
      <Field label="Peran" htmlFor="member-role" error={fieldErrors.role}>
        <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary" loading={pending} disabled={!person} className="sm:mt-[22px]">
        <UserPlus className="h-4 w-4" aria-hidden />
        Tambah
      </Button>
    </form>
  );
}

/** Search (debounced 300 ms), role filter and sort, all kept in the URL. */
export function MemberToolbar({ counts }: { counts: Record<ProjectRole, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebounced(q.trim(), 300);
  const [, startTransition] = useTransition();

  const apply = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("cursor");
      const s = next.toString();
      startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (debounced !== (params.get("q") ?? "")) apply({ q: debounced });
  }, [debounced, params, apply]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, username, atau email" className="pl-8" aria-label="Cari anggota" />
      </div>
      <div className="w-[calc(50%-4px)] sm:w-40">
        <Select value={params.get("role") ?? ""} onChange={(e) => apply({ role: e.target.value })} aria-label="Peran">
          <option value="">Semua peran</option>
          {PROJECT_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]} ({counts[r]})
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-4px)] sm:w-40">
        <Select value={params.get("sort") ?? "name"} onChange={(e) => apply({ sort: e.target.value === "name" ? "" : e.target.value })} aria-label="Urutkan" disabled={Boolean(params.get("q"))}>
          <option value="name">Nama A–Z</option>
          <option value="name_desc">Nama Z–A</option>
          <option value="joined">Terbaru bergabung</option>
        </Select>
      </div>
    </div>
  );
}

export function MemberRoleSelect({
  projectId,
  userId,
  role,
  roles,
}: {
  projectId: string;
  userId: string;
  role: ProjectRole;
  roles: ProjectRole[];
}) {
  const { run, pending } = useAction(changeMemberRoleAction, { successMessage: "Peran diperbarui." });
  return (
    <div className="w-32">
      <Select value={role} disabled={pending} onChange={(e) => void run({ projectId, userId, role: e.target.value })} aria-label="Peran">
        {[role, ...roles.filter((r) => r !== role)].map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function RemoveMemberButton({ projectId, userId, name, self }: { projectId: string; userId: string; name: string; self: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, pending } = useAction(removeMemberAction, {
    successMessage: self ? "Anda telah keluar dari proyek." : "Anggota dikeluarkan.",
    onSuccess: () => {
      setOpen(false);
      if (self) router.push("/projects");
    },
  });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {self ? "Keluar" : "Keluarkan"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={self ? "Keluar dari proyek ini?" : `Keluarkan ${name}?`}
        description={
          self
            ? "Anda tidak dapat mengakses proyek ini lagi sampai ditambahkan kembali. Penugasan Anda di proyek ini dilepas."
            : "Penugasannya di proyek ini akan dilepas. Komentar dan catatan waktunya tetap tersimpan."
        }
        confirmLabel={self ? "Keluar" : "Keluarkan"}
        pending={pending}
        onConfirm={() => void run({ projectId, userId })}
      />
    </>
  );
}
