"use client";

import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered modal for short forms and confirmations. */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <D.Content
          className={cn(
            "animate-pop-in fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2",
            "max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-pop focus:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <D.Title className="text-[15px] font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="rounded-md p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">{footer}</div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/** Right-side panel; full screen on small viewports. */
export function Sheet({ open, onOpenChange, title, children, className }: SheetProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-40 bg-black/30" />
        <D.Content
          className={cn(
            "animate-slide-in-right fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-surface shadow-pop",
            "focus:outline-none sm:w-[min(720px,100vw)]",
            className,
          )}
          aria-describedby={undefined}
        >
          <D.Title className="sr-only">{title}</D.Title>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const SheetClose = D.Close;
