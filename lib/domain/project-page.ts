import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMemberRole, getProject } from "@/lib/redis/repositories/project.repository";
import type { Project, ProjectRole } from "@/types/project";
import type { User } from "@/types/user";

/**
 * Loads the project for a project page and checks membership. Cached per
 * request so the layout and the page share one lookup. Non-members get a 404.
 */
export const loadProjectPage = cache(
  async (projectId: string): Promise<{ user: User; project: Project; role: ProjectRole }> => {
    const user = await requireUser();
    const [project, role] = await Promise.all([getProject(projectId), getMemberRole(projectId, user.id)]);
    if (!project || !role) notFound();
    return { user, project, role };
  },
);
