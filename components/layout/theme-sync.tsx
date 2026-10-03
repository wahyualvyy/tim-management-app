"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { ThemePreference } from "@/types/user";

/**
 * Applies the theme saved on the user's profile once per session, so the
 * preference follows the user across devices. Later changes made with the
 * toggle are saved back to the profile.
 */
export function ThemeSync({ preference }: { preference: ThemePreference }) {
  const { theme, setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || theme === undefined) return;
    applied.current = true;
    if (theme !== preference) setTheme(preference);
  }, [preference, setTheme, theme]);

  return null;
}
