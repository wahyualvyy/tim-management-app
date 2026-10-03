import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { VerifyEmailCard } from "./verify-card";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-card">
        <VerifyEmailCard token={token ?? ""} />
      </div>
    </main>
  );
}
