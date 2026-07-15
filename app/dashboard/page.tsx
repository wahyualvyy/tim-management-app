import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          user_id: session.user.id,
        },
      },
    },
    include: {
      tasks: true,
      members: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  const totalTasksAssigned = await prisma.task.count({
    where: {
      assigned_to: session.user.id,
      status: { not: "DONE" },
    },
  });

  const totalProjects = projects.length;

  return (
    <div className="text-white">
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Pantau perkembangan proyek dan tugas tim Anda di sini.
            </p>
          </div>
          <div>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
            >
              + Proyek Baru
            </Link>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5">
            <span className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Proyek Aktif
            </span>
            <span className="mt-2 block text-3xl font-bold">
              {totalProjects}
            </span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5">
            <span className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Tugas Anda (Belum Selesai)
            </span>
            <span className="mt-2 block text-3xl font-bold text-yellow-500">
              {totalTasksAssigned}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight mb-5">Proyek Anda</h2>
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const completedTasks = project.tasks.filter(
                  (t) => t.status === "DONE",
                ).length;
                const totalProjectTasks = project.tasks.length;
                const progressPercentage =
                  totalProjectTasks > 0
                    ? Math.round((completedTasks / totalProjectTasks) * 100)
                    : 0;

                return (
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    key={project.id}
                    className="group block rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
                        {project.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          project.status === "ACTIVE"
                            ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/50"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400 h-10">
                      {project.description || "Tidak ada deskripsi proyek."}
                    </p>

                    <div className="mt-6">
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                        <span>Progress Tugas</span>
                        <span className="text-zinc-300 font-medium">
                          {progressPercentage}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-zinc-800/60">
                      <div className="flex -space-x-2 overflow-hidden">
                        {project.members.slice(0, 4).map((member) => (
                          <img
                            key={member.id}
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-900 border border-zinc-800"
                            src={member.user.image || "/default-avatar.png"}
                            alt=""
                          />
                        ))}
                        {project.members.length > 4 && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400 ring-2 ring-zinc-900">
                            +{project.members.length - 4}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {totalProjectTasks} Task
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 p-12 text-center bg-zinc-900/10">
              <p className="text-sm text-zinc-400">
                Anda belum tergabung dalam proyek apa pun.
              </p>
              <Link
                href="/dashboard/projects/new"
                className="mt-4 inline-block text-xs font-medium text-white underline hover:text-zinc-300"
              >
                Buat proyek pertama Anda
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
