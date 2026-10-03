import type { Metadata } from "next";
import { Boxes, Clock3, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { safeRedirectPath } from "@/lib/utils";
import { GoogleSignInButton } from "./google-button";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is linked to a different sign-in method.",
  AccessDenied: "Access was denied. Try a different Google account.",
  NoEmail: "Your Google account did not share an email address.",
  Unavailable: "We couldn't reach the data store. Please try again in a moment.",
  SessionExpired: "Your session ended. Please sign in again.",
  Configuration: "Sign-in is not configured correctly on this server.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;
  const target = safeRedirectPath(callbackUrl);

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden flex-col justify-between border-r border-border bg-surface px-12 py-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Plan the work. Track the time. Ship together.
          </h1>
          <ul className="mt-8 space-y-5 text-sm">
            {[
              { icon: Boxes, title: "Projects, modules and tasks", text: "Break large projects into modules your team can own." },
              { icon: Clock3, title: "Reliable time tracking", text: "Timers keep running across tabs, reloads and devices." },
              { icon: Users, title: "Clear roles", text: "Owners, leads, members and viewers each see the right controls." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-subtle">Tim · Team management</p>
      </section>

      <section className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <ThemeToggle persist={false} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h2 className="text-xl font-semibold tracking-tight">Sign in to Tim</h2>
          <p className="mt-1.5 text-sm text-muted">Use your Google account to continue.</p>
          {message ? (
            <p className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <div className="mt-6">
            <GoogleSignInButton callbackUrl={target} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-subtle">
            By continuing you agree to let Tim store your name, email and profile photo to identify you to your team.
          </p>
        </div>
      </section>
    </main>
  );
}
