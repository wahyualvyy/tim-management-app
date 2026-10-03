import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  Eye,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from "lucide-react";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/types/task";

export const STATUS_ICON: Record<TaskStatus, { icon: LucideIcon; className: string }> = {
  TODO: { icon: Circle, className: "text-muted" },
  IN_PROGRESS: { icon: CircleDot, className: "text-warning" },
  REVIEW: { icon: Eye, className: "text-info" },
  BLOCKED: { icon: Ban, className: "text-danger" },
  DONE: { icon: CheckCircle2, className: "text-success" },
};

export const PRIORITY_ICON: Record<TaskPriority, { icon: LucideIcon; className: string }> = {
  LOW: { icon: SignalLow, className: "text-subtle" },
  MEDIUM: { icon: SignalMedium, className: "text-muted" },
  HIGH: { icon: SignalHigh, className: "text-fg" },
  URGENT: { icon: AlertOctagon, className: "text-danger" },
};

export const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_ICON[status];
  const Icon = meta.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className, className)} aria-label={TASK_STATUS_LABEL[status]} />;
}

export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
  const meta = PRIORITY_ICON[priority];
  const Icon = meta.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className, className)} aria-label={`Prioritas ${TASK_PRIORITY_LABEL[priority]}`} />;
}

export function DueBadge({ text, tone }: { text: string; tone: "overdue" | "today" | "soon" | "normal" }) {
  return (
    <span
      className={cn(
        "tabular inline-flex items-center text-[11px]",
        tone === "overdue" && "font-medium text-danger",
        tone === "today" && "font-medium text-warning",
        tone === "soon" && "text-fg",
        tone === "normal" && "text-muted",
      )}
      title={tone === "overdue" ? "Terlambat" : undefined}
    >
      {tone === "overdue" ? `Terlambat · ${text}` : text}
    </span>
  );
}
