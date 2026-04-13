# GitHub Pages Build Fix Plan (Updated)

---

## Admin Panel Setup Plan — GitHub Pages + Sveltia CMS Auth

**Goal:** Make `/admin/` a fully working CMS where only you (the repo owner) can log in via GitHub and create/edit posts from a browser.

### Step 1: Create a GitHub OAuth App
**Action (manual, by you):**
- Go to **GitHub > Settings > Developer settings > OAuth Apps > New OAuth App**
- Fill in:
  - **Application name:** `Emad Blog CMS`
  - **Homepage URL:** `https://emadbeshai365.github.io`
  - **Authorization callback URL:** *(will be set in Step 3 after deploying the auth proxy)*
- Save the **Client ID** and generate a **Client Secret**

### Step 2: Deploy the Sveltia CMS Auth proxy to Cloudflare Workers
**Action (by Copilot):**
- Use the `sveltia/sveltia-cms-auth` Cloudflare Worker template
- Deploy to your free Cloudflare account
- Configure the Worker's environment variables with the GitHub Client ID and Client Secret from Step 1

### Step 3: Update GitHub OAuth callback URL
**Action (manual, by you):**
- Go back to the GitHub OAuth App created in Step 1
- Set the **Authorization callback URL** to the Cloudflare Worker URL (e.g. `https://your-worker.workers.dev/callback`)

### Step 4: Replace Decap CMS with Sveltia CMS in `/admin/`
**Action (by Copilot):**
- Update `admin/index.html` to load Sveltia CMS instead of Decap CMS (single `<script>` tag change)
- Update `admin/config.yml` to add the `base_url` pointing to the Cloudflare Worker auth proxy

### Step 5: Commit, push, and verify
**Action (by Copilot):**
- Commit the changes and push to `main`
- You visit `https://emadbeshai365.github.io/admin/`, click "Login with GitHub," authorize the OAuth app, and test creating a draft post

### Why Sveltia CMS over Decap CMS
- Drop-in replacement (same `config.yml` format, same `/admin/` mount)
- Lighter JS bundle, faster load
- Actively maintained with a purpose-built Cloudflare auth proxy
- Free Cloudflare Workers tier = 100K requests/day (more than enough)

### Security Model
- The `/admin/` page is static HTML — anyone can *see* it, but cannot do anything without authenticating
- Authentication goes through GitHub OAuth — only users with **write access** to your repo can commit
- The OAuth secret lives in Cloudflare Worker env vars, never exposed client-side
- You are the sole repo owner, so only you can log in and publish

### Prerequisites (before starting)
1. A free Cloudflare account (sign up at cloudflare.com if you don't have one)
2. Complete Step 1 (create the GitHub OAuth App) and share the Client ID (keep the Secret for Step 2)

---

## Build Issues Identified and Fixed

### Round 1 - Encoding and Line Endings
- Windows ANSI encoding corrupted UTF-8 special characters
- CRLF line endings confused Jekyll YAML parser on Linux runner
- Fix: Normalised all files to LF, replaced corrupted characters

### Round 2 - Invalid Liquid Filters
- limit used as a pipe filter in assign tags, but limit is only a for loop parameter
- Fix: Replaced with slice: 0, N (valid Liquid array filter)
- Also: Cleaned duplicate gems in Gemfile, added include: [_pages]

### Round 3 - Comprehensive Audit (Current Fix)

1. Replaced slice in assign tags with for loop limit:N parameter (home.html, post.html, sidebar.html)
2. Replaced HTML entity middot in YAML title with actual UTF-8 middle dot (_config.yml, index.html)
3. Replaced HTML entity middot in post front matter series field (premature-microservices.md, multi-tenant-architecture.md)
4. Replaced HTML entity mdash inside fenced code blocks with actual UTF-8 em-dash (premature-microservices.md)
5. Added empty Jekyll front matter to admin/index.html
6. Created .gitattributes enforcing eol=lf for all text files

## Architecture
- Generator: Jekyll 3.10.0 via github-pages v232
- Hosting: GitHub Pages project site at /PowerPlatformBlog
- CMS: Decap CMS at /admin
- Plugins: jekyll-feed, jekyll-sitemap, jekyll-seo-tag
- Theme: Custom layouts override default primer theme
