"use client";

export const COMMAND_PALETTE_EVENT = "tim:open-command-palette";

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}
