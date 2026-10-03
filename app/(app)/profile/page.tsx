import type { Metadata } from "next";
import { BadgeCheck, CircleAlert, MapPin, ShieldOff } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates";
import { ACCOUNT_STATUS_LABEL, GLOBAL_ROLE_LABEL } from "@/lib/labels";
import { uploadMode } from "@/lib/storage";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { AvatarUploader, ProfileForm } from "@/components/profile/profile-forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { AccountStatus } from "@/types/user";

export const metadata: Metadata = { title: "Profil" };

function timeZones(current: string): string[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

const STATUS_BADGE: Record<AccountStatus, { tone: "success" | "warning" | "danger"; icon: typeof BadgeCheck }> = {
  VERIFIED: { tone: "success", icon: BadgeCheck },
  UNVERIFIED: { tone: "warning", icon: CircleAlert },
  SUSPENDED: { tone: "danger", icon: ShieldOff },
};

export default async function ProfilePage() {
  const user = await requireUser();
  const status = STATUS_BADGE[user.status];
  const StatusIcon = status.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <AvatarUploader userId={user.id} name={user.name} avatar={user.avatar} providerAvatar={user.providerAvatar} uploadMode={uploadMode()} />
        <div className="min-w-0 sm:text-right">
          <h1 className="truncate text-xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted">
            @{user.username}
            {user.jobTitle ? ` · ${user.jobTitle}` : ""}
          </p>
          {user.location ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-subtle">
              <MapPin className="h-3 w-3" aria-hidden /> {user.location}
            </p>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader title="Informasi profil" description="Ditampilkan kepada anggota proyek Anda." />
        <div className="px-4 py-4 sm:px-5">
          <ProfileForm
            initial={{
              name: user.name,
              username: user.username,
              jobTitle: user.jobTitle,
              bio: user.bio,
              whatsapp: user.whatsapp,
              location: user.location,
              timezone: user.timezone,
            }}
            timeZones={timeZones(user.timezone)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Preferensi" description="Tema tersimpan di akun dan mengikuti Anda di semua perangkat." action={<ThemeToggle className="w-32" />} />
      </Card>

      <Card>
        <CardHeader title="Akun" />
        <dl className="grid gap-4 px-4 py-4 text-[13px] sm:grid-cols-2 sm:px-5">
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-0.5 truncate">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Status akun</dt>
            <dd className="mt-0.5">
              <Badge tone={status.tone}>
                <StatusIcon className="h-3 w-3" aria-hidden /> {ACCOUNT_STATUS_LABEL[user.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Masuk dengan</dt>
            <dd className="mt-0.5">Google{user.emailVerified ? " · email terverifikasi oleh Google" : ""}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Peran sistem</dt>
            <dd className="mt-0.5">{GLOBAL_ROLE_LABEL[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Bergabung</dt>
            <dd className="mt-0.5">{formatLongDate(user.createdAt, user.timezone)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Keamanan & sesi"
          description="Sesi terenkripsi berlaku hingga 30 hari di perangkat ini. Email diatur oleh akun Google Anda."
          action={<SignOutButton />}
        />
      </Card>
    </div>
  );
}
