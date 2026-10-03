"use client";

import { useState } from "react";
import { archiveProjectAction, restoreProjectAction } from "@/app/actions/project/archive-project";
import { deleteProjectAction } from "@/app/actions/project/delete-project";
import { updateProjectAction } from "@/app/actions/project/update-project";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Project } from "@/types/project";
import { ProjectFormFields } from "./project-form-fields";

export function ProjectDetailsForm({ project, disabled }: { project: Project; disabled: boolean }) {
  const { run, pending, fieldErrors } = useAction(updateProjectAction, { successMessage: "Project saved" });
  return (
    <form
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
            <span className="font-medium">Viewers can comment</span>
            <span className="block text-xs text-muted">Otherwise viewers have read-only access to tasks.</span>
          </span>
        </label>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={pending}>
            Save changes
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ArchiveControl({ project }: { project: Project }) {
  const archive = useAction(archiveProjectAction, { successMessage: "Project archived" });
  const restore = useAction(restoreProjectAction, { successMessage: "Project restored" });
  return project.archived ? (
    <Button variant="outline" loading={restore.pending} onClick={() => void restore.run({ projectId: project.id })}>
      Restore project
    </Button>
  ) : (
    <Button variant="outline" loading={archive.pending} onClick={() => void archive.run({ projectId: project.id })}>
      Archive project
    </Button>
  );
}

export function DeleteProjectControl({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const { run, pending } = useAction(deleteProjectAction);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete project
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          setConfirmKey("");
        }}
        title={`Delete ${project.name}?`}
        description="All modules, tasks, comments, time entries and activity are permanently deleted."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirmKey.toUpperCase() !== project.key}
              onClick={() => void run({ projectId: project.id, confirmKey })}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <label htmlFor="confirm-key" className="mb-1.5 block text-[13px]">
          Type <span className="font-mono font-semibold">{project.key}</span> to confirm.
        </label>
        <Input
          id="confirm-key"
          value={confirmKey}
          onChange={(e) => setConfirmKey(e.target.value)}
          autoComplete="off"
          className="font-mono uppercase"
        />
      </Dialog>
    </>
  );
}
