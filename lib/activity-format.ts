import { PROJECT_STATUS_LABEL, ROLE_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_ROLES, PROJECT_STATUSES, type ProjectRole, type ProjectStatus } from "@/types/project";
import { TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { Activity } from "@/types/activity";

function statusLabel(value: string | undefined): string {
  return value && (TASK_STATUSES as readonly string[]).includes(value) ? TASK_STATUS_LABEL[value as TaskStatus] : (value ?? "");
}

function roleLabel(value: string | undefined): string {
  return value && (PROJECT_ROLES as readonly string[]).includes(value)
    ? ROLE_LABEL[value as ProjectRole].toLowerCase()
    : "anggota";
}

function projectStatusLabel(value: string | undefined): string {
  return value && (PROJECT_STATUSES as readonly string[]).includes(value)
    ? PROJECT_STATUS_LABEL[value as ProjectStatus].toLowerCase()
    : (value ?? "");
}

/** Indonesian sentence for an activity entry, without the actor's name. */
export function describeActivity(a: Activity): string {
  const m = a.meta;
  const ref = m.ref ? `${m.ref} ` : "";
  switch (a.type) {
    case "project.created":
      return "membuat proyek";
    case "project.updated":
      return "memperbarui pengaturan proyek";
    case "project.status_changed":
      return `mengubah status proyek menjadi ${projectStatusLabel(m.to)}`;
    case "member.added":
      return `menambahkan ${a.subject} sebagai ${roleLabel(m.role)}`;
    case "member.removed":
      return `mengeluarkan ${a.subject}`;
    case "member.role_changed":
      return `mengubah peran ${a.subject} menjadi ${roleLabel(m.to)}`;
    case "module.created":
      return `membuat modul ${a.subject}`;
    case "module.updated":
      return `memperbarui modul ${a.subject}`;
    case "module.deleted":
      return `menghapus modul ${a.subject}`;
    case "submodule.created":
      return `membuat sub modul ${a.subject}`;
    case "submodule.updated":
      return `memperbarui sub modul ${a.subject}`;
    case "submodule.deleted":
      return `menghapus sub modul ${a.subject}`;
    case "task.created":
      return `membuat tugas ${ref}${a.subject}`;
    case "task.updated":
      return `mengubah tugas ${a.subject}`;
    case "task.status_changed":
      return `memindahkan ${a.subject} dari ${statusLabel(m.from)} ke ${statusLabel(m.to)}`;
    case "task.assigned":
      return m.to ? `menugaskan ${a.subject} kepada ${m.to}` : `menghapus penugasan ${a.subject}`;
    case "task.due_changed":
      return m.to && m.to !== "none" ? `mengubah tenggat ${a.subject} menjadi ${m.to}` : `menghapus tenggat ${a.subject}`;
    case "task.moved":
      return `memindahkan ${a.subject} ke ${m.to}`;
    case "task.completed":
      return `menyelesaikan ${a.subject}`;
    case "task.deleted":
      return `menghapus tugas ${ref}${a.subject}`;
    case "comment.added":
      return `berkomentar di ${a.subject}`;
    case "timer.started":
      return `menjalankan timer pada ${a.subject}`;
    case "timer.stopped":
      return `mencatat ${m.duration ?? "waktu"} pada ${a.subject}`;
    case "time.logged":
      return `menambahkan ${m.duration ?? "waktu"} secara manual pada ${a.subject}`;
    case "attachment.added":
      return `melampirkan ${m.file ?? "berkas"} pada ${a.subject}`;
  }
}
