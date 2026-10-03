import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "./button";

/** Previous/next links that keep the existing query string. */
export function Pagination({
  basePath,
  query,
  page,
  hasMore,
}: {
  basePath: string;
  query?: Record<string, string | undefined>;
  page: number;
  hasMore: boolean;
}) {
  if (page <= 1 && !hasMore) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="mt-4 flex items-center justify-between" aria-label="Halaman">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses("outline", "sm")}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-subtle">Halaman {page}</span>
      {hasMore ? (
        <Link href={href(page + 1)} className={buttonClasses("outline", "sm")}>
          Berikutnya <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
