import { Skeleton } from "@/components/ui/primitives";

/** Shown inside the project layout while a tab loads, so the header and tabs stay put. */
export default function ProjectTabLoading() {
  return (
    <div aria-busy aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-xl" />
    </div>
  );
}
