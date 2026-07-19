# Free deployment on Vercel

STATE OF PLAY is a Vite SPA with Node serverless functions in `api/`. Vercel can deploy both from one repository.

## 1. Push the repository to GitHub

Never commit `.env`; it is ignored. Only `.env.example` belongs in Git.

## 2. Import it into Vercel

1. Sign in at <https://vercel.com/new> with GitHub.
2. Import the STATE OF PLAY repository.
3. Keep Framework Preset as **Vite**.
4. Keep Build Command as `npm run build` and Output Directory as `dist`.

## 3. Add server-side environment variables

In **Project Settings → Environment Variables**, add these for Production, Preview, and Development:

```text
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_DAILY_CALL_LIMIT=200
OPENROUTER_SITE_URL=https://your-project.vercel.app
```

`SERPAPI_KEY` is optional. Without it, the news endpoint still uses keyless sources and bundled seed data.

Do not prefix secrets with `VITE_`; that would expose them to the browser bundle.

## 4. Deploy

Select **Deploy**. Every later push to the connected GitHub branch creates a new deployment automatically.

After adding or changing an environment variable, redeploy because Vercel variables apply only to new deployments.

## 5. Judge links

- Normal game: `https://your-project.vercel.app/`
- Clean presentation run: `https://your-project.vercel.app/?demo=1`

Before submitting, test `/api/news`, one US decision, the Caracas perspective switch, one Venezuela decision, and the two-chair debrief on the production URL.
