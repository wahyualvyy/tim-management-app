import type { StructureStatus } from "@/types/module";
import type { ProjectColor, ProjectRole, ProjectStatus } from "@/types/project";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { AccountStatus, GlobalRole } from "@/types/user";

/**
 * Every user-facing label for internal enum values, in Indonesian.
 * Enums stay in English in code and storage.
 */

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Belum Dikerjakan",
  IN_PROGRESS: "Sedang Dikerjakan",
  REVIEW: "Ditinjau",
  BLOCKED: "Terhambat",
  DONE: "Selesai",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Perencanaan",
  ACTIVE: "Aktif",
  ON_HOLD: "Ditunda",
  COMPLETED: "Selesai",
  ARCHIVED: "Diarsipkan",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, "info" | "accent" | "warning" | "success" | "neutral"> = {
  PLANNING: "info",
  ACTIVE: "accent",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export const STRUCTURE_STATUS_LABEL: Record<StructureStatus, string> = {
  PLANNED: "Direncanakan",
  IN_PROGRESS: "Berjalan",
  DONE: "Selesai",
};

export const ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: "Pemilik",
  LEAD: "Lead",
  MEMBER: "Anggota",
  VIEWER: "Pengamat",
};

export const ROLE_DESCRIPTION: Record<ProjectRole, string> = {
  OWNER: "Akses penuh, termasuk menghapus proyek dan mengubah peran.",
  LEAD: "Mengelola modul, sub modul, tugas, serta anggota dan pengamat.",
  MEMBER: "Membuat tugas, mengerjakan tugasnya, berkomentar dan mencatat waktu.",
  VIEWER: "Hanya dapat melihat.",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  VERIFIED: "Terverifikasi",
  UNVERIFIED: "Belum terverifikasi",
  SUSPENDED: "Ditangguhkan",
};

export const GLOBAL_ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: "Admin",
  USER: "Pengguna",
};

export const PROJECT_COLOR_LABEL: Record<ProjectColor, string> = {
  slate: "Abu",
  blue: "Biru",
  violet: "Ungu",
  green: "Hijau",
  amber: "Kuning",
  rose: "Merah muda",
  cyan: "Sian",
  orange: "Oranye",
};
