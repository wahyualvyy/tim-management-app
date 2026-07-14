import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createProject } from "@/app/actions/project";

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white"
          >
            &larr; Kembali ke Dashboard
          </Link>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">
            Buat Proyek Baru
          </h2>
        </div>

        <form
          action={createProject}
          className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nama Proyek
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="Misal: Pengembangan App CircularFlow"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Deskripsi
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="start_date" className="text-sm font-medium">
                Tanggal Mulai
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="deadline" className="text-sm font-medium">
                Tenggat Waktu
              </label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Batal
            </Link>
            <button
              type="submit"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
            >
              Simpan Proyek
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
