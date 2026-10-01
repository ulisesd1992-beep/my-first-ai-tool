# Review Responder

Paste a Google review for your restaurant and get **3 reply options**, each in **English and Spanish**, in the tone you pick (professional, friendly, or funny).

Built with Next.js 14 (App Router), Tailwind CSS, and the OpenAI API.

## Features

- Textarea for the review, plus an optional restaurant name
- Tone selector: Professional / Friendly / Funny
- 3 distinct replies, each with English + Spanish versions
- One-click copy buttons
- History saved in your browser (`localStorage`, last 20) — click an entry to restore it

## Getting started

Requires Node.js 18.17 or newer.

```bash
npm install
```

### Add your OpenAI API key

1. Get a key at <https://platform.openai.com/api-keys>.
2. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

3. Open `.env.local` and replace the placeholder:

   ```
   OPENAI_API_KEY=sk-...your real key...
   ```

4. (Optional) Pick a different model with `OPENAI_MODEL=gpt-4o` — the default is `gpt-4o-mini`.

`.env.local` is in `.gitignore`, so your key won't be committed. The key is only read on the server (`app/api/generate/route.ts`) and is never sent to the browser.

> If you change `.env.local` while the dev server is running, restart it.

### Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

## Project structure

```
app/
  api/generate/route.ts   # Server route that calls OpenAI
  page.tsx                # Landing page + UI (client component)
  layout.tsx
  globals.css
```

## Deploying

On Vercel (or any host), set `OPENAI_API_KEY` as an environment variable in the project settings, then deploy.
