# Deploying Meridian

The fastest way to give someone a link: deploy **one service** that serves both the
React UI and the Express API from the same URL. The customer just opens the link — no
GitHub, Node, install or setup on their side.

| Part | Folder | How it runs |
|---|---|---|
| React UI | `web/` | Built with Vite, served as static files |
| Express + SQLite API | `server/` | Node process, same port as the UI |

The root `Dockerfile` does the whole thing:

1. builds `web/` into `web/dist`
2. installs only the server dependencies
3. starts `node server/src/index.js`, which serves `web/dist` and `/api/*` on `$PORT`

`server/src/index.js` creates the SQLite schema and seeds the demo workspace when the
database is empty, so there is no separate seed step.

---

## Option A — Render (free, one click, fastest)

Render's free plan has an **ephemeral disk**. That is fine for a demo: the app starts,
seeds itself, and works. Data resets when the service restarts (after ~15 min idle the
free service sleeps, and it wakes on the next visit).

1. Push this repository to GitHub.
2. Open this blue-print link and sign in with GitHub:

   <https://render.com/deploy?repo=https://github.com/DaminiPatle/meridian-task-manager>

   Render reads `render.yaml` and shows a service named **meridian**.
3. Click **Apply**. Wait for the first build (~3–5 minutes).
4. Render gives you a public URL like `https://meridian-xxxx.onrender.com`.
5. Open `https://meridian-xxxx.onrender.com/api/health` → should return
   `{"ok":true,"service":"meridian",...}`.
6. Open the root URL and log in with the demo accounts below.

That URL is the link to share.

> Free services sleep after inactivity; the first visit after a sleep takes ~30 seconds
> to wake up. After that it is fast.

### Free plan directory

`render.yaml` sets `DB_PATH=/tmp/meridian.db`, which is writable on Render's free plan.
If you later upgrade to a paid plan with a disk, change it to a path inside the mounted
disk (for example `/data/meridian.db`).

## Option B — Railway (persistent data)

Railway gives you a volume, so users, tasks and approvals survive restarts and
redeploys. Use this when you want the manager to keep any changes they make.

1. Go to <https://railway.app/new> → **Deploy from GitHub repo** → select this repo.
2. Railway picks up the root `Dockerfile` (and `railway.json`).
3. Service → **Variables**:

   | Variable | Value |
   |---|---|
   | `AUTH_SECRET` | a long random string |
   | `DB_PATH` | `/data/meridian.db` |

   Generate a secret in PowerShell:

   ```powershell
   [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

4. **Settings → Volumes** → add a volume mounted at **`/data`**.
5. **Settings → Networking → Generate Domain**.
6. Verify `https://your-service.up.railway.app/api/health`.

## Option C — Vercel UI + Railway API (only if Vercel is required)

Vercel Functions have an ephemeral filesystem, so SQLite cannot live there
(<https://vercel.com/kb/guide/is-sqlite-supported-in-vercel>). The UI can still be on
Vercel while the API stays on Railway.

1. Deploy the API on Railway exactly as in Option B.
2. On <https://vercel.com/new> import this repo and set:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `web` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | `npm install` |

3. Add `VITE_API_URL=https://your-service.up.railway.app/api` (build-time variable).
4. Deploy, then set Railway's `CORS_ORIGIN` to the Vercel domain and redeploy the API.

> The single-service options above are simpler; only use this split if you specifically
> need the frontend on Vercel.

## Demo accounts

Password for every seeded account: `demo1234`.

| Role | Email |
|---|---|
| Employee | `elena.rossi@meridian.io` |
| Manager | `james.rivera@meridian.io` |
| Senior Manager | `sarah.chen@meridian.io` |
| Administrator | `maya.patel@meridian.io` |

Share the URL plus these credentials with the manager. The login page does not list
accounts or hint the password.

## Local production check

```powershell
npm run build
$env:DB_PATH = "$env:TEMP\meridian-check.db"
$env:PORT = 4000
npm start
# open http://localhost:4000
```

`server/src/app.js` serves `web/dist` when it exists, so one Express process hosts the
whole app locally too.

## Alternative: fully on Vercel

Running everything on Vercel requires replacing SQLite with a hosted database
(Vercel Postgres/Neon or Turso). The current data layer is synchronous, so every query
call site in `server/src` would need an async rewrite. That is a larger project, not a
configuration change.
