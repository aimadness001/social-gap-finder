# Social Gap Finder

Finds construction/renovation companies with a weak social media presence — no
Instagram, or reviews complaining about their online presence — and ranks
them as sales leads.

v1 uses Google only (Places + Reviews). Yelp is not included.

## What it does

1. You enter a search term (e.g. "construction company") and a city.
2. It searches Google Places, then for each result:
   - Fetches phone/website/address.
   - Visits the website and checks for an Instagram link. No website at all
     also counts as "no Instagram."
   - Pulls up to 5 Google reviews and scans them for phrases like "no
     website," "couldn't find them online," "hard to reach," etc.
3. Results are saved to Postgres and shown in a ranked table (higher score =
   bigger social media gap = better lead for your pitch).
4. Export the current list to CSV any time.

## Deploy (using your existing GitHub + Vercel accounts)

1. **Push this folder to a new GitHub repo.**
   From inside this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/social-gap-finder.git
   git push -u origin main
   ```
   (Create the empty repo on github.com first, then use the URL it gives you.)

2. **Import into Vercel.**
   - Go to vercel.com → Add New → Project → import the GitHub repo.
   - Framework preset should auto-detect as Next.js. Click Deploy.

3. **Add a Postgres database.**
   - In your Vercel project → Storage tab → Create Database → Postgres.
   - Connect it to this project. Vercel automatically adds the `POSTGRES_URL`
     (and related) environment variables — you don't need to set these
     yourself.

4. **Add your Google API key.**
   - Vercel project → Settings → Environment Variables.
   - Add `GOOGLE_PLACES_API_KEY` = your key from Google Cloud Console (make
     sure "Places API (New)" is enabled on that project, and billing is set
     up — the free tier covers 5,000 text searches + 1,000 detail lookups a
     month).
   - Redeploy (Vercel → Deployments → ⋮ → Redeploy) so the new env var takes
     effect.

5. **Initialize the database.**
   - Open your deployed app (`your-project.vercel.app`).
   - Click "First time? Initialize database" once. This creates the
     `companies` and `reviews` tables. You only need to do this once ever
     (or again if you attach a fresh, empty database later).

6. **Run your first search.**
   - Enter a search term and city, click "Run Search."
   - Each run processes up to 15 companies (keeps each request under
     Vercel's function time limit). Run it again with a more specific query
     to reach more.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in GOOGLE_PLACES_API_KEY
npm run dev
```

Note: without a real `POSTGRES_URL` set locally, the database calls will
fail. Easiest path is to just develop against the deployed Vercel version,
or pull env vars locally with `vercel env pull`.

## Extending later

- **Add Yelp:** create `lib/yelp.ts` mirroring `lib/googlePlaces.ts`, add a
  `source: "yelp"` review insert in the search route. Schema already
  supports multiple sources per company.
- **Smarter complaint detection:** `lib/complaintDetection.ts` is currently
  keyword-based. Swap in a call to an AI API (Claude/OpenAI) for higher
  precision — just replace the body of `checkReviewForComplaint` with an API
  call and keep the same return shape.
- **Mark leads as contacted:** add a `contacted boolean` column to
  `companies` and a button in the UI to toggle it.
