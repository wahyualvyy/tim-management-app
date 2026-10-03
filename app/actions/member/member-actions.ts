"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { requireProjectWrite } from "@/lib/domain/access";
import { notify } from "@/lib/domain/notify";
import { addMember, getMemberRole, removeMember, setMemberRole } from "@/lib/redis/repositories/project.repository";
import { findUserByEmail, getUser } from "@/lib/redis/repositories/user.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { assignableRoles, canManageMember, canManageMembers } from "@/lib/permissions";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { addMemberSchema, changeMemberRoleSchema, removeMemberSchema } from "@/schemas/member.schema";
import type { ActionResult } from "@/types/action";

export async function addMemberAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, email, role } = parseInput(addMemberSchema, input);
    const { project, role: actorRole } = await requireProjectWrite(projectId, user.id, canManageMembers);
    if (!assignableRoles(actorRole).includes(role)) throw new ForbiddenError("You can't grant that role.");
    const invitee = await findUserByEmail(email);
    if (!invitee) {
      throw new AppError("No account uses that email yet. Ask them to sign in once, then add them.");
    }
    if (await getMemberRole(projectId, invitee.id)) throw new ConflictError("That person is already a member.");
    await addMember(projectId, invitee.id, role);
    await recordActivity({
      type: "member.added",
      projectId,
      actorId: user.id,
      subject: invitee.name,
      meta: { role },
    });
    await notify([invitee.id], user.id, {
      type: "project.invited",
      title: `${user.name} added you to ${project.name}`,
      body: `You joined as ${role.toLowerCase()}.`,
      href: `/projects/${projectId}`,
    });
    revalidateApp();
    return undefined;
  });
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, userId, role } = parseInput(changeMemberRoleSchema, input);
    const { role: actorRole } = await requireProjectWrite(projectId, user.id, canManageMembers);
    const current = await getMemberRole(projectId, userId);
    if (!current) throw new NotFoundError("That person is not a member.");
    if (userId === user.id) throw new ForbiddenError("You can't change your own role.");
    if (!canManageMember(actorRole, current) || !assignableRoles(actorRole).includes(role)) {
      throw new ForbiddenError();
    }
    if (current === role) return undefined;
    await setMemberRole(projectId, userId, role);
    const member = await getUser(userId);
    await recordActivity({
      type: "member.role_changed",
      projectId,
      actorId: user.id,
      subject: member?.name ?? "A member",
      meta: { from: current, to: role },
    });
    revalidateApp();
    return undefined;
  });
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, userId } = parseInput(removeMemberSchema, input);
    const { role: actorRole } = await requireProjectWrite(projectId, user.id, () => true);
    const current = await getMemberRole(projectId, userId);
    if (!current) throw new NotFoundError("That person is not a member.");
    const leavingSelf = userId === user.id;
    if (current === "OWNER") throw new ForbiddenError("The owner can't be removed from the project.");
    if (!leavingSelf && !canManageMember(actorRole, current)) throw new ForbiddenError();
    await removeMember(projectId, userId);
    const member = await getUser(userId);
    await recordActivity({
      type: "member.removed",
      projectId,
      actorId: user.id,
      subject: member?.name ?? "A member",
    });
    revalidateApp();
    return undefined;
  });
}
