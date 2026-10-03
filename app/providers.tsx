"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/menu";

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider nonce={nonce} attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
