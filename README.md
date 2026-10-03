# Tim — team management

Tim is a project management app for small teams. Work is organized as **Project → Module → Task**, with a Kanban board, a task drawer for details, comments with mentions, server-side time tracking, notifications, a calendar, and role-based permissions.

Built with Next.js 16 (App Router, Server Actions), Auth.js (NextAuth v4) with Google sign-in, and Upstash Redis as the only data store.

## Requirements

- Node.js 20.9 or newer
- An [Upstash Redis](https://console.upstash.com) database (free tier is fine)
- A Google Cloud OAuth client
- Optional: a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store for avatar and attachment uploads

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | yes | Encrypts session tokens. Generate with `openssl rand -base64 32`. `NEXTAUTH_SECRET` is also accepted. |
| `NEXTAUTH_URL` | yes | Public base URL, e.g. `http://localhost:3000` or `https://tim.example.com`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | yes | Upstash REST endpoint and token. Server-only; never exposed to the browser. |
| `BLOB_READ_WRITE_TOKEN` | no | Enables avatar and attachment uploads. Without it, upload buttons are disabled with an explanation. |

## Google OAuth setup

1. Open Google Cloud Console → **APIs & Services → OAuth consent screen** and configure an External (or Internal) app.
2. Go to **Credentials → Create credentials → OAuth client ID**, type **Web application**.
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

A user's email is marked verified when Google reports `email_verified: true`.

## Upstash Redis setup

1. Create a database at [console.upstash.com](https://console.upstash.com). Pick a region close to where the app runs.
2. On the database page, open **REST API** and copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Nothing else is needed: keys are created on first use. There are no migrations.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Open http://localhost:3000 and sign in with Google.

Other scripts:

```bash
npm run lint     # ESLint
npm run build    # production build (also type-checks)
npm start        # serve the production build
```

## Deploying to Vercel

1. Import the repository in Vercel.
2. Add the environment variables above. Set `NEXTAUTH_URL` to the production URL.
3. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth client.
4. Optional: create a Blob store in the Vercel project (Storage tab); `BLOB_READ_WRITE_TOKEN` is added automatically.
5. Deploy.

## Architecture

```
app/
  (app)/                 Signed-in area: shared layout with sidebar, timer, command palette, task drawer
    dashboard/ my-tasks/ projects/ calendar/ notifications/ profile/ settings/
    projects/[projectId]/  Overview, board, modules, tasks, activity, members, settings
  actions/               Server actions, one folder per domain (project, module, task, member, comment, timer, …)
  login/ verify/         Public pages
  api/auth/[...nextauth] Auth.js route
lib/
  redis/client.ts        Lazily created Upstash client (raw strings, no automatic JSON parsing)
  redis/keys.ts          Every Redis key, in one place
  redis/repositories/    Data access: user, project, module, task, comment, timer, notification, activity, search, verification
  domain/                Access checks, notifications, view assembly for pages
  permissions.ts         Pure role rules used by actions and UI
  auth/                  Auth options and session helpers
  storage/               Pluggable file storage (Vercel Blob adapter)
schemas/                 Zod schemas for every action input
types/                   Domain types
components/              UI primitives, layout, task, project, timer components
proxy.ts                 Optimistic auth redirect (Next.js 16 "proxy", formerly middleware)
```

Every server action follows the same steps: **authenticate** (user id from the session, never from the client) → **validate** (Zod) → **authorize** (role + archived check) → **write** through a repository → **record activity** → **notify** → **revalidate**. Actions return `{ ok: true, data }` or `{ ok: false, error, fieldErrors? }`; internal errors are logged and replaced with a generic message.

### Redis data model

| Key | Type | Contents |
| --- | --- | --- |
| `user:{id}` | hash | Profile: name, email, emailVerified, avatar, jobTitle, bio, timezone, themePreference, timestamps |
| `user_by_email:{email}` | string | User id (claimed with `SET NX`, so one account per email) |
| `user:{id}:projects` | sorted set | Project ids, scored by join time |
| `user:{id}:assigned` | sorted set | Task ids assigned to the user |
| `user:{id}:time_logs` | sorted set | Time log ids, scored by end time (weekly totals) |
| `user:{id}:notifications` / `…:unread` | sorted set / set | Notification ids (newest kept: 200) / unread ids |
| `project:{id}` | hash | Key, name, description, icon, status, owner, dates, archived, allowViewerComments |
| `project_by_key:{KEY}` | string | Project id (unique project keys) |
| `project:{id}:members` | hash | userId → role |
| `project:{id}:modules` | sorted set | Module ids, scored by display order |
| `project:{id}:tasks` | sorted set | Task ids, scored by creation time |
| `project:{id}:due` / `…:start` | sorted set | Task ids scored by due / start date (calendar range queries) |
| `project:{id}:stats` / `module:{id}:stats` | hash | `total` and `done` counters for progress |
| `project:{id}:task_seq` | string | Counter for task numbers (`WEB-12`) |
| `project:{id}:activity` | list | Activity JSON entries, newest first, capped at 1000 |
| `project:{id}:search` | hash | `task:{id}` / `module:{id}` → lowercased searchable text |
| `module:{id}` / `module:{id}:tasks` | hash / sorted set | Module fields / its task ids |
| `task:{id}` | hash | Task fields, including `trackedSeconds` |
| `task:{id}:comments` / `comment:{id}` | sorted set / hash | Comment ids / comment |
| `task:{id}:time_logs` / `time_log:{id}` | sorted set / hash | Log ids / finalized log (start, end, duration, source) |
| `task:{id}:attachments` | hash | attachmentId → metadata JSON (file bytes live in Blob storage) |
| `task:{id}:activity` | list | Task activity, capped at 200 |
| `task:{id}:watchers` | set | Users notified about comments and reviews |
| `timer:{userId}` | string | The user's running timer: `{ taskId, projectId, startedAt }` |
| `verification:{sha256(token)}` | string | Pending email verification, 24 h TTL |

Integrity rules:

- Writes that touch several keys use `MULTI` transactions.
- Status changes run in a Lua script, so progress counters stay correct under concurrent board moves.
- Deleting a task or project first removes it from its main index. Only the caller that actually removed it continues, so cleanup never runs twice.
- Deleting a project removes every module, task, comment, time log, activity list, index entry and membership, and clears timers running on it.
- Modules can only be deleted when empty. Removing a member unassigns their tasks and stops their timer in that project.
- Archived projects are read-only.

### Time tracking

A timer is one Redis key per user holding the **server** timestamp it started at. The browser never accumulates time:

- **Start** claims `timer:{userId}` with `SET NX`. Starting another task first finalizes the running timer, so there is one timer per user.
- **Stop** uses `GETDEL`, so a timer can only be stopped once. The duration is `now − startedAt`, saved as a time log, and added to the task total in the same transaction.
- **Display**: the elapsed clock is computed as `serverAlignedNow − startedAt` on each tick. Background-tab throttling, sleep, navigation and reloads don't affect it. After a reload, the layout reads the timer from Redis again.
- Manual entries can be added and deleted from the task drawer.

### Roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including deleting the project and appointing leads |
| Lead | Edit project settings, manage modules and tasks, add/remove members and viewers, archive |
| Member | Create tasks, edit tasks they created, are assigned to, or that are unassigned; comment; track time |
| Viewer | Read only. Can comment if the project enables "Viewers can comment" |

Rules live in `lib/permissions.ts` and are enforced in every server action. The UI uses the same functions only to hide controls.

## Notes and limitations

- Sign-in is Google only. The email verification infrastructure (`verification` repository, `/verify` page and action) is in place for a future email sign-in flow, which needs an email provider.
- Search reads one small index hash per project the user belongs to. That is fine for typical team sizes; very large workspaces would benefit from Upstash Search.
- Project views load up to 1000 tasks per project.
- "Deadline approaching" notifications are generated when the user opens the app (at most once an hour), not by a background job.
