<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4f17fc05-3b4c-4ada-993e-e41eb5769f09

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your environment.
4. In Supabase, open **SQL Editor** and run [supabase/schema.sql](supabase/schema.sql) once to create the required tables, policies, and `interview-videos` storage bucket.
5. Run the app:
   `npm run dev`
