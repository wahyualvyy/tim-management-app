"use server";

import { requireAuth, requireProjectRole } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { notify } from "@/lib/domain/notify";
import { addMember, getMemberRole, removeMember, setMemberRole } from "@/lib/redis/members";
import { getUser } from "@/lib/redis/users";
import { recordActivity } from "@/lib/redis/activities";
import { assignableRoles, canManageMember, canManageMembers } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { addMemberSchema, changeMemberRoleSchema, removeMemberSchema } from "@/schemas/member.schema";
import type { ActionResult } from "@/types/action";

export async function addMemberAction(input: unknown): Promise<ActionResult> {
  return runAction("addMember", async () => {
    const user = await requireAuth();
    const { projectId, userId, role } = parseInput(addMemberSchema, input);
    const { project, role: actorRole } = await requireProjectRole(user, projectId, canManageMembers);
    if (!assignableRoles(actorRole).includes(role)) throw new ForbiddenError("Anda tidak dapat memberikan peran tersebut.");
    await enforceRateLimit("invite", user.id);
    const invitee = await getUser(userId);
    if (!invitee) throw new AppError("Pengguna tidak ditemukan.");
    if (invitee.status === "SUSPENDED") throw new AppError("Akun tersebut sedang ditangguhkan.");
    if (await getMemberRole(projectId, invitee.id)) throw new ConflictError("Orang tersebut sudah menjadi anggota.");
    await addMember(projectId, invitee, role);
    await recordActivity({ type: "member.added", projectId, actorId: user.id, subject: invitee.name, meta: { role } });
    await notify([invitee.id], user.id, {
      type: "project.invited",
      title: `${user.name} menambahkan Anda ke ${project.name}`,
      body: `Peran Anda: ${ROLE_LABEL[role]}.`,
      href: `/projects/${projectId}`,
    });
    revalidateApp();
    return undefined;
  });
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult> {
  return runAction("changeMemberRole", async () => {
    const user = await requireAuth();
    const { projectId, userId, role } = parseInput(changeMemberRoleSchema, input);
    const { role: actorRole } = await requireProjectRole(user, projectId, canManageMembers);
    const current = await getMemberRole(projectId, userId);
    if (!current) throw new NotFoundError("Orang tersebut bukan anggota.");
    if (userId === user.id) throw new ForbiddenError("Anda tidak dapat mengubah peran sendiri.");
    if (!canManageMember(actorRole, current) || !assignableRoles(actorRole).includes(role)) throw new ForbiddenError();
    if (current === role) return undefined;
    const member = await getUser(userId);
    if (!member) throw new NotFoundError("Pengguna tidak ditemukan.");
    await setMemberRole(projectId, member, current, role);
    await recordActivity({
      type: "member.role_changed",
      projectId,
      actorId: user.id,
      subject: member.name,
      meta: { from: current, to: role },
    });
    revalidateApp();
    return undefined;
  });
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  return runAction("removeMember", async () => {
    const user = await requireAuth();
    const { projectId, userId } = parseInput(removeMemberSchema, input);
    const { role: actorRole } = await requireProjectRole(user, projectId, () => true);
    const current = await getMemberRole(projectId, userId);
    if (!current) throw new NotFoundError("Orang tersebut bukan anggota.");
    if (current === "OWNER") throw new ForbiddenError("Pemilik tidak dapat dikeluarkan dari proyek.");
    const leavingSelf = userId === user.id;
    if (!leavingSelf && !canManageMember(actorRole, current)) throw new ForbiddenError();
    const member = await getUser(userId);
    if (!member) throw new NotFoundError("Pengguna tidak ditemukan.");
    await removeMember(projectId, member);
    await recordActivity({ type: "member.removed", projectId, actorId: user.id, subject: member.name });
    revalidateApp();
    return undefined;
  });
}
