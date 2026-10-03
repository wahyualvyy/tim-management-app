import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SignOutButton, SignOutEverywhereButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Pengaturan" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Tampilan" description="Terang, gelap, atau ikuti sistem. Tersimpan di akun Anda." action={<ThemeToggle className="w-32" />} />
        </Card>
        <Card>
          <CardHeader
            title="Profil"
            description="Nama, username, foto, jabatan, bio, lokasi, dan zona waktu."
            action={
              <Link href="/profile" className={buttonClasses("outline", "sm")}>
                Ubah profil
              </Link>
            }
          />
        </Card>
        {isAdmin(user) ? (
          <Card>
            <CardHeader
              title="Administrasi"
              description="Kelola status akun dan peran sistem pengguna."
              action={
                <Link href="/admin/users" className={buttonClasses("outline", "sm")}>
                  Kelola pengguna
                </Link>
              }
            />
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Akun" description={`Masuk sebagai ${user.email} dengan Google.`} action={
              <div className="flex flex-wrap justify-end gap-2">
                <SignOutEverywhereButton />
                <SignOutButton />
              </div>
            }
          />
        </Card>
      </div>
    </div>
  );
}
