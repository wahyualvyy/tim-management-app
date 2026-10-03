import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canChangeAssignees,
  canComment,
  canCreateTask,
  canDeleteComment,
  canDeleteProject,
  canDeleteTask,
  canEditComment,
  canEditProject,
  canManageMember,
  canManageStructure,
  canManageTask,
  canTrackTime,
  isWritable,
} from "@/lib/permissions";
import type { ProjectRole } from "@/types/project";

const ME = "me";
const OTHER = "other";
const ALL: ProjectRole[] = ["OWNER", "LEAD", "MEMBER", "VIEWER"];

describe("project-level permissions", () => {
  it("only the owner edits and deletes the project", () => {
    expect(ALL.filter(canEditProject)).toEqual(["OWNER"]);
    expect(ALL.filter(canDeleteProject)).toEqual(["OWNER"]);
  });

  it("owners and leads manage structure; members and viewers do not", () => {
    expect(ALL.filter(canManageStructure)).toEqual(["OWNER", "LEAD"]);
  });

  it("viewers can never mutate tasks or track time", () => {
    expect(canCreateTask("VIEWER")).toBe(false);
    expect(canTrackTime("VIEWER")).toBe(false);
    expect(canManageTask("VIEWER", { creatorId: ME, assigneeIds: [ME] }, ME)).toBe(false);
    expect(canDeleteTask("VIEWER", { creatorId: ME }, ME)).toBe(false);
  });

  it("a non-member (null role) has no permissions", () => {
    expect(canCreateTask(null)).toBe(false);
    expect(canManageTask(null, { creatorId: ME, assigneeIds: [] }, ME)).toBe(false);
    expect(canComment(null, { allowViewerComments: true })).toBe(false);
  });

  it("archived projects are read-only", () => {
    expect(isWritable({ status: "ARCHIVED" })).toBe(false);
    expect(isWritable({ status: "ACTIVE" })).toBe(true);
    expect(isWritable({ status: "COMPLETED" })).toBe(true);
  });
});

describe("member management", () => {
  it("nobody can grant OWNER, only the owner creates leads", () => {
    expect(assignableRoles("OWNER")).toEqual(["LEAD", "MEMBER", "VIEWER"]);
    expect(assignableRoles("LEAD")).toEqual(["MEMBER", "VIEWER"]);
    expect(assignableRoles("MEMBER")).toEqual([]);
  });

  it("leads manage members and viewers but not other leads or the owner", () => {
    expect(canManageMember("LEAD", "MEMBER")).toBe(true);
    expect(canManageMember("LEAD", "VIEWER")).toBe(true);
    expect(canManageMember("LEAD", "LEAD")).toBe(false);
    expect(canManageMember("LEAD", "OWNER")).toBe(false);
    expect(canManageMember("OWNER", "OWNER")).toBe(false);
    expect(canManageMember("MEMBER", "VIEWER")).toBe(false);
  });
});

describe("task permissions", () => {
  it("members manage tasks they created, are assigned to, or that are unassigned", () => {
    expect(canManageTask("MEMBER", { creatorId: ME, assigneeIds: [OTHER] }, ME)).toBe(true);
    expect(canManageTask("MEMBER", { creatorId: OTHER, assigneeIds: [ME, OTHER] }, ME)).toBe(true);
    expect(canManageTask("MEMBER", { creatorId: OTHER, assigneeIds: [] }, ME)).toBe(true);
    expect(canManageTask("MEMBER", { creatorId: OTHER, assigneeIds: [OTHER] }, ME)).toBe(false);
    expect(canManageTask("LEAD", { creatorId: OTHER, assigneeIds: [OTHER] }, ME)).toBe(true);
  });

  it("members only delete tasks they created", () => {
    expect(canDeleteTask("MEMBER", { creatorId: ME }, ME)).toBe(true);
    expect(canDeleteTask("MEMBER", { creatorId: OTHER }, ME)).toBe(false);
    expect(canDeleteTask("LEAD", { creatorId: OTHER }, ME)).toBe(true);
  });

  it("members may only add or remove themselves as assignees", () => {
    expect(canChangeAssignees("MEMBER", ME, [], [ME])).toBe(true);
    expect(canChangeAssignees("MEMBER", ME, [OTHER, ME], [OTHER])).toBe(true);
    expect(canChangeAssignees("MEMBER", ME, [], [OTHER])).toBe(false);
    expect(canChangeAssignees("MEMBER", ME, [OTHER], [])).toBe(false);
    expect(canChangeAssignees("LEAD", ME, [], [OTHER])).toBe(true);
    expect(canChangeAssignees("VIEWER", ME, [], [ME])).toBe(false);
  });
});

describe("comments", () => {
  it("viewers comment only when the project allows it", () => {
    expect(canComment("VIEWER", { allowViewerComments: false })).toBe(false);
    expect(canComment("VIEWER", { allowViewerComments: true })).toBe(true);
    expect(canComment("MEMBER", { allowViewerComments: false })).toBe(true);
  });

  it("only the author edits; author or lead deletes", () => {
    expect(canEditComment({ authorId: ME }, ME)).toBe(true);
    expect(canEditComment({ authorId: OTHER }, ME)).toBe(false);
    expect(canDeleteComment("MEMBER", { authorId: OTHER }, ME)).toBe(false);
    expect(canDeleteComment("LEAD", { authorId: OTHER }, ME)).toBe(true);
  });
});
