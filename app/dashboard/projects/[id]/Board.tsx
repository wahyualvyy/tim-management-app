"use client";

import { useState } from "react";
import Link from "next/link";
import { updateTaskStatus } from "@/app/actions/task";

interface Task {
  id: string;
  title: string;
  priority: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  assignee?: {
    name: string | null;
    image: string | null;
  } | null;
}

export default function Board({
  initialTasks,
  projectId,
}: {
  initialTasks: Task[];
  projectId: string;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetStatus: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE",
  ) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const currentTasks = [...tasks];
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: targetStatus } : t,
    );
    setTasks(updatedTasks);

    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("project_id", projectId);
    formData.append("status", targetStatus);

    try {
      await updateTaskStatus(formData);
    } catch (error) {
      setTasks(currentTasks);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const columns: {
    id: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
    title: string;
    color: string;
  }[] = [
    { id: "TODO", title: "To Do", color: "text-zinc-300" },
    { id: "IN_PROGRESS", title: "In Progress", color: "text-blue-400" },
    { id: "REVIEW", title: "Review", color: "text-yellow-400" },
    { id: "DONE", title: "Done", color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className="bg-zinc-900/30 rounded-lg p-4 border border-zinc-800/50 min-h-[500px] transition-colors duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${col.color}`}>{col.title}</h3>
              <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-3 h-full pb-20">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="block bg-black border border-zinc-800 rounded-md p-4 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all cursor-grab active:cursor-grabbing shadow-sm"
                >
                  <Link
                    href={`/dashboard/projects/${projectId}/tasks/${task.id}`}
                  >
                    <h4 className="text-sm font-medium text-zinc-100 mb-1 hover:text-white transition-colors">
                      {task.title}
                    </h4>
                  </Link>
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        task.priority === "HIGH"
                          ? "bg-red-950/50 text-red-400"
                          : task.priority === "MEDIUM"
                            ? "bg-yellow-950/50 text-yellow-400"
                            : "bg-green-950/50 text-green-400"
                      }`}
                    >
                      {task.priority}
                    </span>
                    {task.assignee && (
                      <img
                        src={task.assignee.image || "/default-avatar.png"}
                        alt=""
                        className="h-5 w-5 rounded-full border border-zinc-700"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
