# Role Based Resume Generating Platform

A browser-based resume generation platform that keeps an uploaded resume template as the base document and fills marked placeholders with role-based summary, skills, and project experience content.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static server.

## Main Files

- `index.html` - application layout
- `styles.css` - UI styling
- `app.js` - resume generation, template parsing, DOCX placeholder replacement, and download logic
- `vercel.json` - static hosting configuration for Vercel

## Vercel v1 Deployment

This is a static website, so it can be deployed to Vercel without a backend.

From this folder:

```bash
npx vercel --prod
```

If this is your first Vercel deploy, the CLI will ask you to log in and confirm the project settings. Use the current folder as the project root. No build command is required.

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

## GitHub Pages

This app is a static website. After pushing to GitHub:

1. Open the repository on GitHub.
2. Go to Settings > Pages.
3. Set the source to `Deploy from a branch`.
4. Choose the `main` branch and `/root`.
5. Save.

GitHub Pages will publish the site after the workflow completes.
