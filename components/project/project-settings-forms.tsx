"use client";

import { useState } from "react";
import { deleteProjectAction } from "@/app/actions/project/delete-project";
import { setProjectStatusAction, updateProjectAction } from "@/app/actions/project/update-project";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { updateProjectSchema } from "@/schemas/project.schema";
import type { Project } from "@/types/project";
import { ProjectFormFields } from "./project-form-fields";

export function ProjectDetailsForm({ project, disabled }: { project: Project; disabled: boolean }) {
  const { run, pending, fieldErrors } = useAction(updateProjectAction, {
    schema: updateProjectSchema,
    successMessage: "Perubahan proyek disimpan.",
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("projectId", project.id);
        void run(fd);
      }}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <ProjectFormFields initial={project} errors={fieldErrors} />
        <label className="flex items-start gap-2.5 text-[13px]">
          <input
            type="checkbox"
            name="allowViewerComments"
            defaultChecked={project.allowViewerComments}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Pengamat boleh berkomentar</span>
            <span className="block text-xs text-muted">Jika tidak dicentang, pengamat hanya dapat melihat.</span>
          </span>
        </label>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={pending}>
            Simpan perubahan
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ArchiveControl({ project }: { project: Project }) {
  const archived = project.status === "ARCHIVED";
  const { run, pending } = useAction(setProjectStatusAction, {
    successMessage: archived ? "Proyek diaktifkan kembali." : "Proyek diarsipkan.",
  });
  return (
    <Button variant="outline" loading={pending} onClick={() => void run({ projectId: project.id, status: archived ? "ACTIVE" : "ARCHIVED" })}>
      {archived ? "Aktifkan kembali" : "Arsipkan"}
    </Button>
  );
}

export function DeleteProjectControl({ project, taskCount }: { project: Project; taskCount: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(deleteProjectAction);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Hapus proyek
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Hapus ${project.name}?`}
        description={`Semua modul, sub modul, ${taskCount} tugas, komentar, catatan waktu, dan aktivitas akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus permanen"
        confirmText={project.key}
        pending={pending}
        onConfirm={() => void run({ projectId: project.id, confirmKey: project.key })}
      />
    </>
  );
}
