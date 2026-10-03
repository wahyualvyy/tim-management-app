"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/app/actions/project/create-project";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProjectFormFields } from "./project-form-fields";

/** Renders its trigger and owns the "new project" dialog. */
export function NewProjectDialog({ trigger }: { trigger: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const { run, pending, fieldErrors } = useAction(createProjectAction, {
    successMessage: "Project created",
    onSuccess: ({ projectId }) => {
      setOpen(false);
      router.push(`/projects/${projectId}`);
    },
  });

  return (
    <>
      {trigger(() => {
        setFormKey((k) => k + 1);
        setOpen(true);
      })}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New project"
        description="Projects hold modules, and modules hold tasks."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="new-project-form" loading={pending}>
              Create project
            </Button>
          </>
        }
      >
        <form
          id="new-project-form"
          key={formKey}
          onSubmit={(e) => {
            e.preventDefault();
            void run(new FormData(e.currentTarget));
          }}
        >
          <ProjectFormFields errors={fieldErrors} />
        </form>
      </Dialog>
    </>
  );
}
