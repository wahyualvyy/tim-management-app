import { describe, expect, it } from "vitest";
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from "@/schemas/task.schema";
import { createProjectSchema } from "@/schemas/project.schema";
import { updateProfileSchema } from "@/schemas/profile.schema";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const MODULE = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

describe("task input validation", () => {
  it("normalizes form input", () => {
    const parsed = createTaskSchema.parse({
      projectId: PROJECT,
      moduleId: MODULE,
      subModuleId: "",
      title: "  Hero section  ",
      assigneeIds: [USER, USER],
      labels: "Frontend, frontend , UI",
      dueDate: "",
      estimatedMinutes: "90",
    });
    expect(parsed.title).toBe("Hero section");
    expect(parsed.subModuleId).toBeNull();
    expect(parsed.assigneeIds).toEqual([USER]);
    expect(parsed.labels).toEqual(["frontend", "ui"]);
    expect(parsed.dueDate).toBeNull();
    expect(parsed.estimatedMinutes).toBe(90);
    expect(parsed.priority).toBe("MEDIUM");
  });

  it("rejects a due date before the start date", () => {
    const result = createTaskSchema.safeParse({ projectId: PROJECT, moduleId: MODULE, title: "x", startDate: "2026-10-10", dueDate: "2026-10-01" });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid ids so client-supplied keys can't address arbitrary records", () => {
    expect(createTaskSchema.safeParse({ projectId: "project:*", moduleId: MODULE, title: "x" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ projectId: PROJECT, moduleId: MODULE, title: "x", assigneeIds: ["../admin"] }).success).toBe(false);
  });

  it("rejects fields a client must never set (creator, tracked time)", () => {
    expect(updateTaskSchema.safeParse({ taskId: PROJECT, creatorId: USER }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ taskId: PROJECT, trackedSeconds: 99999 }).success).toBe(false);
  });

  it("accepts only known statuses and finite positions on the board", () => {
    expect(moveTaskSchema.safeParse({ taskId: PROJECT, status: "BLOCKED", order: 1.5 }).success).toBe(true);
    expect(moveTaskSchema.safeParse({ taskId: PROJECT, status: "ARCHIVED" }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ taskId: PROJECT, status: "DONE", order: Infinity }).success).toBe(false);
  });
});

describe("project and profile validation", () => {
  it("uppercases project keys and enforces their format", () => {
    expect(createProjectSchema.parse({ name: "Website Desa", key: "web" }).key).toBe("WEB");
    expect(createProjectSchema.safeParse({ name: "X", key: "1AB" }).success).toBe(false);
  });

  it("validates usernames and WhatsApp numbers", () => {
    const base = { name: "Budi", timezone: "Asia/Jakarta" };
    expect(updateProfileSchema.safeParse({ ...base, username: "Budi.S" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, username: "b" }).success).toBe(false);
    expect(updateProfileSchema.parse({ ...base, username: "budi", whatsapp: "+62 812-3456-7890" }).whatsapp).toBe("+6281234567890");
    expect(updateProfileSchema.safeParse({ ...base, username: "budi", whatsapp: "call me" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...base, username: "budi", timezone: "Mars/Base" }).success).toBe(false);
  });
});
