import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { updateTask } from "@/app/actions/task";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.taskId },
    include: {
      project: {
        include: {
          members: { include: { user: true } },
        },
      },
    },
  });

  if (!task || task.project_id !== resolvedParams.id) {
    redirect(`/dashboard/projects/${resolvedParams.id}`);
  }

  const formattedDeadline = task.deadline
    ? new Date(task.deadline).toISOString().split("T")[0]
    : "";

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href={`/dashboard/projects/${resolvedParams.id}/tasks/${task.id}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            &larr; Batal
          </Link>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">Edit Task</h2>
        </div>

        <form
          action={updateTask}
          className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="project_id" value={task.project_id} />

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Judul Task
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={task.title}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
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
              defaultValue={task.description || ""}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
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
                defaultValue={task.assigned_to || ""}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              >
                <option value="">-- Pilih Anggota --</option>
                {task.project.members.map((member) => (
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
                defaultValue={task.priority}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
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
              defaultValue={formattedDeadline}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
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
