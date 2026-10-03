import {
  Box,
  Briefcase,
  Code2,
  Database,
  FlaskConical,
  Folder,
  Globe,
  Layers,
  Megaphone,
  Palette,
  Rocket,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectColor, ProjectIcon as IconKey } from "@/types/project";

export const PROJECT_ICON_MAP: Record<IconKey, LucideIcon> = {
  folder: Folder,
  rocket: Rocket,
  layers: Layers,
  box: Box,
  code: Code2,
  briefcase: Briefcase,
  globe: Globe,
  database: Database,
  smartphone: Smartphone,
  palette: Palette,
  megaphone: Megaphone,
  flask: FlaskConical,
};

/** Tinted backgrounds that work in both themes; the only place project colors are defined. */
export const PROJECT_COLOR_CLASS: Record<ProjectColor, string> = {
  slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  cyan: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-400",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
};

export const PROJECT_COLOR_SWATCH: Record<ProjectColor, string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};

export function ProjectIcon({
  icon,
  color = "slate",
  size = "md",
  className,
}: {
  icon: IconKey;
  color?: ProjectColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = PROJECT_ICON_MAP[icon] ?? Folder;
  const box = { sm: "h-5 w-5 rounded-md", md: "h-7 w-7 rounded-md", lg: "h-10 w-10 rounded-lg" }[size];
  const glyph = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-5 w-5" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", PROJECT_COLOR_CLASS[color], box, className)} aria-hidden>
      <Icon className={glyph} />
    </span>
  );
}
