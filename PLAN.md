# GitHub Pages Build Fix Plan (Updated)

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
