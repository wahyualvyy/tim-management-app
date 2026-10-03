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
import type { ProjectIcon as IconKey } from "@/types/project";

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

export function ProjectIcon({
  icon,
  size = "md",
  className,
}: {
  icon: IconKey;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = PROJECT_ICON_MAP[icon] ?? Folder;
  const box = { sm: "h-5 w-5 rounded", md: "h-7 w-7 rounded-md", lg: "h-10 w-10 rounded-lg" }[size];
  const glyph = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-5 w-5" }[size];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center border border-border bg-surface-2 text-muted", box, className)}
      aria-hidden
    >
      <Icon className={glyph} />
    </span>
  );
}
