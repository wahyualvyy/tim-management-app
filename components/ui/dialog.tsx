"use client";

import { useState, type ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered modal for short forms and confirmations. Scrolls inside on small screens. */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/40" />
        <D.Content
          className={cn(
            "animate-pop-in fixed left-1/2 top-[8vh] z-50 flex max-h-[84vh] w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 flex-col",
            "rounded-xl border border-border bg-surface shadow-pop focus:outline-none",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-4">
            <div>
              <D.Title className="text-[15px] font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-[13px] text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="-mr-1 rounded-md p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Tutup">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          {children ? <div className="min-h-0 overflow-y-auto px-5 py-3">{children}</div> : null}
          {footer ? <div className="flex shrink-0 justify-end gap-2 px-5 pb-4 pt-2">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * Confirmation for destructive actions. When `confirmText` is given the user
 * must type it before the action is enabled.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmText,
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmText?: string;
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const blocked = confirmText !== undefined && typed.trim().toUpperCase() !== confirmText.toUpperCase();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTyped("");
      }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="danger" loading={pending} disabled={blocked} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3 text-[13px]">
          <p className="text-muted">{description}</p>
          {children}
          {confirmText !== undefined ? (
            <label className="block">
              <span className="mb-1.5 block">
                Ketik <span className="font-mono font-semibold">{confirmText}</span> untuk mengonfirmasi.
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="h-8 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-sm uppercase focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
          ) : null}
        </div>
      </div>
    </Dialog>
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
            "focus:outline-none sm:w-[min(760px,100vw)]",
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
