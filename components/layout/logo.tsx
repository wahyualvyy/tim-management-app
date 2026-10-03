import { cn } from "@/lib/utils";

/** Product mark: three stacked bars, echoing project → module → task. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg bg-fg text-background", className)}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <rect x="2" y="2.5" width="12" height="2.5" rx="1.25" />
        <rect x="4" y="6.75" width="10" height="2.5" rx="1.25" opacity="0.75" />
        <rect x="6" y="11" width="8" height="2.5" rx="1.25" opacity="0.5" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">Tim</span>
    </span>
  );
}
