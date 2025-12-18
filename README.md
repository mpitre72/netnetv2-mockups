# Net Net V2 Mockups

This repository contains the Net Net V2 front-end prototype. It is a static, hash-routed single-page app that can be hosted directly on GitHub Pages.

## GitHub Pages Hosting Instructions (for Marc)

These steps assume the local folder is `netnet-modular` and the GitHub repo is named:

`netnetv2-mockups`

### 1. Create the repo on GitHub

1. Go to github.com and create a new repository named:

   `netnetv2-mockups`

2. Do **not** add any starter files from GitHub (no README, no .gitignore, no license).

### 2. Connect your local project to the GitHub repo

From your terminal, inside the `netnet-modular` folder:

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/netnetv2-mockups.git
git branch -M main
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 3. Turn on GitHub Pages

1. In GitHub, open the `netnetv2-mockups` repo.
2. Go to **Settings** → **Pages** (left-hand sidebar).
3. Under **Source**, choose:

   * **Deploy from a branch**
   * Branch: `main`
   * Folder: `/ (root)`
4. Click **Save**.

GitHub will build and deploy the site. After a short delay, you should see a green success message with your site URL, something like:

`https://YOUR_GITHUB_USERNAME.github.io/netnetv2-mockups/`

### 4. Shareable URL

Use that URL to share the latest Net Net screens with your team.

Any time you change the screens locally:

```bash
git add .
git commit -m "Update screens"
git push
```

GitHub Pages will automatically update the live site.

## Notes
- Entry point: `index.html` at the project root with hash-based routing (e.g., `#/auth/login`, `#/app/contacts`).
- A fallback `404.html` mirrors the shell so Pages can recover into the SPA.
- Assets and styles use relative paths for GitHub Pages compatibility.

## Build Stamp Bump
Before each Codex edit session, update the build stamp so the UI reflects the latest change:

```bash
node scripts/bump-build.js
```

This updates `build-info.js` with today’s date and the next sequence letter.
