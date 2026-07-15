import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import CalendarClient from "./CalendarClient";

export default async function SchedulePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const tasks = await prisma.task.findMany({
    where: {
      assigned_to: session.user.id,
      deadline: { not: null },
    },
    include: {
      project: true,
    },
    orderBy: {
      deadline: "asc",
    },
  });

  const serializedTasks = tasks.map((task) => ({
    ...task,
    deadline: task.deadline ? task.deadline.toISOString() : null,
  }));

  return (
    <div className="p-8 text-zinc-900 dark:text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Jadwal & Kalender</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Pantau tenggat waktu proyek Anda di bulan ini.
        </p>
      </div>

      <CalendarClient tasks={serializedTasks} />
    </div>
  );
}
