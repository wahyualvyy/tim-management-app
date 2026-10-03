"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createModuleAction,
  deleteModuleAction,
  reorderModulesAction,
  updateModuleAction,
} from "@/app/actions/module/module-actions";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { MODULE_STATUSES, type Module } from "@/types/module";
import type { FieldErrors } from "@/types/action";
import { MODULE_STATUS_LABEL } from "@/lib/labels";


type Owner = { id: string; name: string };

function ModuleFields({ initial, owners, errors }: { initial?: Module; owners: Owner[]; errors: FieldErrors }) {
  return (
    <div className="space-y-4">
      <Field label="Name" htmlFor="module-name" error={errors.name}>
        <Input id="module-name" name="name" defaultValue={initial?.name} required maxLength={80} autoFocus placeholder="Authentication" />
      </Field>
      <Field label="Description" htmlFor="module-description" error={errors.description}>
        <Textarea id="module-description" name="description" defaultValue={initial?.description} rows={3} maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="module-status">
          <Select id="module-status" name="status" defaultValue={initial?.status ?? "PLANNED"}>
            {MODULE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MODULE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner" htmlFor="module-owner" error={errors.ownerId}>
          <Select id="module-owner" name="ownerId" defaultValue={initial?.ownerId ?? ""}>
            <option value="">No owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

export function NewModuleButton({ projectId, owners }: { projectId: string; owners: Owner[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(createModuleAction, {
    successMessage: "Module created",
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        New module
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New module"
        description="Modules group related tasks, like a feature or a workstream."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="new-module-form" loading={pending}>
              Create module
            </Button>
          </>
        }
      >
        <form
          id="new-module-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("projectId", projectId);
            void run(fd);
          }}
        >
          {open ? <ModuleFields owners={owners} errors={fieldErrors} /> : null}
        </form>
      </Dialog>
    </>
  );
}

export function ModuleActions({
  module: mod,
  owners,
  orderedIds,
}: {
  module: Module;
  owners: Owner[];
  orderedIds: string[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const update = useAction(updateModuleAction, { successMessage: "Module updated", onSuccess: () => setEditOpen(false) });
  const remove = useAction(deleteModuleAction, { successMessage: "Module deleted", onSuccess: () => setDeleteOpen(false) });
  const reorder = useAction(reorderModulesAction);
  const index = orderedIds.indexOf(mod.id);

  function move(delta: number) {
    const next = [...orderedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    void reorder.run({ projectId: mod.projectId, moduleIds: next });
  }

  return (
    // Rendered inside a <summary>: keep clicks from toggling the section.
    // React events bubble out of portals, so only stop clicks physically inside this element.
    <span
      onClick={(e) => {
        if (e.currentTarget.contains(e.target as Node)) e.preventDefault();
      }}
      className="contents"
    >
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${mod.name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 text-muted" aria-hidden /> Edit
          </MenuItem>
          <MenuItem onSelect={() => move(-1)} disabled={index <= 0}>
            <ArrowUp className="h-4 w-4 text-muted" aria-hidden /> Move up
          </MenuItem>
          <MenuItem onSelect={() => move(1)} disabled={index === orderedIds.length - 1}>
            <ArrowDown className="h-4 w-4 text-muted" aria-hidden /> Move down
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit module"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={`edit-module-${mod.id}`} loading={update.pending}>
              Save
            </Button>
          </>
        }
      >
        <form
          id={`edit-module-${mod.id}`}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("moduleId", mod.id);
            void update.run(fd);
          }}
        >
          {editOpen ? <ModuleFields initial={mod} owners={owners} errors={update.fieldErrors} /> : null}
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${mod.name}?`}
        description="Only empty modules can be deleted. Move or delete its tasks first."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.pending} onClick={() => void remove.run({ moduleId: mod.id })}>
              Delete module
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This can&apos;t be undone.</p>
      </Dialog>
    </span>
  );
}
