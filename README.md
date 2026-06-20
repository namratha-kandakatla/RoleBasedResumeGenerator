# Role Based Resume Generating Platform

A resume generation platform that keeps an uploaded resume template as the base document, fills marked placeholders with JD-driven project narratives, and sends the completed resume to an external AI service for ATS analysis.

## Run Locally

The resume generator can be served as a static site, but external ATS analysis requires the Vercel API function.

1. Copy `.env.example` to `.env.local`.
2. Add an OpenAI API key to `OPENAI_API_KEY`.
3. Keep `OPENAI_MODEL=gpt-5.4-mini` or set another Responses API model that supports structured outputs.
4. Run the app through Vercel development tooling so `/api/ats-score` is available.

Without the server API key, resume generation and DOCX export continue to work, but the interface clearly reports that external ATS analysis is unavailable. It does not display a locally estimated ATS score.

## Main Files

- `index.html` - application layout
- `styles.css` - UI styling
- `app.js` - resume generation, template parsing, DOCX placeholder replacement, and download logic
- `api/ats-score.js` - server-side OpenAI Responses API integration for ATS analysis
- `vercel.json` - static hosting and Vercel Function configuration

## Vercel Deployment

Add `OPENAI_API_KEY` in the Vercel project environment variables before deployment. `OPENAI_MODEL` is optional and defaults to `gpt-5.4-mini`.

From this folder:

```bash
npx vercel --prod
```

If this is your first Vercel deploy, the CLI will ask you to log in and confirm the project settings. Use the current folder as the project root. The configured build copies the frontend into `public/` and deploys `api/ats-score.js` as a server function.

After deployment, Vercel will show a production URL like:

```text
https://your-project-name.vercel.app
```

## GitHub Push

From this folder:

```bash
git init
git add .
git commit -m "Initial resume platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## Static Hosting Note

GitHub Pages or a basic static server can host the resume generator, but cannot run the ATS API endpoint. Use Vercel or another serverless Node.js host for the complete workflow.
