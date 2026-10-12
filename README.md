# jfunk42.com

Static GitHub Pages site for the jFunk42 Science Brief podcast.

It contains the podcast landing page, directory-compatible RSS feed, episode artwork, and
source-backed episode quizzes. Episode audio and per-episode artwork are hosted in Cloudflare R2
at `https://podcast.jfunk42.com/jfunk42-science-brief/`.

## Search discovery

`robots.txt` permits crawling by major web and AI crawlers and points to `sitemap.xml`. Keep the
sitemap current whenever pages are added or removed. `llms.txt` provides a concise guide to the
podcast, transcript archive, quizzes, and RSS feed for AI systems.

## Publish

Push to the `main` branch. The included GitHub Actions workflow deploys the repository root to
GitHub Pages. The `CNAME` file configures the `jfunk42.com` custom domain.
