"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Error state rendered inside the app shell, so the sidebar and navigation
 * stay usable when one page fails. Only the error digest is shown; details
 * stay in the server log.
 */
export function SectionError({ digest, reset, backHref, backLabel }: { digest?: string; reset: () => void; backHref: string; backLabel: string }) {
  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted">
        <TriangleAlert className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Bagian ini gagal dimuat</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">Coba muat ulang. Jika masih gagal, kembali dan coba beberapa saat lagi.</p>
      {digest ? <p className="mt-2 font-mono text-[11px] text-subtle">Referensi: {digest}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Coba lagi
        </Button>
        <Link href={backHref} className={buttonClasses("ghost")}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
