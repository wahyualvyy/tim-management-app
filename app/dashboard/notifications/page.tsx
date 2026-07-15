import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { markAsRead } from "@/app/actions/notification";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      user_id: session.user.id,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black/50 px-8 py-4 sticky top-0 backdrop-blur-md z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white"
            >
              &larr; Dashboard
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Notifikasi</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-8">
        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  notif.is_read
                    ? "bg-zinc-900/20 border-zinc-900 text-zinc-500"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-200"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm">{notif.message}</p>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(notif.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
                {!notif.is_read && (
                  <form action={markAsRead.bind(null, notif.id)}>
                    <button
                      type="submit"
                      className="text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors"
                    >
                      Tandai Dibaca
                    </button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/10">
              <p className="text-sm text-zinc-500">
                Kotak masuk Anda bersih. Tidak ada notifikasi baru.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
