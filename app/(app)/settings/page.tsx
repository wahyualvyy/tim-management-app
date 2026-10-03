import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Appearance"
            description="Light, dark, or follow your system. Saved to your account."
            action={<ThemeToggle className="w-36" />}
          />
        </Card>
        <Card>
          <CardHeader
            title="Profile"
            description="Name, photo, job title, bio and time zone."
            action={
              <Link href="/profile" className={buttonClasses("outline", "sm")}>
                Edit profile
              </Link>
            }
          />
        </Card>
        <Card>
          <CardHeader
            title="Account"
            description={`Signed in as ${user.email} with Google.`}
            action={<SignOutButton />}
          />
        </Card>
      </div>
    </div>
  );
}
