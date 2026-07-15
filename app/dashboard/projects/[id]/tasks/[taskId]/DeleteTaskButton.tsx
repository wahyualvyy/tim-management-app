"use client";

export default function DeleteTaskButton() {
  return (
    <button
      type="submit"
      className="w-full rounded-md border border-red-900/50 bg-red-950/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40 transition-colors"
      onClick={(e) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus task ini?")) {
          e.preventDefault();
        }
      }}
    >
      Hapus Task
    </button>
  );
}
