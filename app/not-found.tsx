import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-muted">
        <SearchX className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard" className={buttonClasses("outline", "md", "mt-5")}>
        Go to home
      </Link>
    </main>
  );
}
