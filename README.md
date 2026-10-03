# Tim — Manajemen Tim & Proyek

Tim adalah aplikasi manajemen proyek untuk tim kecil hingga menengah. Pekerjaan disusun sebagai **Proyek → Modul → Sub Modul → Tugas**, dengan papan Kanban, detail tugas dalam panel samping, komentar dengan sebutan, pencatat waktu yang akurat, notifikasi, aktivitas, jadwal, dan izin berbasis peran. Seluruh antarmuka berbahasa Indonesia.

## Teknologi

| Bagian | Pilihan |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`) |
| UI | React 19, Tailwind CSS 4, Radix UI, Lucide, dnd-kit, cmdk |
| Autentikasi | Auth.js (NextAuth v4) + Google, sesi JWT, data user di Redis (tanpa adapter database) |
| Data | Upstash Redis (`@upstash/redis`) sebagai satu-satunya penyimpanan |
| Validasi | Zod (di browser dan di server) |
| Berkas | Abstraksi storage: Vercel Blob (produksi), disk lokal (development) |
| Test | Vitest |

## Kebutuhan

- Node.js 20.9 atau lebih baru (dikembangkan dengan Node 22)
- Database [Upstash Redis](https://console.upstash.com) (paket gratis cukup)
- OAuth client Google
- Opsional: store [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) untuk unggah foto dan lampiran di produksi

## Instalasi

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka http://localhost:3000 lalu masuk dengan Google.

## Variabel lingkungan

| Variabel | Wajib | Kegunaan |
| --- | --- | --- |
| `AUTH_SECRET` | ya | Kunci enkripsi sesi. Buat dengan `openssl rand -base64 32`. `NEXTAUTH_SECRET` juga diterima. |
| `NEXTAUTH_URL` | ya | URL publik aplikasi, mis. `http://localhost:3000`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ya | OAuth client Google. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` juga diterima. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ya | Endpoint REST dan token Upstash. Hanya dipakai di server. |
| `ADMIN_EMAILS` | tidak | Email (dipisah koma) yang otomatis menjadi ADMIN saat masuk. |
| `BLOB_READ_WRITE_TOKEN` | tidak | Mengaktifkan unggah foto profil, lampiran, dan bukti di produksi. |
| `STORAGE_DRIVER` | tidak | Paksa `vercel-blob` atau `local` (local hanya untuk development). |
| `TEST_UPSTASH_REDIS_REST_URL` / `_TOKEN` | tidak | Database Redis **sekali pakai** untuk test integrasi. |
| `SOURCE_DATABASE_URL` | tidak | PostgreSQL lama, hanya untuk script migrasi. |

Rahasia tidak pernah dikirim ke browser: semua akses Redis, OAuth dan storage terjadi di server.

## Setup Google OAuth

1. Google Cloud Console → **APIs & Services → OAuth consent screen**, buat aplikasi (External atau Internal).
2. **Credentials → Create credentials → OAuth client ID**, tipe **Web application**.
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<domain-anda>/api/auth/callback/google`
4. Salin Client ID dan Client Secret ke `AUTH_GOOGLE_ID` dan `AUTH_GOOGLE_SECRET`.

Alur masuk: Halaman masuk → **Masuk dengan Google** → callback → profil dibuat di Redis saat pertama kali (nama, email, foto, provider, providerAccountId, username unik) → Dasbor. Email yang diverifikasi Google membuat status akun `VERIFIED`.

## Setup Upstash Redis

1. Buat database di [console.upstash.com](https://console.upstash.com), pilih region dekat server aplikasi.
2. Di halaman database, buka **REST API** dan salin `UPSTASH_REDIS_REST_URL` serta `UPSTASH_REDIS_REST_TOKEN`.
3. Tidak ada migrasi skema: key dibuat saat pertama dipakai (inisialisasi bersih).

## Perintah

```bash
npm run dev          # development
npm run lint         # ESLint
npm run typecheck    # TypeScript (strict)
npm test             # unit test (+ test integrasi Redis bila TEST_UPSTASH_* diisi)
npm run build        # build produksi
npm start            # menjalankan hasil build
```

## Deploy ke Vercel

1. Import repository di Vercel.
2. Isi variabel lingkungan di atas; `NEXTAUTH_URL` = URL produksi.
3. Tambahkan `https://<domain>/api/auth/callback/google` ke OAuth client Google.
4. Opsional: buat Blob store di tab Storage proyek Vercel (`BLOB_READ_WRITE_TOKEN` terisi otomatis).
5. Deploy.

## Struktur aplikasi

```
app/
  (app)/                    Area login: layout bersama (sidebar, timer, command palette, drawer tugas)
    dashboard/ my-tasks/ projects/ calendar/ notifications/ activity/ profile/ settings/ admin/users/
    projects/[projectId]/   Ringkasan, Papan, Modul, Tugas, Jadwal, Aktivitas, Anggota, Pengaturan
  actions/                  Server Actions per domain (project, module, task, member, comment, timer, …)
  api/auth/[...nextauth]    Route Auth.js
  api/files/[...path]       Penyaji berkas untuk driver storage lokal (development)
  login/ verify/            Halaman publik
lib/
  redis/                    Data access layer: client, keys, users, projects, modules (+ sub modul),
                            tasks, comments, timeLogs, notifications, activities, attachments, search
  auth/                     options (Auth.js), session, guards (requireAuth, requireProjectAccess, …)
  domain/                   Aturan lintas entitas: notifikasi, penempatan modul, view model halaman
  permissions.ts            Aturan peran murni (dipakai server dan UI)
  storage/                  Abstraksi penyimpanan berkas
  labels.ts                 Semua label Bahasa Indonesia untuk enum
schemas/                    Skema Zod untuk setiap input
types/                      Tipe domain (User, Project, Module, SubModule, Task, Comment, TimeLog, …)
components/                 ui, layout, project, module, task, timer, calendar, activity, notification, profile
scripts/                    Migrasi data (opsional, manual)
tests/                      Vitest
proxy.ts                    Pengalihan awal untuk pengguna yang belum masuk
```

Setiap Server Action mengikuti urutan yang sama: **autentikasi** (user diambil dari sesi, bukan dari client) → **validasi** (Zod) → **otorisasi** (peran + status proyek) → **tulis lewat data layer** → **catat aktivitas** → **notifikasi** → **revalidate**. Hasilnya selalu `{ ok: true, data }` atau `{ ok: false, error, code?, fieldErrors? }`. Error internal dicatat di log server dengan nama action dan ditampilkan ke pengguna sebagai pesan umum.

## Struktur data Redis

| Key | Tipe | Isi |
| --- | --- | --- |
| `user:{id}` | hash | Profil: nama, username, email, foto, jabatan, bio, WhatsApp, lokasi, zona waktu, tema, provider, status, peran |
| `users` | zset | Semua user (admin) |
| `user_by_email:{email}` / `user_by_username:{u}` / `user_by_account:{provider}:{id}` | string | Indeks unik (diklaim dengan `SET NX`) |
| `user:{id}:projects` / `:tasks` / `:timelogs` | zset | Proyek, tugas yang ditugaskan, catatan waktu |
| `user:{id}:notifications` / `:notifications:unread` | zset / set | Notifikasi (maks. 200) / yang belum dibaca |
| `user:{id}:timer` | string | Timer aktif `{ taskId, projectId, startedAt }` — satu per user |
| `project:{id}` | hash | Kode, nama, deskripsi, ikon, warna, status, pemilik, tanggal |
| `project_by_key:{KEY}` | string | Indeks kode proyek |
| `project:{id}:members` | hash | userId → peran |
| `project:{id}:modules` | zset | Modul, skor = urutan |
| `project:{id}:tasks` / `:due` / `:start` | zset | Semua tugas / indeks tenggat dan mulai (jadwal) |
| `project:{id}:stats` / `:time` | hash | Progres (`total`, `done`) / waktu (`total` + per user) |
| `project:{id}:activities` | list | Aktivitas JSON, terbaru di depan, maks. 1000 |
| `project:{id}:search` | hash | Teks pencarian per modul, sub modul dan tugas |
| `module:{id}` + `:submodules` `:tasks` `:stats` `:time` | hash/zset | Modul dan agregatnya |
| `submodule:{id}` + `:tasks` `:stats` `:time` | hash/zset | Sub modul dan agregatnya |
| `task:{id}` | hash | Tugas (assignee berupa daftar JSON, `order` untuk posisi di papan) |
| `task:{id}:comments` / `:timelogs` / `:attachments` / `:activities` / `:watchers` / `:timers` / `:time` | campuran | Data turunan tugas |
| `comment:{id}`, `timelog:{id}`, `notification:{id}` | hash | Record yang dirujuk indeks di atas |
| `verification:{sha256(token)}` | string | Token verifikasi sekali pakai, TTL 24 jam |

Konsistensi:

- Operasi yang menyentuh beberapa key memakai transaksi `MULTI`.
- Perubahan status tugas memakai skrip Lua, sehingga progres tidak terhitung ganda saat banyak drag bersamaan.
- Memindahkan tugas antar modul/sub modul ikut memindahkan progres dan waktu tercatat (per user).
- Penghapusan memakai pola "kunci": hanya pemanggil yang berhasil menghapus dari indeks utama yang melanjutkan pembersihan.
- **Hapus proyek** (hard delete, dengan konfirmasi mengetik kode proyek) membersihkan modul, sub modul, tugas, komentar, catatan waktu, lampiran, aktivitas, indeks pencarian, keanggotaan, dan timer yang berjalan. **Arsipkan** (status `ARCHIVED`) adalah alternatif aman yang bisa dikembalikan: proyek menjadi hanya-baca.
- Menghapus modul/sub modul ikut menghapus isinya setelah konfirmasi yang menampilkan jumlah tugas.
- Tidak ada `SCAN`/`KEYS` dalam request biasa; semua akses lewat indeks.

## Peran dan izin

| Peran | Bisa |
| --- | --- |
| Pemilik (OWNER) | Semua, termasuk mengubah/menghapus proyek, mengarsipkan, dan menunjuk lead |
| Lead | Mengelola modul, sub modul, tugas, serta anggota dan pengamat |
| Anggota (MEMBER) | Membuat tugas; mengubah tugas yang ia buat, ditugaskan kepadanya, atau belum ditugaskan; menambah/melepas dirinya sendiri; berkomentar; mencatat waktu |
| Pengamat (VIEWER) | Hanya melihat; berkomentar jika proyek mengizinkan |

Peran global: `ADMIN` (halaman *Kelola pengguna*: status akun, peran, tautan verifikasi) dan `USER`.
Status akun: `VERIFIED`, `UNVERIFIED`, `SUSPENDED` (akun ditangguhkan tidak bisa masuk atau bertindak).

Aturan ada di `lib/permissions.ts`; penegakannya di `lib/auth/guards.ts` (`requireAuth`, `requireAdmin`, `requireProjectAccess`, `requireProjectRole`, `requireTaskAccess`). Non-anggota yang membuka URL proyek mendapat "tidak ditemukan".

## Pencatat waktu

- Mulai: menyimpan `startedAt` (jam server) di `user:{id}:timer` dengan `SET NX`. Hanya satu timer per user; jika masih ada timer lain, server mengembalikan kode `TIMER_ACTIVE` dan UI menampilkan dialog *"Anda masih memiliki timer aktif pada tugas A"* dengan pilihan **Hentikan dan mulai tugas ini** atau **Batal**.
- Tampilan: `elapsed = waktuSekarang − startedAt (+ waktu tercatat sebelumnya)`, dihitung di browser dari timestamp. Interval hanya untuk menggambar ulang, bukan sumber kebenaran, sehingga pindah tab, browser di-background, refresh, menutup halaman, atau login ulang tidak memengaruhi hasil. Tidak ada request Redis per detik.
- Berhenti: `GETDEL` (hanya bisa sekali), `durasi = stoppedAt − startedAt`, disimpan sebagai TimeLog dan ditambahkan ke agregat tugas, sub modul, modul, proyek (total dan per user) dalam satu transaksi.
- Catatan manual dan riwayat sesi tersedia di tab **Waktu** pada detail tugas; ringkasan per modul dan per anggota ada di **Ringkasan** proyek; dasbor menampilkan waktu kerja hari ini dan 7 hari terakhir.

## Migrasi data

Aplikasi tidak pernah menjalankan migrasi secara otomatis.

- **Dari Prisma/PostgreSQL lama** (opsional): `SOURCE_DATABASE_URL=postgresql://… npm run migrate:prisma` (dry run), lalu tambahkan `-- --apply`. Database lama hanya dibaca dan tidak dihapus. Tugas lama masuk ke modul "Umum"; komentar dan catatan waktu dipindahkan dengan timestamp aslinya; gambar bukti base64 tidak disalin ke Redis (dilaporkan agar bisa diunggah ulang); notifikasi dan log aktivitas lama tidak dipindahkan. Aman dijalankan ulang.
- **Dari Redis versi pertama Tim** (struktur tanpa sub modul): `npm run upgrade:redis` (dry run), lalu `-- --apply`. Backup database dulu.
- **Inisialisasi bersih**: cukup isi variabel lingkungan dan masuk; semua key dibuat saat dipakai.

## Test

```bash
npm test
```

- `tests/permissions.test.ts` — aturan peran
- `tests/timer.test.ts` — perhitungan waktu berbasis timestamp
- `tests/schemas.test.ts` — validasi input (termasuk penolakan field terlarang)
- `tests/redis.integration.test.ts` — data layer pada Redis sungguhan (indeks, progres saat konkurensi, satu timer per user, agregat waktu, pemindahan tugas, hapus tanpa data yatim). Berjalan hanya jika `TEST_UPSTASH_REDIS_REST_URL`/`_TOKEN` diisi — gunakan database sekali pakai.

## Catatan dan batasan

- Pencarian membaca satu hash indeks per proyek milik user; cocok untuk ukuran tim biasa, bukan pencarian teks penuh.
- Satu tampilan proyek memuat maksimal 1000 tugas.
- Notifikasi "tenggat mendekat" dibuat saat user membuka aplikasi (paling sering sekali per jam), bukan oleh cron.
- Input tanggal memakai kontrol bawaan browser, sehingga formatnya mengikuti bahasa browser.
