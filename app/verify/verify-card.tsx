"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { verifyEmailAction } from "@/app/actions/auth/verify-email";
import { Button, buttonClasses } from "@/components/ui/button";

type State = { kind: "idle" } | { kind: "done"; email: string } | { kind: "error"; message: string };

export function VerifyEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? { kind: "idle" } : { kind: "error", message: "This link is missing its token." });
  const [pending, startTransition] = useTransition();

  if (state.kind === "done") {
    return (
      <div className="text-center">
        <BadgeCheck className="mx-auto h-8 w-8 text-success" aria-hidden />
        <h1 className="mt-3 text-base font-semibold">Email verified</h1>
        <p className="mt-1 text-[13px] text-muted">{state.email} is now verified.</p>
        <Link href="/dashboard" className={buttonClasses("primary", "md", "mt-5 w-full")}>
          Continue
        </Link>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-danger" aria-hidden />
        <h1 className="mt-3 text-base font-semibold">Can&apos;t verify</h1>
        <p className="mt-1 text-[13px] text-muted">{state.message}</p>
        <Link href="/login" className={buttonClasses("outline", "md", "mt-5 w-full")}>
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="text-center">
      <h1 className="text-base font-semibold">Verify your email</h1>
      <p className="mt-1 text-[13px] text-muted">Confirm that this email address belongs to you.</p>
      <Button
        variant="primary"
        className="mt-5 w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await verifyEmailAction({ token });
            setState(result.ok ? { kind: "done", email: result.data.email } : { kind: "error", message: result.error });
          })
        }
      >
        Verify email
      </Button>
    </div>
  );
}
