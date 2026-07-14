import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { createTask } from "@/app/actions/task";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  if (!project) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            &larr; Kembali ke Proyek
          </Link>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">
            Tambah Task Baru
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Proyek: {project.name}</p>
        </div>

        <form
          action={createTask}
          className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <input type="hidden" name="project_id" value={project.id} />

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Judul Task
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
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
              <label htmlFor="assigned_to" className="text-sm font-medium">
                Tugaskan Kepada
              </label>
              <select
                id="assigned_to"
                name="assigned_to"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="">-- Pilih Anggota --</option>
                {project.members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">
                Prioritas
              </label>
              <select
                id="priority"
                name="priority"
                defaultValue="MEDIUM"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
              </select>
            </div>
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

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Batal
            </Link>
            <button
              type="submit"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
            >
              Simpan Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
