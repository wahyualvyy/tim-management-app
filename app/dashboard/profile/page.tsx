import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { updateProfile } from "@/app/actions/profile";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  return (
    <div className="p-8 text-white max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Kelola data profil personal dan integrasi repositori Anda.
        </p>
      </div>

      <form
        action={updateProfile}
        className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4 border-b border-zinc-800/60 pb-6">
          {user?.image ? (
            <img
              src={user.image}
              alt=""
              className="h-14 w-14 rounded-full border border-zinc-700 shadow-md"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-zinc-800" />
          )}
          <div>
            <h3 className="text-sm font-medium text-zinc-200">{user?.email}</h3>
            <span className="text-xs text-zinc-500">
              ID Pengguna: {user?.id}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
          >
            Nama Lengkap
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            defaultValue={user?.name || ""}
            className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="github_username"
            className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
          >
            Username GitHub
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-sm text-zinc-600">
              github.com/
            </span>
            <input
              type="text"
              id="github_username"
              name="github_username"
              defaultValue={user?.github_username || ""}
              placeholder="username"
              className="w-full rounded-md border border-zinc-800 bg-black pl-[94px] pr-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end border-t border-zinc-800/60">
          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors shadow-sm"
          >
            Perbarui Profil
          </button>
        </div>
      </form>
    </div>
  );
}
