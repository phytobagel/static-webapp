# static-webapp

## Local development

After `npm install`, run `npm run dev` to serve the site at [http://localhost:8080](http://localhost:8080) (add that URL to Supabase **Redirect URLs** if you use magic-link sign-in locally).

## Supabase connection

The app talks to Supabase from the browser using `js/supabase-config.js`. Configure that file and apply the database schema in the Supabase dashboard.

### 1. Create or open a project

In [Supabase](https://supabase.com/dashboard), create a project (or open an existing one) and wait until it is ready.

### 2. Add the API URL and anon key

1. In Supabase: **Project Settings** → **API**.
2. Copy **Project URL** — it must look like `https://YOUR_PROJECT_REF.supabase.co` (not your Azure Static Web Apps or GitHub Pages URL).
3. Copy the **anon public** key (long JWT string, starts with `eyJ`).

Edit `js/supabase-config.js` and set:

- `supabaseUrl` — the Project URL
- `supabaseAnonKey` — the anon public key

Commit and deploy so the hosted site loads the updated config.

### 3. Apply the database schema

**Option A — Supabase CLI (recommended if this repo is linked):** from the project root, after `npm install` and `supabase link` (see [Supabase CLI](#supabase-cli-from-this-repo)):

```bash
npm run supabase -- db push
```

That applies SQL under `supabase/migrations/` to your linked project.

**Option B — Dashboard:** open **SQL Editor** → **New query**, paste `supabase/schema.sql`, and **Run** (or run only sections not yet applied).

Either path creates the app tables, indexes, and row-level security policies expected by the frontend.

### Data model notes

The app stores QR reads in `public.qr_scans`. The **`content`** column is the raw scanned string. Going forward, that value is intended to be the **name of a storage location** (the same identifier you use for locations elsewhere).

`public.storage_locations` holds rows for each location (`name`, timestamps, optional `user_id`). It exists alongside scans; the app does not require a foreign key from `qr_scans` to `storage_locations`. If you later want strict matching (every scan must reference a real location row, or renames should propagate), you can add a `storage_location_id` column and migrate—nothing in this repo enforces that yet.

### 4. Configure authentication URLs

So magic-link sign-in redirects to your real site:

1. **Authentication** → **URL Configuration**.
2. Set **Site URL** to your deployed app origin (for example `https://your-app.azurestaticapps.net`).
3. Under **Redirect URLs**, add the same URL (and any local dev URLs you use, e.g. `http://localhost:8080`).

### 5. Optional hardening

After invited users have accounts: **Authentication** → **Providers** → **Email** → you can disable **Allow new users** if you want to stop open signups.

---

## Supabase CLI (from this repo)

Global `npm install -g supabase` is **not supported** by Supabase and will fail. Use the CLI bundled as a dev dependency:

1. **Install dependencies** (once, or after cloning):

   ```bash
   npm install
   ```

2. **Run the CLI** from the project root — pass through any Supabase subcommand after `--`:

   ```bash
   npm run supabase -- --version
   npm run supabase -- login
   npm run supabase -- link --project-ref YOUR_PROJECT_REF
   ```

   The project ref is the subdomain in your Supabase URL (`https://YOUR_PROJECT_REF.supabase.co`). Linking is **per machine / clone**; run `link` again on a new checkout.

3. **Apply migrations** after editing files under `supabase/migrations/`:

   ```bash
   npm run supabase -- db push
   ```

   Equivalent: `npx supabase <subcommand>` (same binary).

`supabase/config.toml` and `supabase/migrations/` are safe to commit. Generated cache under `supabase/.temp/` is gitignored.

Full command reference: [Supabase CLI](https://supabase.com/docs/reference/cli/introduction). This repo also keeps `supabase/schema.sql` for pasting into the SQL Editor if you prefer not to use migrations.
