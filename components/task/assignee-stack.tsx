import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

/** Overlapping avatars with a "+n" counter. */
export function AssigneeStack({
  people,
  max = 3,
  size = "xs",
  total,
}: {
  people: Pick<PublicUser, "id" | "name" | "avatar">[];
  max?: number;
  size?: "xs" | "sm";
  /** The full count when `people` is only a preview. */
  total?: number;
}) {
  const box = size === "sm" ? "h-6 w-6" : "h-5 w-5";
  if (people.length === 0) {
    return (
      <span
        className={cn("inline-block shrink-0 rounded-full border border-dashed border-border-strong", box)}
        aria-label="Belum ditugaskan"
        title="Belum ditugaskan"
      />
    );
  }
  const shown = people.slice(0, max);
  const count = Math.max(total ?? 0, people.length);
  const names = people.map((p) => p.name).join(", ") + (count > people.length ? ` dan ${count - people.length} lainnya` : "");
  return (
    <span className="inline-flex shrink-0 -space-x-1" aria-label={names} title={names}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} src={p.avatar} size={size} className="ring-2 ring-surface" />
      ))}
      {count > max ? (
        <span className={cn("flex items-center justify-center rounded-full bg-surface-2 text-[9px] font-medium text-muted ring-2 ring-surface", box)}>
          +{count - max}
        </span>
      ) : null}
    </span>
  );
}
