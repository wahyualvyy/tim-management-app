"use client";

import { useState } from "react";
import { completeTask } from "@/app/actions/task";

export default function CompleteTaskForm({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const [notes, setNotes] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      alert(
        "Wajib mengunggah foto bukti pengerjaan sebelum menyelesaikan task!",
      );
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("project_id", projectId);
    formData.append("notes", notes);
    formData.append("proof_image", imagePreview); 

    await completeTask(formData);
    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 text-white"
    >
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Selesaikan Tugas
        </h4>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Berikan laporan hasil pengerjaan akhir Anda.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="notes"
          className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
        >
          Catatan Hasil Kerja
        </label>
        <textarea
          id="notes"
          rows={3}
          required
          placeholder="Tuliskan kendala, hasil akhir, atau tautan penting pengerjaan di sini..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-white focus:border-zinc-700 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
          Foto Bukti Pengerjaan
        </label>

        {imagePreview && (
          <div className="relative w-full h-40 rounded-lg border border-zinc-800 overflow-hidden bg-black/40 flex items-center justify-center">
            <img
              src={imagePreview}
              alt="Bukti kerja"
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white h-6 w-6 rounded-full text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        )}

        {!imagePreview && (
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-800 rounded-lg cursor-pointer bg-black/20 hover:bg-black/40 transition-colors">
            <div className="flex flex-col items-center justify-center pt-3 pb-3">
              <svg
                className="w-6 h-6 text-zinc-500 mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-[10px] text-zinc-400 font-medium">
                Klik untuk Unggah Gambar
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
              required
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {loading ? "Memproses..." : "✔ Tandai Sebagai Selesai"}
      </button>
    </form>
  );
}
