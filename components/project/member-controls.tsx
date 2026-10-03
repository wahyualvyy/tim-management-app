"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { addMemberAction, changeMemberRoleAction, removeMemberAction } from "@/app/actions/member/member-actions";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { ProjectRole } from "@/types/project";


export function AddMemberForm({ projectId, roles }: { projectId: string; roles: ProjectRole[] }) {
  const [formKey, setFormKey] = useState(0);
  const { run, pending, fieldErrors } = useAction(addMemberAction, {
    successMessage: "Member added",
    onSuccess: () => setFormKey((k) => k + 1),
  });
  return (
    <form
      key={formKey}
      className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("projectId", projectId);
        void run(fd);
      }}
    >
      <Field label="Email" htmlFor="member-email" error={fieldErrors.email} hint="They need to have signed in to Tim once.">
        <Input id="member-email" name="email" type="email" required placeholder="teammate@company.com" />
      </Field>
      <Field label="Role" htmlFor="member-role" error={fieldErrors.role}>
        <Select id="member-role" name="role" defaultValue="MEMBER">
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary" loading={pending} className="sm:mb-[22px]">
        <UserPlus className="h-4 w-4" aria-hidden />
        Add
      </Button>
    </form>
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
  const { run, pending } = useAction(changeMemberRoleAction, { successMessage: "Role updated" });
  return (
    <div className="w-32">
      <Select
        value={role}
        disabled={pending}
        onChange={(e) => void run({ projectId, userId, role: e.target.value })}
        aria-label="Role"
      >
        {[role, ...roles.filter((r) => r !== role)].map((r) => (
          <option key={r} value={r}>
            {r.charAt(0) + r.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function RemoveMemberButton({
  projectId,
  userId,
  name,
  self,
}: {
  projectId: string;
  userId: string;
  name: string;
  self: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, pending } = useAction(removeMemberAction, {
    successMessage: self ? "You left the project" : "Member removed",
    onSuccess: () => {
      setOpen(false);
      if (self) router.push("/projects");
    },
  });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {self ? "Leave" : "Remove"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={self ? "Leave this project?" : `Remove ${name}?`}
        description={
          self
            ? "You'll lose access until someone adds you again. Your tasks here become unassigned."
            : "Their tasks in this project become unassigned. Their comments and time entries stay."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} onClick={() => void run({ projectId, userId })}>
              {self ? "Leave project" : "Remove member"}
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </>
  );
}
