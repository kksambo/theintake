# The Intake

[The Intake](https://theintake.co.za) helps people find open jobs across South Africa and beyond.

Visitors can search by role, company, or place, narrow results with filters, browse job cards with company logos, open a full listing, and apply through the employer’s own link. They can also build a CV or cover letter and download it as PDF or Word.

## Job pages

Each role has a static page at `/jobs/<slug>/` so Google can crawl it and read schema.org `JobPosting` markup. `scripts/generate_job_pages.py` builds those pages, `sitemap.xml`, and `robots.txt` from `jobs.json`. The homepage cards link to the same slugs (`job-slug.js`).

GitHub Pages serves the `main` branch root at [theintake.co.za](https://theintake.co.za/). There is no separate build server, so the pages are committed. `.github/workflows/regenerate-job-pages.yml` runs on every push to `main` that changes `jobs.json` (the Monday feed update). It rebuilds the pages and commits them with the Actions token. That commit does not change `jobs.json`, and a `GITHUB_TOKEN` push does not start another workflow run, so it does not loop. Roles removed from `jobs.json` have their directories deleted.

`validThrough` is the UTC date the generator runs, plus 30 days. It moves forward on each rebuild while the role stays in the feed. A filled role is removed by deleting its page.

Regenerate locally with:

```bash
python3 scripts/generate_job_pages.py
python3 scripts/test_generate_job_pages.py
```

One-time setup: in the repo, open Settings → Actions → General → Workflow permissions and select **Read and write permissions**. In [Google Search Console](https://search.google.com/search-console), add `https://theintake.co.za/sitemap.xml`. The Indexing API is optional and not wired up; the sitemap is what this repo submits.
