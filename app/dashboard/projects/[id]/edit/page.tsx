import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { updateProject } from "@/app/actions/project";
import DeleteProjectButton from "./DeleteProjectButton";
import { deleteProject } from "@/app/actions/project";

export default async function EditProjectPage({
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
  });

  if (!project) {
    redirect("/dashboard");
  }

  const formattedStartDate = project.start_date
    ? new Date(project.start_date).toISOString().split("T")[0]
    : "";

  const formattedDeadline = project.deadline
    ? new Date(project.deadline).toISOString().split("T")[0]
    : "";

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            &larr; Batal
          </Link>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">
            Pengaturan Proyek
          </h2>
        </div>

        <form
          action={updateProject}
          className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <input type="hidden" name="id" value={project.id} />

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nama Proyek
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={project.name}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Deskripsi Proyek
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={project.description || ""}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status Proyek
            </label>
            <select
              id="status"
              name="status"
              defaultValue={project.status}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            >
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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
                defaultValue={formattedStartDate}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
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
                defaultValue={formattedDeadline}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-zinc-800">
            <form action={deleteProject}>
              <input type="hidden" name="id" value={project.id} />
              <DeleteProjectButton />
            </form>

            <button
              type="submit"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
