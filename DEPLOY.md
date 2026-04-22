# Deploying Hit Inspector to Vercel

Result: a public URL like `hit-inspector-xyz.vercel.app` that you can send
to anyone. They open it in a browser and see the full inspector with a
snapshot of your Hit Engine data baked in.

## One-time setup

### 1. Bake the snapshot locally

Open a terminal in `C:\hit-inspector\` and run:

```
npm run snapshot
```

This reads your current `C:\hit-engine\src\App.jsx` and writes a frozen
copy of the catalog data to `public/data.json`. You'll see output like:

```
Reading: C:\hit-engine\src\App.jsx
Wrote: C:\hit-inspector\public\data.json
  2.22 MB source
  23/23 constants extracted
Done. You can now run: npm run build
```

### 2. Create a GitHub repo for the inspector

Go to https://github.com/new — create a new repo called `hit-inspector`.
Keep it public (Vercel's free tier works with public repos).

In the terminal:

```
cd C:\hit-inspector
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hit-inspector.git
git push -u origin main
```

### 3. Deploy on Vercel

1. Go to https://vercel.com — sign in with your GitHub account
2. Click "Add New…" → "Project"
3. Select your `hit-inspector` repo from the list
4. Framework Preset: Vite (Vercel should auto-detect)
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click "Deploy"
8. Wait ~60 seconds
9. Vercel shows you the live URL (something like `hit-inspector-abc.vercel.app`)

### 4. Send the URL to your partner

Done. They open the URL, see the full inspector. No install needed.

## Updating the data after changes to Hit Engine

When you edit `C:\hit-engine\src\App.jsx` and want the inspector to show
the updated data:

```
cd C:\hit-inspector
npm run snapshot
git add public/data.json
git commit -m "Refresh snapshot"
git push
```

Vercel auto-redeploys in ~90 seconds. Your partner just refreshes the URL.

## Running locally (still works)

```
cd C:\hit-inspector
npm run dev
```

Dev mode reads `C:\hit-engine\src\App.jsx` live from disk via the Vite
plugin. You don't need to run `npm run snapshot` for dev — only for deploy.

## Troubleshooting

**"Could not find Hit Engine App.jsx" during snapshot:**
Set the path explicitly:
```
set HIT_ENGINE_PATH=C:\hit-engine\src\App.jsx
npm run snapshot
```

**Deployed site shows "Cannot read Hit Engine source":**
You forgot to run `npm run snapshot` before pushing. The `public/data.json`
file isn't in your git repo. Run snapshot, commit, push.

**Partner sees old data after update:**
Browser cache. Have them hard-refresh (Ctrl+F5 on Windows, Cmd+Shift+R on Mac).

**Want the URL to be private?**
Vercel's free tier doesn't support password protection. Options:
- Upgrade to Pro tier ($20/month) and enable password protection
- Use a different host that supports basic auth for free (Netlify, Cloudflare Pages)
- Use ngrok instead (local tunnel, temporary URL)
