# Knoll

A poster-style board of affiliate products, arranged like a knolling photograph. Every object is an isolated transparent PNG; clicks land on visible pixels only and open the retailer.

The working name was **Flatlay**. Knoll is shorter and names the layout technique.

- Public board: `/`
- User accounts: `/login`, `/me`, `/u/:username`
- Admin (password-protected): `/admin` and `/admin/login`

The composition lives in a fixed canvas space (2400×3600, growing downward as items are placed lower). The stage is scaled to the viewport **width**, then you scroll vertically — the same idea as shrinking a poster, not reflowing a grid. If you keep stacking items down the board, scrolling continues.

## Local demo (`npm run dev`)

No cloud credentials are required to try the empty board and the add/arrange flow.

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). The public board is empty. Sign in at `/admin/login` with any email and password — local demo mode stores items in IndexedDB.

Drop a **transparent PNG** (real alpha, not a white background) plus an affiliate URL to place the first object. Drag, resize, and rotate; changes save on release.

When you are ready to persist for real, add credentials (below) and restart the dev server.

## Environment

Copy `.env.example` to `.env` and fill in what you have:

| Variable | Where it is used |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser Supabase client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser publishable key (`sb_publishable_…`). `VITE_SUPABASE_ANON_KEY` still works as an alias |
| `VITE_R2_PUBLIC_BASE_URL` | Optional public R2 base (`https://pub-….r2.dev`). If empty, images are served by `/api/images/:key` |
| `VITE_AMAZON_ASSOCIATE_TAG` | US Associates id (default `typologynetwo-20`). Stamped onto amazon.com product URLs as `?tag=` |
| `VITE_AMAZON_ASSOCIATE_TAG_DE` | German Associates id (default `typologynetwo-21`). Stamped onto amazon.de product URLs |
| `SUPABASE_URL` | Pages Function auth check |
| `SUPABASE_ANON_KEY` | Pages Function auth check |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Optional. Lets `npm run dev` upload to real R2 instead of `public/dev-uploads/` |

Vite only inlines `VITE_*` into the client bundle. Function secrets stay on the server.

## Supabase

1. Create a project (or use an existing one).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. That creates `public.items` with public `select` and admin-only writes. Writes are allowed if the user is in `public.admin_users` (`app_private.is_admin()`) **or** JWT `app_metadata.role` is `admin`.
3. Authentication → enable Email provider. Create the first admin user.
4. Add them to `admin_users` (this project's existing admin table):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Alternatively, set JWT app metadata (user must sign in again afterwards):

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'you@example.com';
```

### User accounts (magic link + Google)

Consumer auth is separate from `/admin/login`. In the Supabase dashboard:

1. Authentication → Providers → enable **Email** with magic links (OTP).
2. Enable **Google** and add the client id/secret from Google Cloud.
3. Authentication → URL configuration → add these redirect URLs:

```
http://127.0.0.1:5173/login
http://localhost:5173/login
https://typology.network/login
```

Also set the site URL to the production origin.

Usernames live on the existing `public.profiles` row (`id = auth.users.id`). Shipping fields stay private. Public pages read `public.profile_handles` only (`username`, `display_name`). Per-user boards live in `user_boards` / `user_board_items` (not the shop `items` table). SQL is in `supabase/migrations/`.

User board routes: `/me`, `/u/:username`, `/u/:username/:slug`, `/s/:shareToken`. For account deletion to remove the Auth user, set `SUPABASE_SERVICE_ROLE_KEY` on the Pages Function.

## Cloudflare R2

1. Create a bucket named `knoll-items` (or change `bucket_name` in `wrangler.jsonc` to match).
2. Either:
   - **Public bucket** — enable public access, copy the `pub-….r2.dev` URL into `VITE_R2_PUBLIC_BASE_URL`, and add a CORS rule allowing `GET` from your site (and `http://localhost:5173`) so Konva can read pixels for hit-testing, or
   - **Private bucket** — leave `VITE_R2_PUBLIC_BASE_URL` empty; the Pages Function at `/api/images/:key` streams objects and sends CORS headers.
3. Bind the bucket to the Pages project as `IMAGES` (already declared in `wrangler.jsonc`). The bucket name in config is `knoll-items`.

## Cloudflare Pages

Build command: `npm run build`  
Output directory: `dist`  
Pages Functions live in `functions/` and deploy with the project.

Set these on the Pages project (Settings → Variables and Secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_R2_PUBLIC_BASE_URL` (optional)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

R2 credentials are **not** needed on Pages if the `IMAGES` binding is attached — the upload function uses the binding, not S3 keys.

From this repo (needs Wrangler on your machine):

```bash
npx wrangler pages deploy dist
```

Or connect the git repo in the Pages dashboard.

After deploy, confirm `/api/upload` is a Function route (not the SPA `index.html`).

## How the board works

- Canvas coordinates: `x`/`y` are the **center** of each PNG in the 2400-wide poster space. `scale` multiplies natural pixel size. `rotation` is degrees.
- Public clicks use Konva `cache()` + `drawHitFromCache()`, so only non-transparent pixels hit. Outbound links use `rel="nofollow sponsored noopener"`.
- Admin edits commit on drag-end / transform-end / slider release, not on every frame.
- Clicking an object in admin bumps `z_index` to the front. The inspector can send it to the back.
- The board height grows when items sit near the bottom, so a long list becomes a long scroll.

## v1 follow-ups (not built)

- Pagination if the board ever holds thousands of objects (everything is fetched today)
- Drop shadows that do not inflate the hit mask
- Auto-downsizing huge source PNGs on upload
- Undo, snap guides, duplicate
- Categories, search, analytics
- Admin UI for inviting extra admins
- Keyboard navigation of products on the public board
