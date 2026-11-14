# The Intake

**The Intake** is a professional job search platform for discovering open roles across South Africa and beyond.

**Live site:** [https://theintake.co.za](https://theintake.co.za)

## Features

- Fast keyword search by title, company, or location
- Filters for category, industry, location, and listing board
- Clean job cards with company logos
- Detailed job view with direct apply links
- Mobile-friendly, responsive layout

## Stack

Static site — HTML, CSS, and JavaScript. Listings load from `jobs.json`.

## Local development

```bash
cd theintake
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Updating listings

Replace `jobs.json` with your latest weekly export (same schema). Keep the filename as `jobs.json` so the site keeps loading without code changes.

## GitHub Pages + custom domain

This repository is configured for GitHub Pages with the custom domain **theintake.co.za** (see `CNAME`).

### 1. Enable Pages

1. Open the repo on GitHub → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` / `/ (root)`
4. Save — GitHub will pick up `CNAME` automatically

### 2. Point DNS for `theintake.co.za`

At your domain registrar, add:

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| CNAME | `www` | `kksambo.github.io` | 3600 |

After DNS propagates, in **Settings → Pages** confirm:

- Custom domain is `theintake.co.za`
- **Enforce HTTPS** is enabled

### 3. Show up on Google

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property for `https://theintake.co.za`
3. Verify ownership (DNS TXT record or HTML meta tag)
4. Submit sitemap: `https://theintake.co.za/sitemap.xml`
5. Request indexing for the homepage

The site already includes SEO essentials: meta description, Open Graph tags, canonical URL, `robots.txt`, sitemap, and structured data.

## License

Private project unless otherwise stated.
