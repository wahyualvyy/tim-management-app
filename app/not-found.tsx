import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted">
        <SearchX className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Tidak ditemukan</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Halaman ini tidak ada, atau Anda tidak memiliki akses ke sana.
      </p>
      <Link href="/dashboard" className={buttonClasses("outline", "md", "mt-5")}>
        Kembali ke Dasbor
      </Link>
    </main>
  );
}
