import type { Metadata } from "next";
import { Boxes, Clock3, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { safeRedirectPath } from "@/lib/utils";
import { GoogleSignInButton } from "./google-button";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "Email ini terhubung dengan metode masuk lain.",
  AccessDenied: "Akses ditolak. Coba gunakan akun Google lain.",
  NoEmail: "Akun Google Anda tidak membagikan alamat email.",
  Unavailable: "Penyimpanan data sedang tidak dapat dijangkau. Coba lagi sebentar.",
  SessionExpired: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  Suspended: "Akun Anda sedang ditangguhkan. Hubungi admin tim Anda.",
  Configuration: "Login belum dikonfigurasi dengan benar di server ini.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Gagal masuk. Silakan coba lagi.") : null;
  const target = safeRedirectPath(callbackUrl);

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden flex-col justify-between border-r border-border bg-surface px-12 py-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">Rencanakan pekerjaan. Catat waktunya. Selesaikan bersama.</h1>
          <ul className="mt-8 space-y-5 text-sm">
            {[
              { icon: Boxes, title: "Proyek, modul, sub modul, tugas", text: "Pecah proyek besar menjadi bagian yang jelas pemiliknya." },
              { icon: Clock3, title: "Timer yang benar-benar akurat", text: "Tetap berjalan saat pindah tab, halaman dimuat ulang, atau ganti perangkat." },
              { icon: ShieldCheck, title: "Peran yang jelas", text: "Pemilik, lead, anggota, dan pengamat melihat kontrol yang sesuai." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-subtle">Tim · Manajemen tim dan proyek</p>
      </section>

      <section className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <ThemeToggle persist={false} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h2 className="text-xl font-semibold tracking-tight">Masuk ke Tim</h2>
          <p className="mt-1.5 text-sm text-muted">Gunakan akun Google Anda untuk melanjutkan.</p>
          {message ? (
            <p className="mt-5 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <div className="mt-6">
            <GoogleSignInButton callbackUrl={target} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-subtle">
            Dengan melanjutkan, Anda mengizinkan Tim menyimpan nama, email, dan foto profil Anda agar dikenali oleh tim.
          </p>
        </div>
      </section>
    </main>
  );
}
