import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { updateTaskStatus } from "@/app/actions/task";

export default async function TaskDetailPage({
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
      project: true,
      assignee: true,
      creator: true,
    },
  });

  if (!task || task.project_id !== resolvedParams.id) {
    redirect(`/dashboard/projects/${resolvedParams.id}`);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black/50 px-8 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link
            href={`/dashboard/projects/${resolvedParams.id}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            &larr; {task.project.name}
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="text-xl font-semibold tracking-tight">Detail Task</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-2xl font-bold text-white">{task.title}</h2>
              <div className="mt-4 prose prose-invert max-w-none text-sm text-zinc-300">
                {task.description ? (
                  <p className="whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-zinc-500 italic">Tidak ada deskripsi.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Ubah Status
              </h3>
              <form
                action={updateTaskStatus}
                className="flex items-center gap-4"
              >
                <input type="hidden" name="task_id" value={task.id} />
                <input
                  type="hidden"
                  name="project_id"
                  value={task.project_id}
                />
                <select
                  name="status"
                  defaultValue={task.status}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">Review</option>
                  <option value="DONE">Done</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
                >
                  Simpan Status
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
              <div>
                <span className="block text-xs font-medium text-zinc-500">
                  Prioritas
                </span>
                <span
                  className={`mt-1 inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                    task.priority === "HIGH"
                      ? "bg-red-900/30 text-red-400"
                      : task.priority === "MEDIUM"
                        ? "bg-yellow-900/30 text-yellow-400"
                        : "bg-green-900/30 text-green-400"
                  }`}
                >
                  {task.priority}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-500">
                  Tenggat Waktu
                </span>
                <span className="mt-1 block text-sm text-zinc-300">
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString("id-ID")
                    : "-"}
                </span>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <span className="block text-xs font-medium text-zinc-500 mb-2">
                  Ditugaskan Kepada
                </span>
                <div className="flex items-center gap-3">
                  {task.assignee?.image ? (
                    <img
                      src={task.assignee.image}
                      alt=""
                      className="h-8 w-8 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800" />
                  )}
                  <span className="text-sm font-medium text-zinc-300">
                    {task.assignee?.name || "Belum ditugaskan"}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <span className="block text-xs font-medium text-zinc-500 mb-2">
                  Dibuat Oleh
                </span>
                <div className="flex items-center gap-3">
                  {task.creator?.image ? (
                    <img
                      src={task.creator.image}
                      alt=""
                      className="h-8 w-8 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800" />
                  )}
                  <span className="text-sm font-medium text-zinc-300">
                    {task.creator?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
