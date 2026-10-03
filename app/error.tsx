"use client";

import { RotateCcw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Catches failures in pages and the signed-in layout, e.g. the data store being unreachable. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-muted">
        <ServerCrash className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        We couldn&apos;t load this page. This is usually temporary, for example when the data store is unreachable.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-subtle">Reference: {error.digest}</p> : null}
      <Button variant="outline" className="mt-5" onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </Button>
    </main>
  );
}
