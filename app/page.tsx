"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-zinc-400">Memuat sesi...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-luminosity"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop')",
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-zinc-800 bg-black/80 p-8 shadow-2xl backdrop-blur-sm">
        {session ? (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Selamat datang, {session.user?.name}
            </h1>
            <p className="text-sm text-zinc-400">
              Anda telah berhasil masuk ke dalam sistem.
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <a
                href="/dashboard"
                className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Masuk ke Dashboard
              </a>
              <button
                onClick={() => signOut()}
                className="w-full rounded-md border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-900"
              >
                Keluar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Sistem Manajemen Tim
            </h1>
            <p className="text-sm text-zinc-400">
              Silakan masuk menggunakan akun GitHub Anda untuk melanjutkan.
            </p>
            <button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 fill-current"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path>
              </svg>
              Login dengan GitHub
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
