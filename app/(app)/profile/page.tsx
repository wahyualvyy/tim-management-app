import type { Metadata } from "next";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates";
import { isStorageConfigured } from "@/lib/storage";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { AvatarUploader, ProfileForm } from "@/components/profile/profile-forms";

export const metadata: Metadata = { title: "Profile" };

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export default async function ProfilePage() {
  const user = await requireUser();
  const zones = timeZones();
  if (!zones.includes(user.timezone)) zones.unshift(user.timezone);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" description="How you appear to your team." />
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center">
            <AvatarUploader name={user.name} avatar={user.avatar} uploadsEnabled={isStorageConfigured()} />
            <dl className="grid flex-1 gap-3 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd className="mt-0.5 truncate">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Verification</dt>
                <dd className="mt-0.5">
                  {user.emailVerified ? (
                    <Badge tone="success">
                      <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
                    </Badge>
                  ) : (
                    <Badge tone="warning">
                      <CircleAlert className="h-3 w-3" aria-hidden /> Not verified
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Joined</dt>
                <dd className="mt-0.5">{formatLongDate(user.createdAt, user.timezone)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Personal details" />
          <div className="px-5 py-5">
            <ProfileForm
              initial={{ name: user.name, jobTitle: user.jobTitle, bio: user.bio, timezone: user.timezone }}
              timeZones={zones}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
