# Deploying Meridian

Meridian has two parts:

| Part | Folder | Host |
|---|---|---|
| React UI | `web/` | Vercel |
| Express + SQLite API | `server/` | Railway (Docker + volume) |

## Why not everything on Vercel?

Vercel Functions run on an ephemeral filesystem. SQLite needs a persistent file, so a
SQLite database cannot live on Vercel. Vercel's own guide says the same:
<https://vercel.com/kb/guide/is-sqlite-supported-in-vercel>

The UI itself deploys to Vercel perfectly. The API and database stay on a host that
supports a persistent volume.

---

## 1. Deploy the API on Railway

1. Push this repository to GitHub (already configured).
2. Go to <https://railway.app/new> → **Deploy from GitHub repo** → select the repo.
3. Railway detects the root `Dockerfile` automatically.
4. Open the service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `AUTH_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
   | `DB_PATH` | `/data/meridian.db` |
   | `CORS_ORIGIN` | `https://your-app.vercel.app` (add later, after step 2) |

5. Open **Settings → Volumes** → add a volume mounted at **`/data`**.
   This keeps the SQLite file across restarts and redeploys.
6. Open **Settings → Networking** → **Generate Domain**.
7. Verify: `https://your-api.up.railway.app/api/health` should return
   `{"ok":true,"service":"meridian",...}`.

The server creates the schema and seeds the demo workspace automatically when the
database is empty, so no separate seed command is needed.

> Without the `/data` volume the demo still runs, but its data resets whenever Railway
> restarts the service.

## 2. Deploy the UI on Vercel

1. Go to <https://vercel.com/new> → import the same GitHub repository.
2. Configure the project:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `web` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | `npm install` |

3. Add an environment variable:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-api.up.railway.app/api` |

4. Click **Deploy**. Vercel gives you `https://your-app.vercel.app`.

5. Go back to Railway → **Variables** → set
   `CORS_ORIGIN=https://your-app.vercel.app` and redeploy the service.

Vite reads `VITE_API_URL` at build time, so changing it later requires a redeploy on
Vercel (Deployments → Redeploy).

## 3. Demo accounts

The database seeds with fictional data on first boot. Password: `demo1234`.

| Role | Email |
|---|---|
| Employee | `elena.rossi@meridian.io` |
| Manager | `james.rivera@meridian.io` |
| Senior Manager | `sarah.chen@meridian.io` |
| Administrator | `maya.patel@meridian.io` |

## Local production check

```powershell
npm run build
npm start
# open http://localhost:4000
```

`server/src/app.js` serves `web/dist` when it exists, so a single Express process can
host the whole app outside Vercel.

## Alternative: full Vercel

Running everything on Vercel requires replacing SQLite with a hosted database
(Vercel Postgres/Neon or Turso). The current data layer is synchronous, so every query
call site in `server/src` would need an async rewrite. That is a larger project, not a
configuration change.
