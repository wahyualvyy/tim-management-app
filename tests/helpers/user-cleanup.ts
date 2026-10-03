import { entry, userTerms } from "@/lib/search-terms";

/** The users:search entries a test user created, so the test can remove them. */
export function searchTermsFor(user: { id: string; name: string; username: string; email: string }): string[] {
  return userTerms(user).map((t) => entry(t, user.id));
}
