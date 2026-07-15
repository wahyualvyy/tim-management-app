import Sidebar from "./Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-300 dark:bg-black dark:text-white">
      <Sidebar />
      <div className="relative z-0 pl-64">{children}</div>
    </div>
  );
}
