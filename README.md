# DSA Roadmap Graph v6

- Direct node-to-node linking with ↗.
- Move mode with ✥: click it, then drag the node anywhere on the canvas.
- Moved positions persist in localStorage.
- Remove link dialog deletes only the cross-link.
- Problem URL links are supported.
- Unlimited nested topics/pages and Other folders.

## Supabase setup

1. Copy `.env.example` to `.env` for local development.
2. Set `VITE_SUPABASE_URL` to your Supabase project URL.
3. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the Supabase Publishable key.
4. The app expects the `public.roadmap_data` table with RLS policies that restrict rows to `auth.uid() = user_id`.
5. Create your private user in Supabase Authentication → Users.

Do not put a Supabase secret/service-role key in the frontend.
