(() => {
  const DATA_URL = "jobs.json";

  const els = {
    headerCount: document.getElementById("header-count"),
    search: document.getElementById("search"),
    searchForm: document.getElementById("search-form"),
    filterCategory: document.getElementById("filter-category"),
    filterCity: document.getElementById("filter-city"),
    filterIndustry: document.getElementById("filter-industry"),
    filterSource: document.getElementById("filter-source"),
    resultCount: document.getElementById("result-count"),
    listingsUpdated: document.getElementById("listings-updated"),
    jobList: document.getElementById("job-list"),
    empty: document.getElementById("empty"),
    loadError: document.getElementById("load-error"),
    clearFilters: document.getElementById("clear-filters"),
    emptyClear: document.getElementById("empty-clear"),
    dialog: document.getElementById("job-dialog"),
    dialogClose: document.getElementById("dialog-close"),
    dialogLogo: document.getElementById("dialog-logo"),
    dialogCategory: document.getElementById("dialog-category"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogMeta: document.getElementById("dialog-meta"),
    dialogDesc: document.getElementById("dialog-desc"),
    dialogFacts: document.getElementById("dialog-facts"),
    dialogApply: document.getElementById("dialog-apply"),
    dialogCompany: document.getElementById("dialog-company"),
    embedDialog: document.getElementById("embed-dialog"),
    embedFrame: document.getElementById("embed-frame"),
    embedTitle: document.getElementById("embed-title"),
    embedLoading: document.getElementById("embed-loading"),
    embedBlocked: document.getElementById("embed-blocked"),
    embedExternal: document.getElementById("embed-external"),
    embedBlockedLink: document.getElementById("embed-blocked-link"),
    embedBack: document.getElementById("embed-back"),
    embedClose: document.getElementById("embed-close"),
  };

  let jobs = [];
  let filtered = [];
  let activeJob = null;
  let embedWatchTimer = null;

  const CITY_RULES = [
    { key: "Cape Town", match: /cape town|pinelands|claremont|blue downs|cape winelands|ottery/i },
    { key: "Johannesburg", match: /johannesburg|sandton|bryanston|braamfontein|boksburg|midrand|randburg|roodepoort|fourways/i },
    { key: "Pretoria / Centurion", match: /pretoria|centurion|hatfield|brooklyn/i },
    { key: "Durban", match: /durban|umhlanga|kwazulu/i },
    { key: "Remote / Hybrid", match: /\bremote\b|\bhybrid\b|work from home|\bwfh\b/i },
  ];

  function cityBucket(location) {
    const loc = location || "";
    for (const rule of CITY_RULES) {
      if (rule.match.test(loc)) return rule.key;
    }
    if (!loc.trim()) return "Unspecified";
    const short = loc.split(",")[0].trim();
    return short.length > 28 ? `${short.slice(0, 26)}…` : short;
  }

  function companyInitials(name) {
    const parts = String(name || "")
      .replace(/\(.*?\)/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function latestPostLabel(list) {
    const dates = list
      .map((j) => j.posting_date)
      .filter(Boolean)
      .sort();
    if (!dates.length) return "";
    return `Updated ${formatDate(dates[dates.length - 1])}`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }

  function fillSelect(select, values, allLabel) {
    const current = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>`;
    for (const value of values) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    }
    if (values.includes(current)) select.value = current;
  }

  function extractLogoUrl(job) {
    return job.logo_url || job.logo || job.company_logo || "";
  }

  function normalizeJobs(raw) {
    if (!Array.isArray(raw)) {
      throw new Error("Invalid listings payload");
    }

    const logoByCompany = new Map();
    for (const job of raw) {
      const name = String(job.company || "")
        .trim()
        .toLowerCase();
      const url = extractLogoUrl(job);
      if (name && url && !logoByCompany.has(name)) {
        logoByCompany.set(name, url);
      }
    }

    return raw.map((job, index) => {
      const company = job.company || "Unknown company";
      const companyKey = company.trim().toLowerCase();
      const logo_url =
        extractLogoUrl(job) || logoByCompany.get(companyKey) || "";

      return {
        id: index,
        title: job.title || "Untitled role",
        company,
        location: job.location || "",
        description: job.description || "",
        requirements: job.requirements || null,
        salary: job.salary || null,
        posting_date: job.posting_date || "",
        link: job.link || "#",
        company_url: job.company_url || "",
        category: job.category || "Uncategorized",
        industry: job.industry || "",
        source: job.source || "Unknown",
        city: cityBucket(job.location),
        logo_url,
      };
    });
  }

  function logoInnerHtml(job) {
    const initials = escapeHtml(companyInitials(job.company));
    if (!job.logo_url) {
      return `<span class="job-logo-fallback">${initials}</span>`;
    }
    return `
      <span class="job-logo-fallback">${initials}</span>
      <img
        class="job-logo-img"
        src="${escapeHtml(job.logo_url)}"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />`;
  }

  function logoMarkup(job, extraClass = "") {
    const classes = ["job-logo", extraClass, job.logo_url ? "" : "is-fallback"]
      .filter(Boolean)
      .join(" ");
    return `
      <div class="${classes}" aria-hidden="true">
        ${logoInnerHtml(job)}
      </div>`;
  }

  function fillLogoElement(el, job, extraClass = "") {
    if (!el) return;
    el.className = `job-logo ${extraClass} ${job.logo_url ? "" : "is-fallback"}`.trim();
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = logoInnerHtml(job);
    bindLogoFallback(el);
  }

  function bindLogoFallback(root) {
    root.querySelectorAll(".job-logo-img").forEach((img) => {
      const wrap = img.closest(".job-logo");
      const fail = () => wrap?.classList.add("is-fallback");
      img.addEventListener("error", fail, { once: true });
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function setJobs(raw) {
    jobs = normalizeJobs(raw);
    els.loadError.hidden = true;

    fillSelect(
      els.filterCategory,
      uniqueSorted(jobs.map((j) => j.category)),
      "All categories"
    );
    fillSelect(
      els.filterCity,
      uniqueSorted(jobs.map((j) => j.city)),
      "All locations"
    );
    fillSelect(
      els.filterIndustry,
      uniqueSorted(jobs.map((j) => j.industry)),
      "All industries"
    );
    fillSelect(
      els.filterSource,
      uniqueSorted(jobs.map((j) => j.source)),
      "All boards"
    );

    els.headerCount.textContent = `${jobs.length} open roles`;
    els.listingsUpdated.textContent = latestPostLabel(jobs);

    applyFilters();
  }

  function applyFilters() {
    const q = els.search.value.trim().toLowerCase();
    const category = els.filterCategory.value;
    const city = els.filterCity.value;
    const industry = els.filterIndustry.value;
    const source = els.filterSource.value;

    filtered = jobs.filter((job) => {
      if (category && job.category !== category) return false;
      if (city && job.city !== city) return false;
      if (industry && job.industry !== industry) return false;
      if (source && job.source !== source) return false;
      if (!q) return true;
      const hay = [
        job.title,
        job.company,
        job.location,
        job.description,
        job.category,
        job.industry,
        job.source,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    renderList();
  }

  function clearAllFilters() {
    els.search.value = "";
    els.filterCategory.value = "";
    els.filterCity.value = "";
    els.filterIndustry.value = "";
    els.filterSource.value = "";
    applyFilters();
  }

  function renderList() {
    els.jobList.innerHTML = "";
    const total = jobs.length;
    const shown = filtered.length;

    if (!total) {
      els.resultCount.textContent = "Open positions";
    } else if (shown === total) {
      els.resultCount.textContent = `${total} open positions`;
    } else {
      els.resultCount.textContent = `${shown} of ${total} positions`;
    }

    els.empty.hidden = shown !== 0 || total === 0;

    filtered.forEach((job) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "job-card";
      btn.setAttribute("aria-label", `${job.title} at ${job.company}`);

      btn.innerHTML = `
        ${logoMarkup(job)}
        <div class="job-body">
          <h3 class="job-title">${escapeHtml(job.title)}</h3>
          <p class="job-company">${escapeHtml(job.company)}</p>
          <div class="job-meta-row">
            <span>${escapeHtml(job.city || "Location TBD")}</span>
            ${job.industry ? `<span>${escapeHtml(job.industry)}</span>` : ""}
          </div>
          <div class="job-tags">
            <span class="tag tag-accent">${escapeHtml(job.category)}</span>
            <span class="tag">${escapeHtml(job.source)}</span>
          </div>
          <p class="job-desc">${escapeHtml(job.description || "Details available on the full posting.")}</p>
        </div>
        <div class="job-side">
          <span class="posted">${escapeHtml(formatDate(job.posting_date))}</span>
          ${job.salary ? `<span class="salary">${escapeHtml(job.salary)}</span>` : ""}
        </div>
      `;

      bindLogoFallback(btn);
      btn.addEventListener("click", () => openJob(job));
      li.appendChild(btn);
      els.jobList.appendChild(li);
    });
  }

  function openJob(job) {
    activeJob = job;
    fillLogoElement(els.dialogLogo, job, "job-logo-lg");

    els.dialogCategory.textContent = job.category;
    els.dialogTitle.textContent = job.title;
    els.dialogMeta.textContent = `${job.company} · ${job.location || job.city}`;
    els.dialogDesc.textContent =
      job.description || "Details available on the full posting.";

    const facts = [
      ["Industry", job.industry || "—"],
      ["Listed on", job.source || "—"],
      ["Posted", formatDate(job.posting_date)],
      ["Salary", job.salary || "Not listed"],
      ["Location", job.location || "—"],
      ["Requirements", job.requirements || "See full posting"],
    ];

    els.dialogFacts.innerHTML = facts
      .map(
        ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`
      )
      .join("");

    if (job.company_url) {
      els.dialogCompany.hidden = false;
      els.dialogCompany.href = job.company_url;
    } else {
      els.dialogCompany.hidden = true;
    }

    if (typeof els.dialog.showModal === "function") {
      els.dialog.showModal();
    } else {
      els.dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    if (typeof els.dialog.close === "function") {
      els.dialog.close();
    } else {
      els.dialog.removeAttribute("open");
    }
  }

  function showModal(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function hideModal(dialog) {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function clearEmbedWatch() {
    if (embedWatchTimer) {
      clearTimeout(embedWatchTimer);
      embedWatchTimer = null;
    }
  }

  function showEmbedBlocked() {
    els.embedDialog.classList.add("is-blocked");
    els.embedLoading.hidden = true;
    els.embedBlocked.hidden = false;
  }

  function openApplyEmbed(job) {
    const url = job?.link;
    if (!url || url === "#") return;

    clearEmbedWatch();
    els.embedDialog.classList.remove("is-blocked");
    els.embedBlocked.hidden = true;
    els.embedLoading.hidden = false;
    els.embedTitle.textContent = `${job.title} · ${job.company}`;
    els.embedExternal.href = url;
    els.embedBlockedLink.href = url;

    // Reset iframe before loading
    els.embedFrame.src = "about:blank";

    closeDialog();
    showModal(els.embedDialog);

    requestAnimationFrame(() => {
      els.embedFrame.src = url;
    });

    const onLoad = () => {
      els.embedLoading.hidden = true;
      // Cross-origin frames often look "blank" but still fire load.
      // If the board blocks framing, show fallback after a short wait.
      try {
        const href = els.embedFrame.contentWindow.location.href;
        if (!href || href === "about:blank") showEmbedBlocked();
      } catch {
        // Opaque cross-origin frame — assume content may be present.
      }
    };

    els.embedFrame.addEventListener("load", onLoad, { once: true });

    embedWatchTimer = setTimeout(() => {
      // Many boards block iframes; if still "loading" or clearly empty, offer fallback.
      if (!els.embedLoading.hidden) {
        showEmbedBlocked();
      }
    }, 4500);
  }

  function closeEmbed({ restoreDetails = false } = {}) {
    clearEmbedWatch();
    els.embedFrame.src = "about:blank";
    els.embedLoading.hidden = false;
    els.embedBlocked.hidden = true;
    els.embedDialog.classList.remove("is-blocked");
    hideModal(els.embedDialog);
    if (restoreDetails && activeJob) openJob(activeJob);
  }

  async function loadListings() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("unavailable");
      const data = await res.json();
      setJobs(data);
    } catch {
      els.loadError.hidden = false;
      els.empty.hidden = true;
      els.headerCount.textContent = "Unavailable";
      els.resultCount.textContent = "Open positions";
      els.listingsUpdated.textContent = "";
    }
  }

  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    applyFilters();
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
  });

  els.search.addEventListener("input", applyFilters);
  els.filterCategory.addEventListener("change", applyFilters);
  els.filterCity.addEventListener("change", applyFilters);
  els.filterIndustry.addEventListener("change", applyFilters);
  els.filterSource.addEventListener("change", applyFilters);

  els.clearFilters.addEventListener("click", clearAllFilters);
  els.emptyClear.addEventListener("click", clearAllFilters);

  els.dialogClose.addEventListener("click", closeDialog);
  els.dialog.addEventListener("click", (e) => {
    if (e.target === els.dialog) closeDialog();
  });

  els.dialogApply.addEventListener("click", () => {
    if (activeJob) openApplyEmbed(activeJob);
  });

  els.embedBack.addEventListener("click", () => {
    closeEmbed({ restoreDetails: true });
  });

  els.embedClose.addEventListener("click", () => closeEmbed());

  els.embedDialog.addEventListener("click", (e) => {
    if (e.target === els.embedDialog) closeEmbed();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (els.embedDialog.open) {
      e.preventDefault();
      closeEmbed();
      return;
    }
    if (els.dialog.open) closeDialog();
  });

  loadListings();
})();
