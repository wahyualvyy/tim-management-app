"use client";

export default function DeleteProjectButton() {
  return (
    <button
      type="submit"
      className="rounded-md border border-red-900/50 bg-red-950/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30 transition-colors"
      onClick={(e) => {
        if (
          !window.confirm(
            "PERINGATAN: Menghapus proyek akan menghapus semua tugas, log, dan diskusi di dalamnya. Lanjutkan?",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Hapus Proyek
    </button>
  );
}
