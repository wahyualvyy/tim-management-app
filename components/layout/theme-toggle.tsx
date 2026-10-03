"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/app/actions/profile/profile-actions";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/user";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const subscribeNoop = () => () => {};

/** True only after hydration, so the selected theme is not guessed on the server. */
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * Segmented Light / Dark / System control. The choice applies instantly via
 * next-themes (stored locally) and, when signed in, is saved to the profile.
 */
export function ThemeToggle({ persist = true, className }: { persist?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  function choose(value: ThemePreference) {
    setTheme(value);
    if (persist) void setThemeAction({ theme: value });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex rounded-lg border border-border bg-surface-2 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              "flex h-6 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors",
              active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
