"use client";

import { useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/app/actions/profile/profile-actions";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export function AvatarUploader({
  name,
  avatar,
  uploadsEnabled,
}: {
  name: string;
  avatar: string | null;
  uploadsEnabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useAction(uploadAvatarAction, { successMessage: "Photo updated" });
  const remove = useAction(removeAvatarAction, { successMessage: "Photo removed" });

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={avatar} size="xl" />
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("avatar", file);
            void upload.run(fd);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!uploadsEnabled}
            loading={upload.pending}
            onClick={() => input.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            Change photo
          </Button>
          {avatar ? (
            <Button size="sm" variant="ghost" loading={remove.pending} onClick={() => void remove.run(undefined)} aria-label="Remove photo">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-subtle">
          {uploadsEnabled ? "PNG, JPEG, WebP or GIF, up to 2 MB." : "Photo uploads are not configured on this server."}
        </p>
      </div>
    </div>
  );
}

export function ProfileForm({
  initial,
  timeZones,
}: {
  initial: { name: string; jobTitle: string; bio: string; timezone: string };
  timeZones: string[];
}) {
  const { run, pending, fieldErrors } = useAction(updateProfileAction, { successMessage: "Profile saved" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(new FormData(e.currentTarget));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" htmlFor="profile-name" error={fieldErrors.name}>
          <Input id="profile-name" name="name" defaultValue={initial.name} required maxLength={60} />
        </Field>
        <Field label="Job title" htmlFor="profile-job" error={fieldErrors.jobTitle}>
          <Input id="profile-job" name="jobTitle" defaultValue={initial.jobTitle} maxLength={80} placeholder="Product designer" />
        </Field>
      </div>
      <Field label="Bio" htmlFor="profile-bio" error={fieldErrors.bio} hint="A sentence or two about what you work on.">
        <Textarea id="profile-bio" name="bio" defaultValue={initial.bio} maxLength={500} rows={3} />
      </Field>
      <Field
        label="Time zone"
        htmlFor="profile-tz"
        error={fieldErrors.timezone}
        hint="Due dates, the calendar and timestamps use this time zone."
      >
        <Select id="profile-tz" name="timezone" defaultValue={initial.timezone}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
