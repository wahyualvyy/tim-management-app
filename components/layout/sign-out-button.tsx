"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => void signOut({ callbackUrl: "/login" })}>
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Sign out
    </Button>
  );
}
