"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { createVerificationLinkAction, setAccountStatusAction, setGlobalRoleAction } from "@/app/actions/admin/admin-actions";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { ACCOUNT_STATUS_LABEL, GLOBAL_ROLE_LABEL } from "@/lib/labels";
import { ACCOUNT_STATUSES, GLOBAL_ROLES, type AccountStatus, type GlobalRole } from "@/types/user";

export function AdminUserControls({
  userId,
  name,
  status,
  role,
  self,
}: {
  userId: string;
  name: string;
  status: AccountStatus;
  role: GlobalRole;
  self: boolean;
}) {
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const setStatus = useAction(setAccountStatusAction, { successMessage: "Status akun diperbarui.", onSuccess: () => setConfirmSuspend(false) });
  const setRole = useAction(setGlobalRoleAction, { successMessage: "Peran sistem diperbarui." });
  const verify = useAction(createVerificationLinkAction, { onSuccess: ({ url }) => setLink(url) });

  if (self) return <span className="text-xs text-subtle">Akun Anda</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <Select
          value={status}
          disabled={setStatus.pending}
          aria-label={`Status akun ${name}`}
          onChange={(e) => {
            const next = e.target.value as AccountStatus;
            if (next === "SUSPENDED") setConfirmSuspend(true);
            else void setStatus.run({ userId, status: next });
          }}
        >
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACCOUNT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-32">
        <Select value={role} disabled={setRole.pending} aria-label={`Peran sistem ${name}`} onChange={(e) => void setRole.run({ userId, role: e.target.value })}>
          {GLOBAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {GLOBAL_ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
      {status === "UNVERIFIED" ? (
        <Button size="sm" variant="ghost" loading={verify.pending} onClick={() => void verify.run({ userId })}>
          <Link2 className="h-3.5 w-3.5" aria-hidden /> Tautan verifikasi
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title={`Tangguhkan ${name}?`}
        description="Pengguna tidak dapat masuk atau melakukan perubahan sampai statusnya dipulihkan. Datanya tetap tersimpan."
        confirmLabel="Tangguhkan"
        pending={setStatus.pending}
        onConfirm={() => void setStatus.run({ userId, status: "SUSPENDED" })}
      />
      <Dialog
        open={link !== null}
        onOpenChange={(open) => (open ? undefined : setLink(null))}
        title="Tautan verifikasi"
        description="Kirimkan tautan ini kepada pengguna. Berlaku 24 jam dan hanya bisa dipakai sekali."
        footer={
          <Button
            variant="primary"
            onClick={() => {
              if (link) void navigator.clipboard.writeText(link);
              setLink(null);
            }}
          >
            Salin & tutup
          </Button>
        }
      >
        <code className="block break-all rounded-md bg-surface-2 p-3 text-xs">{link}</code>
      </Dialog>
    </div>
  );
}
