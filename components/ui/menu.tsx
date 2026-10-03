"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DropdownMenu, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "animate-pop-in z-50 min-w-44 rounded-lg border border-border bg-surface p-1 text-sm shadow-pop",
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  href,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const className = cn(
    "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 outline-none",
    "data-[highlighted]:bg-hover data-[disabled]:opacity-50",
    danger ? "text-danger" : "text-fg",
  );
  if (href) {
    return (
      <DropdownMenu.Item asChild disabled={disabled} onSelect={onSelect} className={className}>
        <Link href={href}>{children}</Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item onSelect={onSelect} disabled={disabled} className={className}>
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  disabled,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="animate-fade-in z-50 rounded-md bg-fg px-2 py-1 text-xs text-background shadow-pop"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
