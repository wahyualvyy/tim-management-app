import {
  AlertOctagon,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  Eye,
  Minus,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/types/task";

export const STATUS_META: Record<TaskStatus, { label: string; icon: LucideIcon; className: string }> = {
  BACKLOG: { label: "Backlog", icon: CircleDashed, className: "text-subtle" },
  TODO: { label: "To do", icon: Circle, className: "text-muted" },
  IN_PROGRESS: { label: "In progress", icon: CircleDot, className: "text-warning" },
  REVIEW: { label: "In review", icon: Eye, className: "text-accent" },
  DONE: { label: "Done", icon: CheckCircle2, className: "text-success" },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; icon: LucideIcon; className: string }> = {
  NONE: { label: "No priority", icon: Minus, className: "text-subtle" },
  LOW: { label: "Low", icon: SignalLow, className: "text-muted" },
  MEDIUM: { label: "Medium", icon: SignalMedium, className: "text-muted" },
  HIGH: { label: "High", icon: SignalHigh, className: "text-fg" },
  URGENT: { label: "Urgent", icon: AlertOctagon, className: "text-danger" },
};

export const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className, className)} aria-label={meta.label} />;
}

export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className, className)} aria-label={meta.label} />;
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
    >
      {text}
    </span>
  );
}
