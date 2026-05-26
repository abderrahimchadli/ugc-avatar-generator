# AI Influencer Studio

A local-first web app for building, managing, and generating AI influencers.
React + Vite frontend, Higgsfield for image & video generation, your own
Higgsfield account, your data lives in your browser.

---

## Quickest setup — with Claude Code (recommended)

The whole app was built using Claude Code; using it to install is the
zero-friction path.

1. Install **Claude Code** from [claude.com/claude-code](https://claude.com/claude-code) (use the native installer — no separate Node.js install needed).
2. Sign in with your Anthropic account.
3. In Claude Code, paste this prompt:

   > Clone https://github.com/YOUR_USER/ai-influencer to my Desktop, install dependencies, and start the dev server.

4. Open [http://localhost:5173](http://localhost:5173) in Chrome.
5. Go to **Settings** → **Connect Higgsfield** (uses your own Higgsfield credits).

That's it. To edit anything, just ask Claude Code: *"change the homepage headline,"* *"add a new vibe option,"* etc.

---

## Manual setup — if you already use Node.js

```bash
git clone https://github.com/YOUR_USER/ai-influencer.git
cd ai-influencer
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

**Requires Node.js 18+** (see `package.json` engines).

---

## Updating

- **Via Claude Code:** *"pull the latest changes."*
- **Manually:** `git pull && npm install`

Your saved data (influencers, brand deals, inspiration boards) stays in
browser localStorage and survives updates.

---

## Project structure

```
src/
  pages/           Routes: Landing, Influencers, Inspiration, BrandDeals, Create, Settings
  components/      Reusable UI: Nav, ImageGrid, MasonryGrid, Lightbox
  context/         React contexts (theme)
  utils/           Higgsfield API, OAuth, prompt builders, image helpers
  store.jsx        localStorage-backed React contexts
api/               Vercel serverless functions (proxies + image proxy)
docs/              Prompt engineering reference docs
```

---

## Deployment (optional)
   
The repo is Vercel-ready. Connect the GitHub repo at vercel.com → it
auto-detects Vite + the `api/` folder and deploys in ~60 seconds. End
users still bring their own Higgsfield account.

---

Made by Dan Kieft.
