(function () {
  "use strict";

  const STORAGE_KEY = "theintake-cv-draft-v1";

  const form = document.getElementById("cv-form");
  const preview = document.getElementById("cv-preview");
  const experienceList = document.getElementById("experience-list");
  const educationList = document.getElementById("education-list");
  const saveNote = document.getElementById("cv-save-note");

  const emptyExperience = () => ({
    title: "",
    company: "",
    location: "",
    start: "",
    end: "",
    details: "",
  });

  const emptyEducation = () => ({
    school: "",
    qualification: "",
    start: "",
    end: "",
    details: "",
  });

  let state = {
    template: "classic",
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    summary: "",
    skills: "",
    experience: [emptyExperience()],
    education: [emptyEducation()],
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, "<br>");
  }

  function skillsArray() {
    return String(state.skills || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function contactBits() {
    return [state.email, state.phone, state.location, state.website]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function hasContent() {
    return Boolean(
      state.fullName.trim() ||
        state.headline.trim() ||
        state.summary.trim() ||
        skillsArray().length ||
        state.experience.some((e) => e.title || e.company) ||
        state.education.some((e) => e.school || e.qualification)
    );
  }

  function renderExperienceItems() {
    return state.experience
      .filter((e) => e.title || e.company || e.details)
      .map(
        (e) => `
      <div class="cv-item">
        <div class="cv-item-head">
          <div>
            <div class="cv-item-title">${escapeHtml(e.title || "Role")}</div>
            <div class="cv-item-sub">${escapeHtml(
              [e.company, e.location].filter(Boolean).join(" · ")
            )}</div>
          </div>
          <div class="cv-item-dates">${escapeHtml(
            [e.start, e.end].filter(Boolean).join(" – ")
          )}</div>
        </div>
        ${e.details ? `<div class="cv-item-body">${nl2br(e.details)}</div>` : ""}
      </div>`
      )
      .join("");
  }

  function renderEducationItems() {
    return state.education
      .filter((e) => e.school || e.qualification || e.details)
      .map(
        (e) => `
      <div class="cv-item">
        <div class="cv-item-head">
          <div>
            <div class="cv-item-title">${escapeHtml(
              e.qualification || "Qualification"
            )}</div>
            <div class="cv-item-sub">${escapeHtml(e.school)}</div>
          </div>
          <div class="cv-item-dates">${escapeHtml(
            [e.start, e.end].filter(Boolean).join(" – ")
          )}</div>
        </div>
        ${e.details ? `<div class="cv-item-body">${nl2br(e.details)}</div>` : ""}
      </div>`
      )
      .join("");
  }

  function renderSkills() {
    const skills = skillsArray();
    if (!skills.length) return "";
    return `<div class="cv-skills">${skills
      .map((s) => `<span class="cv-skill">${escapeHtml(s)}</span>`)
      .join("")}</div>`;
  }

  function section(title, html) {
    if (!html) return "";
    return `<section class="cv-section"><h2 class="cv-section-title">${title}</h2>${html}</section>`;
  }

  function renderPreview() {
    preview.className = `cv-sheet tpl-${state.template}`;

    if (!hasContent()) {
      preview.innerHTML =
        '<p class="cv-empty-hint">Your CV preview will appear here as you fill in the form.</p>';
      return;
    }

    const name = escapeHtml(state.fullName || "Your name");
    const headline = escapeHtml(state.headline);
    const contact = contactBits()
      .map((c) => `<span>${escapeHtml(c)}</span>`)
      .join("");
    const summary = state.summary
      ? `<p class="cv-item-body">${nl2br(state.summary)}</p>`
      : "";
    const exp = renderExperienceItems();
    const edu = renderEducationItems();
    const skills = renderSkills();

    if (state.template === "modern") {
      preview.innerHTML = `
        <div class="cv-banner">
          <h1 class="cv-name">${name}</h1>
          ${headline ? `<p class="cv-headline">${headline}</p>` : ""}
          ${contact ? `<div class="cv-contact">${contact}</div>` : ""}
        </div>
        <div class="cv-body">
          ${section("Profile", summary)}
          ${section("Experience", exp)}
          ${section("Education", edu)}
          ${section("Skills", skills)}
        </div>`;
      return;
    }

    if (state.template === "sidebar") {
      preview.innerHTML = `
        <aside class="cv-side">
          <h1 class="cv-name">${name}</h1>
          ${headline ? `<p class="cv-headline">${headline}</p>` : ""}
          ${
            contact
              ? `<h2 class="cv-section-title">Contact</h2><div class="cv-contact">${contact}</div>`
              : ""
          }
          ${skills ? `<h2 class="cv-section-title">Skills</h2>${skills}` : ""}
        </aside>
        <div class="cv-main-col">
          ${section("Profile", summary)}
          ${section("Experience", exp)}
          ${section("Education", edu)}
        </div>`;
      return;
    }

    // classic + minimal share the same structure
    preview.innerHTML = `
      <header>
        <h1 class="cv-name">${name}</h1>
        ${headline ? `<p class="cv-headline">${headline}</p>` : ""}
        ${contact ? `<div class="cv-contact">${contact}</div>` : ""}
      </header>
      ${section("Profile", summary)}
      ${section("Experience", exp)}
      ${section("Education", edu)}
      ${section("Skills", skills)}`;
  }

  function readFormBasics() {
    const data = new FormData(form);
    state.template = String(data.get("template") || "classic");
    state.fullName = String(data.get("fullName") || "");
    state.headline = String(data.get("headline") || "");
    state.email = String(data.get("email") || "");
    state.phone = String(data.get("phone") || "");
    state.location = String(data.get("location") || "");
    state.website = String(data.get("website") || "");
    state.summary = String(data.get("summary") || "");
    state.skills = String(data.get("skills") || "");
  }

  function readRepeats() {
    state.experience = [...experienceList.querySelectorAll(".cv-repeat-card")].map(
      (card) => ({
        title: card.querySelector('[data-field="title"]').value,
        company: card.querySelector('[data-field="company"]').value,
        location: card.querySelector('[data-field="location"]').value,
        start: card.querySelector('[data-field="start"]').value,
        end: card.querySelector('[data-field="end"]').value,
        details: card.querySelector('[data-field="details"]').value,
      })
    );
    state.education = [...educationList.querySelectorAll(".cv-repeat-card")].map(
      (card) => ({
        school: card.querySelector('[data-field="school"]').value,
        qualification: card.querySelector('[data-field="qualification"]').value,
        start: card.querySelector('[data-field="start"]').value,
        end: card.querySelector('[data-field="end"]').value,
        details: card.querySelector('[data-field="details"]').value,
      })
    );
    if (!state.experience.length) state.experience = [emptyExperience()];
    if (!state.education.length) state.education = [emptyEducation()];
  }

  function syncFromDom() {
    readFormBasics();
    readRepeats();
    renderPreview();
    persist();
  }

  function experienceCardHtml(item, index) {
    return `
      <div class="cv-repeat-card" data-index="${index}">
        <div class="cv-repeat-card-head">
          <strong>Role ${index + 1}</strong>
          <button type="button" class="cv-remove" data-remove="experience">Remove</button>
        </div>
        <label class="cv-field"><span>Job title</span>
          <input data-field="title" value="${escapeHtml(item.title)}" placeholder="Role title" />
        </label>
        <div class="cv-field-row">
          <label class="cv-field"><span>Company</span>
            <input data-field="company" value="${escapeHtml(item.company)}" />
          </label>
          <label class="cv-field"><span>Location</span>
            <input data-field="location" value="${escapeHtml(item.location)}" />
          </label>
        </div>
        <div class="cv-field-row">
          <label class="cv-field"><span>Start</span>
            <input data-field="start" value="${escapeHtml(item.start)}" placeholder="Jan 2022" />
          </label>
          <label class="cv-field"><span>End</span>
            <input data-field="end" value="${escapeHtml(item.end)}" placeholder="Present" />
          </label>
        </div>
        <label class="cv-field"><span>Highlights</span>
          <textarea data-field="details" rows="3" placeholder="Key responsibilities and wins">${escapeHtml(
            item.details
          )}</textarea>
        </label>
      </div>`;
  }

  function educationCardHtml(item, index) {
    return `
      <div class="cv-repeat-card" data-index="${index}">
        <div class="cv-repeat-card-head">
          <strong>Education ${index + 1}</strong>
          <button type="button" class="cv-remove" data-remove="education">Remove</button>
        </div>
        <label class="cv-field"><span>School / institution</span>
          <input data-field="school" value="${escapeHtml(item.school)}" />
        </label>
        <label class="cv-field"><span>Qualification</span>
          <input data-field="qualification" value="${escapeHtml(item.qualification)}" />
        </label>
        <div class="cv-field-row">
          <label class="cv-field"><span>Start</span>
            <input data-field="start" value="${escapeHtml(item.start)}" />
          </label>
          <label class="cv-field"><span>End</span>
            <input data-field="end" value="${escapeHtml(item.end)}" />
          </label>
        </div>
        <label class="cv-field"><span>Notes</span>
          <textarea data-field="details" rows="2">${escapeHtml(item.details)}</textarea>
        </label>
      </div>`;
  }

  function renderRepeatEditors() {
    experienceList.innerHTML = state.experience
      .map((item, i) => experienceCardHtml(item, i))
      .join("");
    educationList.innerHTML = state.education
      .map((item, i) => educationCardHtml(item, i))
      .join("");
  }

  function fillBasics() {
    form.fullName.value = state.fullName;
    form.headline.value = state.headline;
    form.email.value = state.email;
    form.phone.value = state.phone;
    form.location.value = state.location;
    form.website.value = state.website;
    form.summary.value = state.summary;
    form.skills.value = state.skills;
    const tpl = form.querySelector(`input[name="template"][value="${state.template}"]`);
    if (tpl) tpl.checked = true;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (saveNote) saveNote.textContent = "Draft saved on this device.";
    } catch (_) {
      if (saveNote) saveNote.textContent = "Could not save draft on this device.";
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state = {
        ...state,
        ...parsed,
        experience:
          Array.isArray(parsed.experience) && parsed.experience.length
            ? parsed.experience
            : [emptyExperience()],
        education:
          Array.isArray(parsed.education) && parsed.education.length
            ? parsed.education
            : [emptyEducation()],
      };
    } catch (_) {
      /* ignore corrupt draft */
    }
  }

  function fileBase() {
    const name = (state.fullName || "CV").trim().replace(/\s+/g, "_");
    return `${name}_CV`;
  }

  async function downloadPdf() {
    if (!window.html2pdf) {
      alert("PDF library failed to load. Check your connection and try again.");
      return;
    }
    if (!hasContent()) {
      alert("Add your name or some details before downloading.");
      return;
    }
    const btn = document.getElementById("download-pdf");
    btn.disabled = true;
    btn.textContent = "Preparing PDF…";
    try {
      await window
        .html2pdf()
        .set({
          margin: 0,
          filename: `${fileBase()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(preview)
        .save();
    } catch (err) {
      console.error(err);
      alert("Could not create the PDF. Try Print instead.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Download PDF";
    }
  }

  async function downloadDocx() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx || {};
    if (!Document || !window.saveAs) {
      alert("Word export failed to load. Check your connection and try again.");
      return;
    }
    if (!hasContent()) {
      alert("Add your name or some details before downloading.");
      return;
    }

    const children = [];
    const push = (text, opts = {}) => {
      if (!text) return;
      children.push(
        new Paragraph({
          spacing: { after: opts.after ?? 120 },
          children: [
            new TextRun({
              text,
              bold: !!opts.bold,
              size: opts.size || 22,
              color: opts.color || "1A1A1A",
              font: "Calibri",
            }),
          ],
        })
      );
    };

    const heading = (text) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text,
              bold: true,
              size: 24,
              color: "1A5F7A",
              font: "Calibri",
            }),
          ],
        })
      );
    };

    push(state.fullName || "CV", { bold: true, size: 36, after: 60 });
    push(state.headline, { size: 24, color: "1A5F7A", after: 80 });
    push(contactBits().join("  ·  "), { size: 20, color: "445566", after: 200 });

    if (state.summary.trim()) {
      heading("Profile");
      state.summary.split(/\n+/).forEach((line) => push(line.trim(), { after: 80 }));
    }

    const expItems = state.experience.filter((e) => e.title || e.company || e.details);
    if (expItems.length) {
      heading("Experience");
      expItems.forEach((e) => {
        push(
          [e.title, e.company].filter(Boolean).join(" — "),
          { bold: true, after: 40 }
        );
        push(
          [e.location, [e.start, e.end].filter(Boolean).join(" – ")]
            .filter(Boolean)
            .join(" · "),
          { size: 20, color: "667788", after: 60 }
        );
        if (e.details) {
          e.details.split(/\n+/).forEach((line) => push(line.trim(), { after: 60 }));
        }
      });
    }

    const eduItems = state.education.filter(
      (e) => e.school || e.qualification || e.details
    );
    if (eduItems.length) {
      heading("Education");
      eduItems.forEach((e) => {
        push(
          [e.qualification, e.school].filter(Boolean).join(" — "),
          { bold: true, after: 40 }
        );
        push([e.start, e.end].filter(Boolean).join(" – "), {
          size: 20,
          color: "667788",
          after: 60,
        });
        if (e.details) {
          e.details.split(/\n+/).forEach((line) => push(line.trim(), { after: 60 }));
        }
      });
    }

    if (skillsArray().length) {
      heading("Skills");
      push(skillsArray().join(", "), { after: 80 });
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    window.saveAs(blob, `${fileBase()}.docx`);
  }

  form.addEventListener("input", syncFromDom);
  form.addEventListener("change", syncFromDom);

  experienceList.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-remove="experience"]');
    if (!btn) return;
    readRepeats();
    const card = btn.closest(".cv-repeat-card");
    const idx = Number(card.dataset.index);
    state.experience.splice(idx, 1);
    if (!state.experience.length) state.experience.push(emptyExperience());
    renderRepeatEditors();
    syncFromDom();
  });

  educationList.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-remove="education"]');
    if (!btn) return;
    readRepeats();
    const card = btn.closest(".cv-repeat-card");
    const idx = Number(card.dataset.index);
    state.education.splice(idx, 1);
    if (!state.education.length) state.education.push(emptyEducation());
    renderRepeatEditors();
    syncFromDom();
  });

  document.getElementById("add-experience").addEventListener("click", () => {
    readRepeats();
    state.experience.push(emptyExperience());
    renderRepeatEditors();
    syncFromDom();
  });

  document.getElementById("add-education").addEventListener("click", () => {
    readRepeats();
    state.education.push(emptyEducation());
    renderRepeatEditors();
    syncFromDom();
  });

  document.getElementById("download-pdf").addEventListener("click", downloadPdf);
  document.getElementById("download-docx").addEventListener("click", downloadDocx);
  document.getElementById("print-cv").addEventListener("click", () => window.print());

  document.getElementById("clear-cv").addEventListener("click", () => {
    if (!confirm("Clear your saved CV draft on this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = {
      template: "classic",
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
      skills: "",
      experience: [emptyExperience()],
      education: [emptyEducation()],
    };
    fillBasics();
    renderRepeatEditors();
    renderPreview();
    if (saveNote) saveNote.textContent = "Draft cleared.";
  });

  loadDraft();
  fillBasics();
  renderRepeatEditors();
  renderPreview();
})();
