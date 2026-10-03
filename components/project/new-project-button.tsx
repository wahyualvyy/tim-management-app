"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./new-project-dialog";

export function NewProjectButton({ label = "Proyek baru" }: { label?: string }) {
  return (
    <NewProjectDialog
      trigger={(open) => (
        <Button variant="primary" onClick={open}>
          <Plus className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      )}
    />
  );
}
