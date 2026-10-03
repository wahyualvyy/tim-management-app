import "server-only";
import { getMemberRole } from "@/lib/redis/members";
import { getModule, getSubModule } from "@/lib/redis/modules";
import { atLeast } from "@/lib/permissions";
import { AppError } from "@/lib/errors";

/** A module or sub module lead must be a project member who can work on tasks. */
export async function assertLeadIsMember(projectId: string, leadId: string | null): Promise<void> {
  if (leadId && !atLeast(await getMemberRole(projectId, leadId), "MEMBER")) {
    throw new AppError("Penanggung jawab harus anggota proyek.");
  }
}

/**
 * Validates that a module (and optional sub module) belong to the project
 * and to each other. Ids come from the client, so they are never trusted.
 */
export async function resolvePlacement(
  projectId: string,
  moduleId: string,
  subModuleId: string | null,
): Promise<{ moduleName: string; subModuleName: string | null }> {
  const mod = await getModule(moduleId);
  if (!mod || mod.projectId !== projectId) throw new AppError("Pilih modul yang ada di proyek ini.");
  if (!subModuleId) return { moduleName: mod.name, subModuleName: null };
  const sub = await getSubModule(subModuleId);
  if (!sub || sub.moduleId !== mod.id) throw new AppError("Sub modul tidak berada di modul yang dipilih.");
  return { moduleName: mod.name, subModuleName: sub.name };
}
