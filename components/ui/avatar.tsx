import Image from "next/image";
import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

const pixels = { xs: 20, sm: 24, md: 32, lg: 48, xl: 80 } as const;

export function Avatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const base = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
    "bg-surface-2 font-medium text-muted ring-1 ring-border",
    sizes[size],
    className,
  );
  if (src) {
    return (
      <span className={base}>
        <Image src={src} alt={name} width={pixels[size]} height={pixels[size]} unoptimized className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={base} aria-label={name} role="img">
      {initials(name)}
    </span>
  );
}
