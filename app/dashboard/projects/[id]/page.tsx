import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function ProjectDetailPage({
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
      members: { include: { user: true } },
      tasks: { include: { assignee: true }, orderBy: { created_at: "desc" } },
      activityLogs: {
        include: { user: true },
        orderBy: { created_at: "desc" },
        take: 10,
      },
    },
  });

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Proyek tidak ditemukan</h1>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-400 hover:underline"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isMember = project.members.some((m) => m.user_id === session.user.id);

  if (!isMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Akses Ditolak</h1>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-400 hover:underline"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black/50 px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white"
            >
              &larr; Dashboard
            </Link>
            <h1 className="text-xl font-semibold">{project.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Daftar Task</h2>
              <Link
                href={`/dashboard/projects/${project.id}/tasks/new`}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
              >
                + Tambah Task
              </Link>
            </div>

            <div className="space-y-4">
              {project.tasks.map((task) => (
                <Link
                  href={`/dashboard/projects/${project.id}/tasks/${task.id}`}
                  key={task.id}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 hover:bg-zinc-800"
                >
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <p className="text-sm text-zinc-400">
                    {task.description || "Tanpa deskripsi"}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="mb-4 font-semibold text-white">Log Aktivitas</h3>
              <div className="space-y-4">
                {project.activityLogs.map((log) => (
                  <div key={log.id} className="border-l-2 border-zinc-700 pl-3">
                    <p className="text-xs text-zinc-300">{log.action}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
