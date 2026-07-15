"use client";

import { useState, useEffect } from "react";
import { logTime } from "@/app/actions/task";

interface TimeLogItem {
  id: string;
  duration: number;
  created_at: Date | string;
}

export default function TaskTimeTracker({
  taskId,
  initialLogs,
}: {
  taskId: string;
  initialLogs: TimeLogItem[];
}) {
  const [isTracking, setIsTracking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [logs, setLogs] = useState(initialLogs);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTracking) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const mins = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const handleToggleTracking = async () => {
    if (isTracking) {
      setIsTracking(false);
      if (seconds > 0) {
        await logTime(taskId, seconds);
        setLogs([
          {
            id: Math.random().toString(),
            duration: seconds,
            created_at: new Date(),
          },
          ...logs,
        ]);
        setSeconds(0);
      }
    } else {
      setIsTracking(true);
    }
  };

  const totalSecondsSpent = logs.reduce((sum, item) => sum + item.duration, 0);

  return (
    <div className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Pelacak Waktu
          </h4>
          <div className="mt-1 text-2xl font-black tracking-tight text-white tabular-nums">
            {formatTime(isTracking ? seconds : totalSecondsSpent)}
          </div>
          <span className="text-[10px] text-zinc-400">
            {isTracking ? "Sedang berjalan..." : "Total akumulasi waktu kerja"}
          </span>
        </div>

        <button
          onClick={handleToggleTracking}
          className={`rounded-md px-4 py-2 text-xs font-semibold transition-all ${
            isTracking
              ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
              : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {isTracking ? "⏹ Hentikan & Simpan" : "▶ Mulai Kerja"}
        </button>
      </div>

      <div className="border-t border-zinc-800/60 pt-4">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Riwayat Waktu Kerja ({logs.length} Sesi)
        </span>
        <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs bg-zinc-900/50 border border-zinc-800/80 rounded px-2.5 py-1.5 text-zinc-300"
              >
                <span className="tabular-nums font-medium">
                  {formatTime(log.duration)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {new Date(log.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-zinc-600 block italic">
              Belum ada sesi kerja tercatat.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
