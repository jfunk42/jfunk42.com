# jfunk42.com

Static GitHub Pages site for the jFunk42 Science Brief podcast.

It contains the podcast landing page, directory-compatible RSS feed, episode artwork, and
source-backed episode quizzes. Episode audio and per-episode artwork are hosted in Cloudflare R2
at `https://podcast.jfunk42.com/jfunk42-science-brief/`.

## Publish

Push to the `main` branch. The included GitHub Actions workflow deploys the repository root to
GitHub Pages. The `CNAME` file configures the `jfunk42.com` custom domain.
