import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Every app page reads per-user data, so a mutation refreshes the whole
 * signed-in layout. This keeps the sidebar, timer bar, badges and the
 * current page consistent after any change.
 */
export function revalidateApp(): void {
  revalidatePath("/", "layout");
}
