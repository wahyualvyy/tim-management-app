export type ThemePreference = "light" | "dark" | "system";

export const ACCOUNT_STATUSES = ["VERIFIED", "UNVERIFIED", "SUSPENDED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const GLOBAL_ROLES = ["ADMIN", "USER"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export interface User {
  id: string;
  name: string;
  /** Unique, lowercase handle used for @mentions. */
  username: string;
  email: string;
  /** Epoch ms when the provider confirmed the email, or null. */
  emailVerified: number | null;
  /** Current photo: an uploaded file, or the provider photo. */
  avatar: string | null;
  /** Photo from the identity provider, kept so the user can switch back to it. */
  providerAvatar: string | null;
  jobTitle: string;
  bio: string;
  whatsapp: string;
  location: string;
  timezone: string;
  themePreference: ThemePreference;
  provider: string;
  providerAccountId: string;
  status: AccountStatus;
  role: GlobalRole;
  /** Incremented by "sign out everywhere"; sessions carrying an older value are rejected. */
  sessionVersion: number;
  createdAt: number;
  updatedAt: number;
}

/** The subset of a user that other project members may see. */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string | null;
  jobTitle: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    jobTitle: user.jobTitle,
  };
}
