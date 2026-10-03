"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut, MonitorX } from "lucide-react";
import { signOutEverywhereAction } from "@/app/actions/profile/profile-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function SignOutButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => void signOut({ callbackUrl: "/login" })}>
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Keluar
    </Button>
  );
}

/** Invalidates every session (all devices) by bumping the session version, then signs out here. */
export function SignOutEverywhereButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <MonitorX className="h-3.5 w-3.5" aria-hidden />
        Keluar dari semua perangkat
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Keluar dari semua perangkat?"
        description="Semua sesi aktif Anda, termasuk di perangkat ini, akan diakhiri. Anda perlu masuk lagi dengan Google."
        confirmLabel="Keluar dari semua"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await signOutEverywhereAction();
            if (!result.ok) return toast.error(result.error);
            await signOut({ callbackUrl: "/login" });
          })
        }
      />
    </>
  );
}
