# UGC Avatar Generator

Avatar and product package studio for Vercel. The app creates named reusable
packages, builds strong prompts, imports images from Google Flow or ChatGPT
Image 2 through a Chrome extension, and uploads selected packages to a connected
Higgsfield account.

Full app report: https://ugc-avatar-generator-three.vercel.app/app-report.html

## What this MVP does

- Stores two package groups: `Avatars` and `Products`.
- Builds prompts for portraits, full-body references, pose sheets, expression
  sheets, product packshots, product style sheets, and avatar + product UGC.
- Uses a Chrome extension as a browser bridge for Google Flow and ChatGPT.
- Imports selected generated images back into the correct package session.
- Links extension imports to the account that opened the generation session, so
  saved images land in that user's package library.
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

Vercel does not provide persistent server file storage by itself. For the free
test setup, Vercel hosts the app and Supabase stores account, package, and
package image records. A larger production setup should move image bytes to
Supabase Storage, Vercel Blob, Cloudflare R2, or another bucket.

No OpenAI or Gemini API key is required for this MVP. Generation happens in
Google Flow or ChatGPT through the user's own logged-in browser account.

## Chrome extension

1. Download `public/downloads/ugc-avatar-studio-extension.zip` from the app's
   Extension page.
2. Unzip it on the local computer.
3. Open Chrome `chrome://extensions`.
4. Enable Developer Mode.
5. Click **Load unpacked**.
6. Select the unzipped `extension/` folder.
7. Open the app, create/select a package, and click **Open in Google Flow** or
   **Open in ChatGPT** from Prompt Builder.

The extension:

- remembers the active package/session;
- pastes the prepared prompt into Flow or ChatGPT;
- detects large generated images in the active tab;
- adds **Save to App** buttons;
- imports the selected image into the active package.
- preserves the import when the app asks the user to sign in first.

## Higgsfield assets

Connect Higgsfield in Settings, then open Library and click:

```text
Create Higgsfield asset
```

The app uploads the package images through Higgsfield's media endpoint, then
creates a Marketing Studio avatar or product asset. The returned asset ID is
saved on the package so the Library shows which packages have been sent to
Higgsfield for reuse in ad and video workflows.

## Notes

- Library removes image records locally and from Supabase when Supabase is
  configured. A real image bucket is still recommended for high-volume storage.
- The extension is a user-controlled browser helper, not a private API scraper.
- Google Flow and ChatGPT UI changes may require extension selector updates.
