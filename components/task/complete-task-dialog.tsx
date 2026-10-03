"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { completeTaskAction } from "@/app/actions/task/move-task";
import { uploadFile } from "@/components/uploads/upload-file";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { TaskDetail } from "@/types/task-detail";

/** Completion flow: optional notes plus optional proof files, then mark done. */
export function CompleteTaskDialog({
  open,
  onOpenChange,
  detail,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TaskDetail;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function submit(notes: string) {
    startTransition(async () => {
      // Upload proof first so a failed upload doesn't leave a "done" task without it.
      for (const file of files) {
        if (!detail.uploadMode) break;
        const up = await uploadFile(detail.uploadMode, { kind: "proof", taskId: detail.task.id }, file, `attachments/${detail.project.id}/${detail.task.id}`);
        if (!up.ok) {
          toast.error(`Gagal mengunggah ${file.name}: ${up.error}`);
          return;
        }
      }
      const result = await completeTaskAction({ taskId: detail.task.id, completionNotes: notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tugas ditandai selesai.");
      setFiles([]);
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Selesaikan ${detail.ref}`}
      description="Tambahkan catatan dan bukti pekerjaan jika perlu. Keduanya opsional."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="primary" type="submit" form="complete-task-form" loading={pending}>
            Tandai selesai
          </Button>
        </>
      }
    >
      <form
        id="complete-task-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const notes = new FormData(e.currentTarget).get("completionNotes");
          submit(typeof notes === "string" ? notes : "");
        }}
      >
        <Textarea
          name="completionNotes"
          defaultValue={detail.task.completionNotes}
          rows={4}
          maxLength={4000}
          placeholder="Contoh: sudah dirilis di versi 2.3, lihat PR #142."
          aria-label="Catatan penyelesaian"
        />
        {detail.uploadMode ? (
          <div>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...picked].slice(0, 5));
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" aria-hidden /> Lampirkan bukti
            </Button>
            {files.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-subtle">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-subtle hover:text-fg"
                      aria-label={`Hapus ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-subtle">Unggah bukti belum tersedia karena penyimpanan berkas belum dikonfigurasi.</p>
        )}
      </form>
    </Dialog>
  );
}
