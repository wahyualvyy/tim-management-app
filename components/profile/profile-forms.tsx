"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, RotateCcw } from "lucide-react";
import { updateProfileAction, resetAvatarAction } from "@/app/actions/profile/profile-actions";
import { uploadFile, type UploadMode } from "@/components/uploads/upload-file";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateProfileSchema } from "@/schemas/profile.schema";

/** Client-side pre-check only; the server enforces the configured limit and checks the bytes. */
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Pick a photo, preview it, then save. Nothing is uploaded until "Simpan foto". */
export function AvatarUploader({
  userId,
  name,
  avatar,
  providerAvatar,
  uploadMode,
}: {
  userId: string;
  name: string;
  avatar: string | null;
  providerAvatar: string | null;
  uploadMode: UploadMode | null;
}) {
  const uploadsEnabled = uploadMode !== null;
  const [uploading, startUpload] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const current = useRef<string | null>(null);
  const toast = useToast();

  // Object URLs are released when replaced and when the component unmounts.
  function choose(next: { file: File; url: string } | null) {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = next?.url ?? null;
    setPicked(next);
  }
  useEffect(() => () => {
    if (current.current) URL.revokeObjectURL(current.current);
  }, []);

  const reset = useAction(resetAvatarAction, { successMessage: "Kembali memakai foto Google." });

  const usingCustom = Boolean(avatar && avatar !== providerAvatar);

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {picked ? (
        <span className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-accent">
          <Image src={picked.url} alt="Pratinjau foto" fill unoptimized className="object-cover" />
        </span>
      ) : (
        <Avatar name={name} src={avatar} size="xl" />
      )}
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!file) return;
            if (!TYPES.includes(file.type)) return toast.error("Gunakan gambar PNG, JPEG, WebP atau GIF.");
            if (file.size > MAX_BYTES) return toast.error("Ukuran gambar maksimal 5 MB.");
            choose({ file, url: URL.createObjectURL(file) });
          }}
        />
        {picked ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={uploading}
              onClick={() => {
                if (!uploadMode) return;
                const file = picked.file;
                startUpload(async () => {
                  const res = await uploadFile(uploadMode, { kind: "avatar" }, file, `avatars/${userId}`);
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Foto profil diperbarui.");
                  choose(null);
                });
              }}
            >
              Simpan foto
            </Button>
            <Button size="sm" variant="ghost" onClick={() => choose(null)}>
              Batal
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!uploadsEnabled} onClick={() => input.current?.click()}>
              <Camera className="h-3.5 w-3.5" aria-hidden /> Ganti foto
            </Button>
            {usingCustom && providerAvatar ? (
              <Button size="sm" variant="ghost" loading={reset.pending} onClick={() => void reset.run(undefined)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Pakai foto Google
              </Button>
            ) : null}
          </div>
        )}
        <p className="text-[11px] text-subtle">
          {uploadsEnabled ? "PNG, JPEG, WebP atau GIF, maksimal 5 MB." : "Unggah foto belum dikonfigurasi di server ini."}
        </p>
      </div>
    </div>
  );
}

export interface ProfileValues {
  name: string;
  username: string;
  jobTitle: string;
  bio: string;
  whatsapp: string;
  location: string;
  timezone: string;
}

export function ProfileForm({ initial, timeZones }: { initial: ProfileValues; timeZones: string[] }) {
  const { run, pending, fieldErrors } = useAction(updateProfileAction, {
    schema: updateProfileSchema,
    successMessage: "Profil berhasil disimpan.",
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(new FormData(e.currentTarget));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama tampil" htmlFor="profile-name" error={fieldErrors.name}>
          <Input id="profile-name" name="name" defaultValue={initial.name} required maxLength={60} />
        </Field>
        <Field label="Username" htmlFor="profile-username" error={fieldErrors.username} hint="Dipakai untuk menyebut Anda, misalnya @budi">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-subtle">@</span>
            <Input id="profile-username" name="username" defaultValue={initial.username} required maxLength={30} className="pl-6 lowercase" />
          </div>
        </Field>
        <Field label="Jabatan" htmlFor="profile-job" error={fieldErrors.jobTitle}>
          <Input id="profile-job" name="jobTitle" defaultValue={initial.jobTitle} maxLength={80} placeholder="Frontend Developer" />
        </Field>
        <Field label="Lokasi" htmlFor="profile-location" error={fieldErrors.location}>
          <Input id="profile-location" name="location" defaultValue={initial.location} maxLength={80} placeholder="Bandung" />
        </Field>
        <Field label="Nomor WhatsApp" htmlFor="profile-wa" error={fieldErrors.whatsapp} hint="Opsional, hanya terlihat oleh Anda.">
          <Input id="profile-wa" name="whatsapp" type="tel" defaultValue={initial.whatsapp} maxLength={20} placeholder="+6281234567890" />
        </Field>
        <Field label="Zona waktu" htmlFor="profile-tz" error={fieldErrors.timezone} hint="Dipakai untuk tenggat, jadwal, dan waktu.">
          <Select id="profile-tz" name="timezone" defaultValue={initial.timezone}>
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Bio" htmlFor="profile-bio" error={fieldErrors.bio} hint="Satu atau dua kalimat tentang pekerjaan Anda.">
        <Textarea id="profile-bio" name="bio" defaultValue={initial.bio} maxLength={500} rows={3} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Simpan profil
        </Button>
      </div>
    </form>
  );
}
