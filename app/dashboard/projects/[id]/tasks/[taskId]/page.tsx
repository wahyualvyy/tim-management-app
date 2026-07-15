import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { deleteTask } from "@/app/actions/task";
import { addComment } from "@/app/actions/comment";
import DeleteTaskButton from "./DeleteTaskButton";
import TaskTimeTracker from "./TaskTimeTracker";
import CompleteTaskForm from "./CompleteTaskForm";

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
      time_logs: {
        include: {
          user: true,
        },
        orderBy: {
          created_at: "desc",
        },
      },
      comments: {
        include: {
          user: true,
        },
        orderBy: {
          created_at: "asc",
        },
      },
    },
  });

  if (!task || task.project_id !== resolvedParams.id) {
    redirect(`/dashboard/projects/${resolvedParams.id}`);
  }

  const isAssignee = task.assigned_to === session.user.id;

  const totalSeconds = task.time_logs.reduce(
    (sum, log) => sum + log.duration,
    0,
  );

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}j ${m}m`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-300 dark:bg-black dark:text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-8 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            href={`/dashboard/projects/${resolvedParams.id}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            &larr; {task.project.name}
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <h1 className="text-xl font-semibold tracking-tight">Detail Task</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {task.title}
                </h2>
                <span
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    task.priority === "HIGH"
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
                      : task.priority === "MEDIUM"
                        ? "border-yellow-200 bg-yellow-50 text-yellow-600 dark:border-yellow-900/50 dark:bg-yellow-950/50 dark:text-yellow-400"
                        : "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-400"
                  }`}
                >
                  {task.priority}
                </span>
              </div>
              <div className="mt-4 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
                {task.description || "Tidak ada deskripsi."}
              </div>
            </div>

            {task.status === "DONE" && (task.notes || task.proof_image) && (
              <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Laporan Pengerjaan Selesai
                </h4>
                {task.notes && (
                  <div className="whitespace-pre-line rounded-md border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-700 shadow-sm dark:border-zinc-800/60 dark:bg-black/40 dark:text-zinc-300">
                    "{task.notes}"
                  </div>
                )}
                {task.proof_image && (
                  <div className="max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
                    <img
                      src={task.proof_image}
                      alt="Foto Bukti"
                      className="max-h-64 w-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                Diskusi Task
              </h3>
              <div className="mb-6 space-y-4">
                {task.comments.length > 0 ? (
                  task.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4">
                      {comment.user.image ? (
                        <img
                          src={comment.user.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="mt-1 h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="mt-1 h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      )}
                      <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800/60 dark:bg-black/50">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            {comment.user.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {new Date(comment.created_at).toLocaleString(
                              "id-ID",
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-400">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-zinc-300 py-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
                    Belum ada diskusi. Jadilah yang pertama berkomentar!
                  </p>
                )}
              </div>

              <form action={addComment} className="flex gap-3">
                <input type="hidden" name="task_id" value={task.id} />
                <input
                  type="hidden"
                  name="project_id"
                  value={task.project_id}
                />
                <input
                  type="text"
                  name="content"
                  required
                  placeholder="Tulis komentar Anda di sini..."
                  className="flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white dark:focus:ring-white"
                />
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  Kirim
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {isAssignee ? (
              <>
                {task.status !== "DONE" && (
                  <TaskTimeTracker
                    taskId={task.id}
                    initialLogs={task.time_logs}
                  />
                )}
                {task.status !== "DONE" && (
                  <CompleteTaskForm
                    taskId={task.id}
                    projectId={task.project_id}
                  />
                )}
              </>
            ) : (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-900/10 dark:text-yellow-500">
                <span className="font-semibold block mb-1">Akses Terbatas</span>
                Hanya <b>
                  {task.assignee?.name || "orang yang ditugaskan"}
                </b>{" "}
                yang dapat memulai pelacak waktu dan mengunggah bukti
                pengerjaan.
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
                Rekap Waktu Kerja
              </h3>
              <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <span className="text-xs text-zinc-500">Total Pengerjaan</span>
                <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                  {formatDuration(totalSeconds)}
                </span>
              </div>
              <div className="space-y-3">
                {task.time_logs.length > 0 ? (
                  task.time_logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {log.user.image ? (
                          <img
                            src={log.user.image}
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        )}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {log.user.name}
                        </span>
                      </div>
                      <span className="tabular-nums font-semibold text-zinc-500">
                        {formatDuration(log.duration)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 text-center italic">
                    Belum ada waktu tercatat.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/projects/${resolvedParams.id}/tasks/${task.id}/edit`}
                className="flex-1 rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                Edit Detail
              </Link>
              <form action={deleteTask} className="flex-1">
                <input type="hidden" name="task_id" value={task.id} />
                <input
                  type="hidden"
                  name="project_id"
                  value={task.project_id}
                />
                <DeleteTaskButton />
              </form>
            </div>

            <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div>
                <span className="block text-xs font-medium text-zinc-500">
                  Tenggat Waktu
                </span>
                <span className="mt-1 block text-sm font-medium text-zinc-900 dark:text-zinc-300">
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </span>
              </div>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800/60">
                <span className="mb-2 block text-xs font-medium text-zinc-500">
                  Ditugaskan Kepada
                </span>
                <div className="flex items-center gap-3">
                  {task.assignee?.image ? (
                    <img
                      src={task.assignee.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-300">
                    {task.assignee?.name || "Belum ditugaskan"}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800/60">
                <span className="mb-2 block text-xs font-medium text-zinc-500">
                  Dibuat Oleh
                </span>
                <div className="flex items-center gap-3">
                  {task.creator?.image ? (
                    <img
                      src={task.creator.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-300">
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
