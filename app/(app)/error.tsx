"use client";

import { SectionError } from "@/components/layout/section-error";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError digest={error.digest} reset={reset} backHref="/dashboard" backLabel="Ke dasbor" />;
}
