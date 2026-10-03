import "server-only";
import { getMemberRoles } from "@/lib/redis/members";
import { AppError } from "@/lib/errors";
import { atLeast } from "@/lib/permissions";

/** Assignees must be project members who can work on tasks (not viewers). */
export async function assertAssignable(projectId: string, assigneeIds: readonly string[]): Promise<void> {
  if (assigneeIds.length === 0) return;
  const roles = await getMemberRoles(projectId, assigneeIds);
  for (const id of assigneeIds) {
    if (!atLeast(roles.get(id) ?? null, "MEMBER")) {
      throw new AppError("Tugas hanya bisa ditugaskan ke anggota proyek yang dapat mengerjakannya.");
    }
  }
}
