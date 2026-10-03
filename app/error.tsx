"use client";

import { RotateCcw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Catches failures in pages and the signed-in layout, e.g. the data store being unreachable. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted">
        <ServerCrash className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Terjadi kesalahan</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Halaman ini gagal dimuat. Biasanya hanya sementara, misalnya saat penyimpanan data tidak dapat dijangkau.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-subtle">Referensi: {error.digest}</p> : null}
      <Button variant="outline" className="mt-5" onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Coba lagi
      </Button>
    </main>
  );
}
