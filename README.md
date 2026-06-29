# UGC Avatar Generator

Avatar and product package studio for Vercel. The app creates named reusable
packages, builds strong prompts, imports images from Google Flow or ChatGPT
Image 2 through a Chrome extension, and uploads selected packages to a connected
Higgsfield account.

## What this MVP does

- Stores two package groups: `Avatars` and `Products`.
- Builds prompts for portraits, full-body references, pose sheets, expression
  sheets, product packshots, product style sheets, and avatar + product UGC.
- Uses a Chrome extension as a browser bridge for Google Flow and ChatGPT.
- Imports selected generated images back into the correct package session.
- Uploads selected package images to Higgsfield using the existing account
  connection.
- Supports Supabase Auth approval when configured, and local demo mode when not.

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Without Supabase env vars the app runs in demo mode with a local super user.

## Vercel env vars

Required for real auth and approval:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAILS=your@email.com
```

Run `src/api/schema.sql` in Supabase SQL editor before enabling real users.

No OpenAI or Gemini API key is required for this MVP. Generation happens in
Google Flow or ChatGPT through the user's own logged-in browser account.

## Chrome extension

1. Open Chrome `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Open the app, create/select a package, and click **Open in Google Flow** or
   **Open in ChatGPT** from Prompt Builder.

The extension:

- remembers the active package/session;
- pastes the prepared prompt into Flow or ChatGPT;
- detects large generated images in the active tab;
- adds **Save to App** buttons;
- imports the selected image into the active package.

## Higgsfield upload

Connect Higgsfield in Settings, then open Library and click:

```text
Upload package to Higgsfield
```

The app uploads images with Higgsfield `media_upload` and `media_confirm`, then
saves returned media URLs in the package metadata.

## Notes

- `Remove from server` is intentionally disabled until a real image bucket such
  as Supabase Storage, Cloudflare R2, or Vercel Blob is connected.
- The extension is a user-controlled browser helper, not a private API scraper.
- Google Flow and ChatGPT UI changes may require extension selector updates.

