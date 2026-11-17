/* Stable job URLs. Keep in sync with slug_part/assign_slugs in
   scripts/generate_job_pages.py — the test suite checks they match. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.JobSlug = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function fnv1a(text) {
    let hash = 2166136261;
    const bytes = new TextEncoder().encode(String(text ?? ""));
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function slugPart(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function displayTitle(job) {
    const title = String(job.title ?? "").trim();
    return title || "Untitled role";
  }

  function displayCompany(job) {
    const company = String(job.company ?? "").trim();
    return company || "Unknown company";
  }

  function baseSlug(job) {
    const title = displayTitle(job);
    const company = displayCompany(job);
    const link = String(job.link ?? "").trim();
    const base = slugPart(`${title}-${company}`).slice(0, 60).replace(/^-+|-+$/g, "");
    const suffix = fnv1a(link || `${title}\n${company}`).slice(0, 8);
    return base ? `${base}-${suffix}` : suffix;
  }

  function assignSlugs(jobs) {
    const seen = new Map();
    return jobs.map((job) => {
      let slug = baseSlug(job);
      const count = (seen.get(slug) || 0) + 1;
      seen.set(slug, count);
      if (count > 1) slug = `${slug}-${count}`;
      return slug;
    });
  }

  return { assignSlugs, baseSlug, fnv1a };
});
