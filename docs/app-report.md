# UGC Avatar Generator App Report

Report date: June 29, 2026

Live app: https://ugc-avatar-generator-three.vercel.app/

Public report: https://ugc-avatar-generator-three.vercel.app/app-report.html

Repository: https://github.com/abderrahimchadli/ugc-avatar-generator

Inspiration video: https://www.youtube.com/watch?v=jZJjop9VsxQ

## Project Note

Abderrahim decided to make this app after watching the video above. The idea is
to build something that may help AI creators organize avatar and product image
references, generate content through connected browser accounts, and prepare
assets for Higgsfield workflows.

The app is still not ready as a finished product. It needs more development,
more live testing, and more help organizing the work into clear phases before it
can be considered stable.

## What The App Does Now

- Creates two package groups: avatars and products.
- Saves named packages under the active user account.
- Builds reusable prompts for avatar portraits, pose sheets, expression sheets,
  product packshots, product style sheets, and avatar-with-product images.
- Uses a Chrome extension to open Google Flow or ChatGPT Images with an active
  package session.
- Lets the extension paste prompts, detect generated images, and save selected
  images back into the app package.
- Keeps extension imports linked to the user who started the generation session.
- Shows a Library with search, grouping, sorting, recent images, storage
  estimate, image removal, and package-level Higgsfield asset status.
- Connects to Higgsfield through OAuth.
- Includes an experimental Higgsfield Marketing Studio asset flow with
  workspace diagnostics. It is not yet proven as a reliable visible upload into
  the Higgsfield website library.
- Supports local demo users and Supabase-backed user approval when configured.
- Runs on Vercel for testing.

## Current Status

The app is an MVP/prototype. The main structure is working locally and deployed
on Vercel, but the most important external workflows still need full live
testing with real connected accounts.

Latest verified checks:

- Unit and integration tests: `npm test` passes.
- Production build: `npm run build` passes.
- Vercel deployment: production alias is live.
- Higgsfield FNF proxy route is deployed and protected; it returns auth errors
  without a valid Higgsfield token, which is expected.
- The Higgsfield workspace/asset path is now treated as experimental because the
  connected OAuth/API path may not expose the required workspace ID or public
  image URL.

## Main Problem Still Needing Testing

The biggest remaining problem is live end-to-end testing across third-party
websites and accounts.

Google Flow, ChatGPT Images, and Higgsfield can change their UI or API behavior.
The app and extension have logic for these flows, but the full path must be
tested from start to finish:

1. Create a package in the app.
2. Open Google Flow or ChatGPT Images from Prompt Builder.
3. Paste the prompt with the extension.
4. Generate an image.
5. Save that generated image back to the correct app account and package.
6. Open Library.
7. Run Higgsfield workspace diagnostics.
8. Create the Higgsfield Marketing Studio asset if the diagnostics show a usable
   workspace.
9. Confirm that the asset appears and is usable inside the connected Higgsfield
   account.

The Higgsfield asset creation step is currently the main blocker. The app can
connect through OAuth, but Marketing Studio creation depends on a workspace ID
and a public image URL that may not be exposed by the private FNF endpoints.

## What Is Working

- The app builds and deploys on Vercel.
- Demo accounts work locally for quick testing.
- The account approval model exists.
- Packages are separated by account.
- Library can show, sort, search, and remove package images.
- Extension imports are guarded so another user's image is not silently saved
  into the wrong account.
- ChatGPT Images opens at `https://chatgpt.com/images`.
- Google Flow model preference defaults to Nano Banana Pro.
- The old misleading "prepared Higgsfield reference" flow was replaced with
  the new "Create Higgsfield asset" flow.
- Higgsfield errors now explain missing workspace IDs and missing public image
  URLs instead of reporting a false success.

## What Still Needs Live Testing

- Google Flow prompt insertion, especially Slate editor state detection.
- Google Flow Nano Banana Pro model selection.
- Google Flow generate button click behavior.
- ChatGPT Images prompt insertion.
- ChatGPT Images generate button click behavior.
- Extension save button detection on generated image results.
- Save-to-app flow after logout/login.
- Supabase account persistence after logout/login on production.
- Image removal from local state and server state.
- Higgsfield OAuth connection on production.
- Whether Higgsfield exposes a workspace ID for the connected account.
- Whether Higgsfield returns a public image URL after media upload.
- Higgsfield Marketing Studio avatar creation with a real avatar package.
- Higgsfield Marketing Studio product creation with a real product package.
- Whether created Higgsfield assets appear exactly where expected in the
  Higgsfield website.
- Large image storage behavior on Vercel/Supabase limits.
- Multi-user testing where two people generate at the same time.

## What Still Needs Development

- Real image file storage using Supabase Storage, Vercel Blob, Cloudflare R2, or
  another bucket. Base64 images inside records are not enough for scale.
- Stronger production authentication and role management.
- Better admin screens for approving, blocking, and auditing users.
- More visible asset history: created asset ID, date, type, selected images, and
  error logs.
- A reliable Higgsfield upload strategy: official asset API support, a verified
  workspace ID source, or a browser-based Higgsfield upload bridge.
- A proper setup checklist for Supabase, Vercel, extension install, and
  Higgsfield connection.
- Extension packaging/versioning so users know when they must update.
- Full browser E2E tests for the app and extension.
- A clear roadmap separating MVP, beta, and production phases.
- More polished UI for package organization, naming, duplicate detection, and
  bulk actions.
- Better storage quota warnings and cleanup tools.
- Privacy/security review for extension permissions, OAuth tokens, and
  third-party proxy routes.

## Suggested Next Work Plan

1. Test the app with one avatar package end to end.
2. Test the app with one product package end to end.
3. Confirm Higgsfield Marketing Studio assets appear in the connected account.
4. Add real object storage for images.
5. Add live E2E test scripts for the extension and app.
6. Improve the Library asset history and error logs.
7. Clean up onboarding so a new user knows exactly what to install, connect,
   and test.
8. Decide whether the extension remains local-only or should later become a
   published Chrome Web Store extension.

## Honest Product Readiness Verdict

This app is useful as a prototype and development base. It is not ready yet as a
finished production tool.

The core idea is strong: organize avatar and product references, let the user
generate in their own browser accounts, then save and prepare assets for
Higgsfield workflows. The next milestone is proving the full live workflow with
real accounts and real assets, then improving storage, reliability, and user
onboarding.
