# Loopr

Social app for developers — post loops, comment, like, bookmark, follow, DM (E2EE), notifications. Built with Next.js 16 + Supabase (Postgres + Auth + Storage).

## Prerequisites

- Node.js 20+ and npm
- Git
- A Supabase project — either hosted (Option A) or local via Docker (Option B)
- For Option B: Docker Desktop running + [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

## 1. Clone and install

```bash
git clone <your-repo-url> Loopr
cd Loopr
npm install
```

## 2. Set up the database (pick A or B)

The runnable schema is `setup/schema-with-rls.sql` (tables + RLS + storage buckets/policies). `setup/schema.sql` / `setup/rls.sql` are reference only.

### Option A — Hosted Supabase (recommended)

1. Go to [supabase.com](https://supabase.com) → New project → note the project URL and anon key.
2. Open **SQL Editor → New query**, paste the full contents of `setup/schema-with-rls.sql`, run it. Re-run is safe only on a fresh project (it uses `create table`, no `if not exists`).
3. Verify: **Table Editor** shows `profiles, loops, follows, likes, comments, comment_likes, messages, key_backups, bookmarks, notifications`; **Storage** shows buckets `avatars`, `posts`, `chat_images` (all public).
4. Auth settings: **Authentication → URL Configuration** → set **Site URL** to your app URL (`http://localhost:3000` for dev) and add it under **Redirect URLs** (also add your production URL later). The app builds email redirects from `NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000`.

### Option B — Local Supabase with Docker

Runs the full Supabase stack (Postgres, Auth, Storage, Studio) in Docker containers via the CLI. No manual Postgres container needed.

```bash
# from the Loopr folder
supabase init        # once per clone (creates supabase/ folder)
supabase start       # pulls images and starts containers
supabase status     # shows API URL, anon key, Studio URL, DB URL
```

Then apply the schema:

```bash
# easiest: paste setup/schema-with-rls.sql into Studio (http://127.0.0.1:54323) → SQL Editor → run
# or via psql using the DB URL from `supabase status`:
psql "<DB-URL-from-status>" -f setup/schema-with-rls.sql
```

Useful commands:

```bash
supabase stop            # stop containers (data kept in docker volumes)
supabase stop --no-backup # stop + wipe local data
supabase db reset        # wipe + re-apply (re-run the schema file afterward)
```

## 3. Configure environment

```bash
cp .example.env.local .env.local
```

| Variable                        | Hosted value                              | Local (Docker) value from `supabase status` |
| ------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project Settings → Data API → Project URL | API URL (default `http://127.0.0.1:54321`)  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → anon public | anon key                                    |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` (dev)             | `http://localhost:3000`                     |

## 4. Run

```bash
npm run dev     # http://localhost:3000
npm run build   # production check
npm start       # serve the build
```

Sign up for a new account in the app — the `profiles` row is created on signup, then loops/comments/DMs work.

## Troubleshooting

- **Tables already exist / policy errors on re-run**: the script has no `IF NOT EXISTS` — run it on a fresh project, or drop tables first. For local: `supabase db reset`, then re-run the file.
- **`uuid_generate_v4()` not found**: the script enables `uuid-ossp` itself; if you split the file, run `create extension if not exists "uuid-ossp";` first.
- **Bucket insert fails (`storage.buckets` row exists)**: buckets were already created via Dashboard — skip those three `insert` lines.
- **Images fail to upload**: buckets `avatars` / `posts` / `chat_images` must exist and be public; check Storage policies came from the script.
- **Auth redirect goes to wrong URL**: set `NEXT_PUBLIC_SITE_URL` and the Supabase **Site URL / Redirect URLs** to the same origin.
- **Local Supabase won't start**: Docker Desktop must be running; then `supabase stop` and `supabase start` again.
