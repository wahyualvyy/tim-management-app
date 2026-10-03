"use client";

import { createModuleAction, deleteModuleAction, updateModuleAction } from "@/app/actions/module/module-actions";
import {
  createSubModuleAction,
  deleteSubModuleAction,
  updateSubModuleAction,
} from "@/app/actions/module/submodule-actions";
import { useState } from "react";
import { useAction } from "@/components/hooks/use-action";
import { MemberSelect } from "@/components/people/person-pickers";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { STRUCTURE_STATUS_LABEL } from "@/lib/labels";
import { STRUCTURE_STATUSES, type Module, type SubModule } from "@/types/module";
import type { PersonOption } from "@/types/views";

export type StructureTarget =
  | { mode: "create-module"; projectId: string }
  | { mode: "edit-module"; module: Module }
  | { mode: "create-submodule"; module: Pick<Module, "id" | "name" | "projectId"> }
  | { mode: "edit-submodule"; subModule: SubModule };

const TITLES: Record<StructureTarget["mode"], string> = {
  "create-module": "Modul baru",
  "edit-module": "Ubah modul",
  "create-submodule": "Sub modul baru",
  "edit-submodule": "Ubah sub modul",
};

/** One dialog for creating and editing modules and sub modules. */
export function StructureDialog({
  target,
  onClose,
  leadsById,
}: {
  target: StructureTarget | null;
  onClose: () => void;
  leadsById: Map<string, PersonOption>;
}) {
  const onSuccess = () => onClose();
  const createModule = useAction(createModuleAction, { successMessage: "Modul berhasil dibuat.", onSuccess });
  const updateModule = useAction(updateModuleAction, { successMessage: "Modul diperbarui.", onSuccess });
  const createSub = useAction(createSubModuleAction, { successMessage: "Sub modul berhasil dibuat.", onSuccess });
  const updateSub = useAction(updateSubModuleAction, { successMessage: "Sub modul diperbarui.", onSuccess });

  const current =
    target?.mode === "edit-module" ? target.module : target?.mode === "edit-submodule" ? target.subModule : null;
  const active =
    target?.mode === "create-module"
      ? createModule
      : target?.mode === "edit-module"
        ? updateModule
        : target?.mode === "create-submodule"
          ? createSub
          : updateSub;
  const errors = active.fieldErrors;

  function submit(fd: FormData) {
    if (!target) return;
    if (target.mode === "create-module") fd.set("projectId", target.projectId);
    if (target.mode === "edit-module") fd.set("moduleId", target.module.id);
    if (target.mode === "create-submodule") fd.set("moduleId", target.module.id);
    if (target.mode === "edit-submodule") fd.set("subModuleId", target.subModule.id);
    void active.run(fd);
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={target ? TITLES[target.mode] : ""}
      description={target?.mode === "create-submodule" ? `Di dalam modul ${target.module.name}.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" type="submit" form="structure-form" loading={active.pending}>
            Simpan
          </Button>
        </>
      }
    >
      {target ? (
        <form
          id="structure-form"
          key={`${target.mode}-${current?.id ?? ""}`}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <Field label="Nama" htmlFor="structure-name" error={errors.name}>
            <Input
              id="structure-name"
              name="name"
              defaultValue={current?.name}
              required
              maxLength={80}
              autoFocus
              placeholder={target.mode.includes("submodule") ? "Landing Page" : "Frontend"}
            />
          </Field>
          <Field label="Deskripsi" htmlFor="structure-description" error={errors.description}>
            <Textarea id="structure-description" name="description" defaultValue={current?.description} rows={3} maxLength={1000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="structure-status">
              <Select id="structure-status" name="status" defaultValue={current?.status ?? "PLANNED"}>
                {STRUCTURE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STRUCTURE_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Penanggung jawab" htmlFor="structure-lead" error={errors.leadId}>
              <LeadField projectId={projectIdOf(target)} initial={current?.leadId ? (leadsById.get(current.leadId) ?? null) : null} />
            </Field>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

function projectIdOf(target: StructureTarget): string {
  switch (target.mode) {
    case "create-module":
      return target.projectId;
    case "edit-module":
    case "create-submodule":
      return target.module.projectId;
    case "edit-submodule":
      return target.subModule.projectId;
  }
}

/** Searchable lead picker; submits the chosen id as `leadId` (empty = none). */
function LeadField({ projectId, initial }: { projectId: string; initial: PersonOption | null }) {
  const [lead, setLead] = useState(initial);
  return (
    <>
      <input type="hidden" name="leadId" value={lead?.id ?? ""} />
      <MemberSelect id="structure-lead" projectId={projectId} value={lead} onChange={setLead} placeholder="Tidak ada" noneLabel="Hapus penanggung jawab" />
    </>
  );
}

export type DeleteTarget =
  | { kind: "module"; id: string; name: string; subModules: number; tasks: number }
  | { kind: "submodule"; id: string; name: string; tasks: number };

export function DeleteStructureDialog({ target, onClose }: { target: DeleteTarget | null; onClose: () => void }) {
  const shown = target;
  const deleteModule = useAction(deleteModuleAction, { successMessage: "Modul dihapus.", onSuccess: onClose });
  const deleteSub = useAction(deleteSubModuleAction, { successMessage: "Sub modul dihapus.", onSuccess: onClose });
  const pending = deleteModule.pending || deleteSub.pending;

  const description = !shown
    ? ""
    : shown.kind === "module"
      ? `${shown.subModules} sub modul dan ${shown.tasks} tugas di dalamnya (beserta komentar dan catatan waktunya) ikut terhapus.`
      : `${shown.tasks} tugas di dalamnya (beserta komentar dan catatan waktunya) ikut terhapus.`;

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={shown ? `Hapus ${shown.kind === "module" ? "modul" : "sub modul"} ${shown.name}?` : ""}
      description={description}
      confirmLabel="Hapus"
      confirmText={shown && shown.tasks > 0 ? shown.name : undefined}
      pending={pending}
      onConfirm={() => {
        if (!target) return;
        if (target.kind === "module") void deleteModule.run({ moduleId: target.id });
        else void deleteSub.run({ subModuleId: target.id });
      }}
    />
  );
}
