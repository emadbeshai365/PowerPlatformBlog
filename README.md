# Emad Beshai &middot; Engineering Blog

Technical blog on software architecture, system design, and engineering craft.
Live at: **https://emadbeshai365.github.io**

## Local Development

```bash
gem install bundler
bundle install
bundle exec jekyll serve --livereload
# → http://localhost:4000
```

## Writing a New Post

**Via Admin Panel (recommended):**
1. Go to `https://emadbeshai365.github.io/admin`
2. Log in with GitHub
3. Click "New Blog Posts"
4. Fill in the fields and publish

**Via Git directly:**
- Create a file in `_posts/` named `YYYY-MM-DD-your-post-title.md`
- Add the required front matter (see any existing post as a template)
- Push to `main` &mdash; GitHub Pages auto-deploys in ~1 min

## Structure

```
_posts/          → Markdown blog posts (one file per post)
_layouts/        → Page templates (default, home, post, page)
_includes/       → Reusable partials (head, masthead, footer, sidebar)
assets/css/      → All styles in main.css
assets/js/       → main.js + search-index.json
admin/           → Decap CMS admin panel
_pages/          → Static pages (About, Contact)
_data/topics.yml → Topic/category definitions
```

## Enabling GitHub Discussions (for Giscus comments)

1. Enable Discussions on the repo: Settings → Features → Discussions ✓
2. Go to https://giscus.app, connect your repo, copy `data-repo-id` and `data-category-id`
3. Paste the values into `_includes/comments.html`

## Plugins Used

- `jekyll-seo-tag` &mdash; title, meta, OG, Twitter card, JSON-LD
- `jekyll-feed` &mdash; RSS feed at `/feed.xml`
- `jekyll-sitemap` &mdash; sitemap at `/sitemap.xml`