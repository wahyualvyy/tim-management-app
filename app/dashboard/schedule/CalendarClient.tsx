"use client";

import { useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  priority: string;
  project_id: string;
  project: { name: string };
};

export default function CalendarClient({ tasks }: { tasks: Task[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const tasksThisMonth = tasks.filter((task) => {
    if (!task.deadline) return false;
    const taskDate = new Date(task.deadline);
    return taskDate.getMonth() === month && taskDate.getFullYear() === year;
  });

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const getTasksForDay = (day: number) => {
    return tasksThisMonth.filter((task) => {
      const taskDate = new Date(task.deadline!);
      return taskDate.getDate() === day;
    });
  };

  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={prevMonth}
              className="rounded-md border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400"
            >
              &larr;
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400"
            >
              Hari Ini
            </button>
            <button
              onClick={nextMonth}
              className="rounded-md border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
          {dayNames.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(80px,auto)] bg-zinc-200 dark:bg-zinc-800 gap-px">
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-zinc-50 dark:bg-zinc-950/50"
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const dayTasks = getTasksForDay(day);
            const isToday =
              day === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();

            return (
              <div
                key={day}
                className="bg-white dark:bg-zinc-950 p-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/projects/${task.project_id}/tasks/${task.id}`}
                      className={`block truncate rounded px-1 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80 ${
                        task.status === "DONE"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : task.priority === "HIGH"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                      }`}
                    >
                      {task.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          Daftar Tugas: {monthNames[month]} {year}
        </h3>

        <div className="space-y-6 max-w-3xl">
          {tasksThisMonth.length > 0 ? (
            tasksThisMonth
              .sort(
                (a, b) =>
                  new Date(a.deadline!).getTime() -
                  new Date(b.deadline!).getTime(),
              )
              .map((task) => {
                const isOverdue =
                  new Date(task.deadline!) < new Date() &&
                  task.status !== "DONE";
                return (
                  <div
                    key={task.id}
                    className="relative flex gap-6 items-start group"
                  >
                    <div className="w-24 text-right pt-1 flex-shrink-0">
                      <span
                        className={`text-xs font-semibold ${isOverdue ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
                      >
                        {new Date(task.deadline!).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    <div className="absolute left-[112px] top-2 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 group-last:hidden" />
                    <div
                      className={`relative z-10 h-2 w-2 rounded-full mt-2.5 flex-shrink-0 ${
                        task.status === "DONE"
                          ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950"
                          : isOverdue
                            ? "bg-red-500 ring-4 ring-red-100 dark:ring-red-950"
                            : "bg-zinc-400 dark:bg-zinc-600"
                      }`}
                    />

                    <Link
                      href={`/dashboard/projects/${task.project_id}/tasks/${task.id}`}
                      className="flex-1 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                            {task.project.name}
                          </span>
                          <h3
                            className={`text-sm font-medium mt-0.5 ${task.status === "DONE" ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-200"}`}
                          >
                            {task.title}
                          </h3>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                            task.priority === "HIGH"
                              ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center bg-zinc-50 dark:bg-zinc-900/10">
              <p className="text-sm text-zinc-500">
                Yeay! Tidak ada jadwal atau deadline untuk bulan ini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
