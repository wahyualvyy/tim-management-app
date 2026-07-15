import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { addProjectMember } from "@/app/actions/member";
import Board from "./Board";

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

  const currentUserRole = project.members.find(
    (m) => m.user_id === session.user.id,
  )?.role;
  const isMember = !!currentUserRole;

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
      <header className="border-b border-zinc-800 bg-black/50 px-8 py-4 sticky top-0 backdrop-blur-md z-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white"
            >
              &larr; Dashboard
            </Link>
            <span className="text-zinc-700">/</span>
            <h1 className="text-xl font-semibold tracking-tight">
              {project.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {currentUserRole === "LEAD" && (
              <Link
                href={`/dashboard/projects/${project.id}/edit`}
                className="rounded-md border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Pengaturan
              </Link>
            )}
            <Link
              href={`/dashboard/projects/${project.id}/tasks/new`}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
            >
              + Tambah Task
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-8">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <Board initialTasks={project.tasks} projectId={project.id} />
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="text-sm font-medium text-zinc-500 mb-2">
                Deskripsi Proyek
              </h3>
              <p className="text-sm text-zinc-300">
                {project.description || "Tidak ada deskripsi."}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="mb-4 font-semibold text-white">Undang Anggota</h3>
              <form action={addProjectMember} className="space-y-3">
                <input type="hidden" name="project_id" value={project.id} />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="Masukkan email tim..."
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                />
                <select
                  name="role"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                >
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="w-full rounded-md bg-white py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
                >
                  Tambah
                </button>
              </form>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="mb-4 font-semibold text-white">Log Aktivitas</h3>
              <div className="space-y-4">
                {project.activityLogs.length > 0 ? (
                  project.activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border-l-2 border-zinc-700 pl-3"
                    >
                      <p className="text-xs text-zinc-300">{log.action}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {log.user.name} •{" "}
                        {new Date(log.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500">Belum ada aktivitas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
