import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Tim", template: "%s · Tim" },
  description: "Manajemen proyek dan tim: modul, tugas, papan Kanban, dan pencatatan waktu."
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d10" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Set by proxy.ts. Reading it renders pages per request, which a nonce-based CSP requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="id" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
