export type ThemePreference = "light" | "dark" | "system";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Epoch ms when the email was verified, or null when unverified. */
  emailVerified: number | null;
  avatar: string | null;
  jobTitle: string;
  bio: string;
  timezone: string;
  themePreference: ThemePreference;
  createdAt: number;
  updatedAt: number;
}

/** The subset of a user that is safe to show to other project members. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  jobTitle: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    jobTitle: user.jobTitle,
  };
}
