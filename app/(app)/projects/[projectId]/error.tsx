"use client";

import { SectionError } from "@/components/layout/section-error";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError digest={error.digest} reset={reset} backHref="/projects" backLabel="Ke daftar proyek" />;
}
