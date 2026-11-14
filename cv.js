(function () {
  "use strict";

  const STORAGE_KEY = "theintake-cv-draft-v2";

  const form = document.getElementById("cv-form");
  const preview = document.getElementById("cv-preview");
  const experienceList = document.getElementById("experience-list");
  const educationList = document.getElementById("education-list");
  const saveNote = document.getElementById("cv-save-note");
  const exportMount = document.getElementById("cv-export-mount");

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

  const SAMPLE_CV = {
    template: "modern",
    fullName: "Thandi Molefe",
    headline: "Marketing Coordinator",
    email: "thandi.molefe@email.com",
    phone: "+27 82 555 0142",
    location: "Johannesburg, South Africa",
    website: "linkedin.com/in/thandimolefe",
    summary:
      "Results-driven marketing coordinator with 4+ years’ experience supporting campaigns across digital, social, and events. Skilled at turning briefs into clear plans, tracking performance, and working closely with sales and creative teams. Looking for a role where I can grow into campaign ownership.",
    skills:
      "Campaign coordination, Social media, Content calendars, Google Analytics, Canva, Excel, Stakeholder communication, Event support, Copywriting, CRM basics",
    experience: [
      {
        title: "Marketing Coordinator",
        company: "BrightPath Retail",
        location: "Johannesburg",
        start: "Mar 2022",
        end: "Present",
        details:
          "Plan and schedule weekly social content for three brand channels.\nCoordinate email campaigns with sales; improved open rates by 18%.\nSupport product launches, including briefs, timelines, and vendor follow-ups.\nReport monthly KPIs to the marketing manager using Analytics and spreadsheet dashboards.",
      },
      {
        title: "Marketing Assistant",
        company: "Horizon Media",
        location: "Pretoria",
        start: "Jan 2020",
        end: "Feb 2022",
        details:
          "Assisted with client social calendars, asset organisation, and posting schedules.\nPrepared competitor snapshots and basic campaign performance summaries.\nHelped run brand activations at malls and campus events.",
      },
    ],
    education: [
      {
        school: "University of Johannesburg",
        qualification: "BCom Marketing Management",
        start: "2016",
        end: "2019",
        details: "Graduated with distinction in Consumer Behaviour.",
      },
      {
        school: "Google / Coursera",
        qualification: "Google Digital Marketing & E-commerce Certificate",
        start: "2021",
        end: "2021",
        details: "",
      },
    ],
  };

  let state = structuredClone(SAMPLE_CV);

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

  function buildSheetHtml() {
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
      return `
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
    }

    if (state.template === "sidebar") {
      return `
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
    }

    return `
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

  function renderPreview() {
    preview.className = `cv-sheet tpl-${state.template}`;
    if (!hasContent()) {
      preview.innerHTML =
        '<p class="cv-empty-hint">Your CV preview will appear here as you fill in the form.</p>';
      return;
    }
    preview.innerHTML = buildSheetHtml();
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
          <input data-field="title" value="${escapeHtml(item.title)}" />
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
            <input data-field="start" value="${escapeHtml(item.start)}" />
          </label>
          <label class="cv-field"><span>End</span>
            <input data-field="end" value="${escapeHtml(item.end)}" />
          </label>
        </div>
        <label class="cv-field"><span>Highlights</span>
          <textarea data-field="details" rows="3">${escapeHtml(item.details)}</textarea>
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
    const tpl = form.querySelector(
      `input[name="template"][value="${state.template}"]`
    );
    if (tpl) tpl.checked = true;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (saveNote) {
        saveNote.textContent =
          "Example CV loaded — edit anytime. Draft saves on this device.";
      }
    } catch (_) {
      if (saveNote) saveNote.textContent = "Could not save draft on this device.";
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      // Ignore empty drafts so the sample CV always shows for first useful visit
      const looksEmpty =
        !String(parsed.fullName || "").trim() &&
        !String(parsed.summary || "").trim();
      if (looksEmpty) return;
      state = {
        ...structuredClone(SAMPLE_CV),
        ...parsed,
        experience:
          Array.isArray(parsed.experience) && parsed.experience.length
            ? parsed.experience
            : structuredClone(SAMPLE_CV.experience),
        education:
          Array.isArray(parsed.education) && parsed.education.length
            ? parsed.education
            : structuredClone(SAMPLE_CV.education),
      };
    } catch (_) {
      /* keep sample */
    }
  }

  function fileBase() {
    const name = (state.fullName || "CV").trim().replace(/\s+/g, "_");
    return `${name}_CV`;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const exportOverlay = document.getElementById("cv-export-overlay");

  function setExportBusy(busy, label) {
    if (exportOverlay) {
      exportOverlay.hidden = !busy;
      if (label) {
        const p = exportOverlay.querySelector("p");
        if (p) p.textContent = label;
      }
    }
  }

  /** Full-size in-viewport clone for canvas capture */
  function buildExportSheet() {
    if (!exportMount) return null;
    exportMount.innerHTML = "";
    const sheet = document.createElement("div");
    sheet.className = `cv-sheet tpl-${state.template} cv-sheet-export`;
    sheet.setAttribute("aria-hidden", "true");
    sheet.innerHTML = buildSheetHtml();
    exportMount.appendChild(sheet);
    return sheet;
  }

  function clearExportSheet() {
    if (exportMount) exportMount.innerHTML = "";
  }

  function getExportStylesheetHref() {
    const link = document.querySelector('link[href*="cv.css"]');
    return link ? link.href : "cv.css";
  }

  async function loadCvCssText() {
    try {
      const res = await fetch(getExportStylesheetHref(), { cache: "force-cache" });
      if (!res.ok) throw new Error("css fetch failed");
      return await res.text();
    } catch (_) {
      return "";
    }
  }

  function canvasLooksBlank(canvas) {
    try {
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas;
      if (!width || !height) return true;
      const step = Math.max(8, Math.floor(Math.min(width, height) / 40));
      let dark = 0;
      let samples = 0;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          samples += 1;
          if (d[0] + d[1] + d[2] < 720) dark += 1;
        }
      }
      return dark / samples < 0.01;
    } catch (_) {
      return false;
    }
  }

  function getJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    return null;
  }

  async function openStyledPrintWindow() {
    const sheetHtml = `<div class="cv-sheet tpl-${state.template}">${buildSheetHtml()}</div>`;
    const cssText = await loadCvCssText();
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
    if (!win) {
      alert("Please allow pop-ups to print your CV.");
      return null;
    }
    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(state.fullName || "CV")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
  <style>
${cssText}
html, body { margin: 0; padding: 0; background: #fff !important; }
.cv-sheet {
  transform: none !important;
  margin: 0 auto !important;
  box-shadow: none !important;
  width: 210mm !important;
  min-height: 297mm !important;
}
@page { size: A4; margin: 0; }
@media print {
  html, body { margin: 0; background: #fff !important; }
}
  </style>
</head>
<body>${sheetHtml}</body>
</html>`);
    win.document.close();
    await wait(500);
    try {
      if (win.document.fonts && win.document.fonts.ready) {
        await win.document.fonts.ready;
      }
    } catch (_) {
      /* ignore */
    }
    await wait(200);
    return win;
  }

  async function downloadPdf() {
    const JsPDF = getJsPdf();
    if (!window.html2canvas || !JsPDF) {
      alert("PDF tools failed to load. Check your connection and try again.");
      return;
    }
    if (!hasContent()) {
      alert("Add some CV details before downloading.");
      return;
    }

    const btn = document.getElementById("download-pdf");
    btn.disabled = true;
    btn.textContent = "Preparing PDF…";
    setExportBusy(true, "Creating your PDF…");

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const sheet = buildExportSheet();
      if (!sheet) throw new Error("Export mount missing");

      // Let layout settle in the viewport under the overlay
      await wait(350);

      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          const cloned = doc.querySelector(".cv-sheet-export");
          if (!cloned) return;
          cloned.style.transform = "none";
          cloned.style.width = "794px";
          cloned.style.minHeight = "1123px";
          cloned.style.background = "#ffffff";
          cloned.style.color = "#1a1a1a";
          const mount = doc.querySelector(".cv-export-mount");
          if (mount) {
            mount.style.left = "0";
            mount.style.top = "0";
            mount.style.opacity = "1";
          }
        },
      });

      if (canvasLooksBlank(canvas)) {
        throw new Error("Blank canvas capture");
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new JsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 1) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      pdf.save(`${fileBase()}.pdf`);
    } catch (err) {
      console.error(err);
      try {
        saveTextPdfFallback();
      } catch (err2) {
        console.error(err2);
        const usePrint = confirm(
          "PDF download failed. Open the print dialog so you can choose “Save as PDF”?"
        );
        if (usePrint) await printCv();
      }
    } finally {
      clearExportSheet();
      setExportBusy(false);
      btn.disabled = false;
      btn.textContent = "Download PDF";
    }
  }

  /** Always-works PDF built with text (not a screenshot) */
  function saveTextPdfFallback() {
    const JsPDF = getJsPdf();
    if (!JsPDF) throw new Error("jsPDF missing");
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const margin = 16;
    const maxW = 210 - margin * 2;
    let y = 18;
    const accent = [26, 95, 122];

    const ensureSpace = (need) => {
      if (y + need > 287) {
        pdf.addPage();
        y = 18;
      }
    };

    const writeWrapped = (text, opts = {}) => {
      const size = opts.size || 10;
      const lines = pdf.splitTextToSize(String(text || ""), opts.width || maxW);
      ensureSpace(lines.length * (size * 0.45) + 2);
      pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      if (opts.color) pdf.setTextColor(...opts.color);
      else pdf.setTextColor(26, 26, 26);
      pdf.text(lines, opts.x || margin, y);
      y += lines.length * (size * 0.42) + (opts.after || 3);
    };

    const sectionTitle = (label) => {
      ensureSpace(12);
      y += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...accent);
      pdf.text(label.toUpperCase(), margin, y);
      y += 2;
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y, margin + maxW, y);
      y += 6;
    };

    // Header band for modern feel
    pdf.setFillColor(...accent);
    pdf.rect(0, 0, 210, 36, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(state.fullName || "CV", margin, 16);
    if (state.headline) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(state.headline, margin, 24);
    }
    const contact = contactBits().join("  ·  ");
    if (contact) {
      pdf.setFontSize(8.5);
      pdf.text(pdf.splitTextToSize(contact, maxW), margin, 31);
    }
    y = 46;

    if (state.summary.trim()) {
      sectionTitle("Profile");
      writeWrapped(state.summary.trim(), { size: 10, after: 4 });
    }

    const expItems = state.experience.filter((e) => e.title || e.company || e.details);
    if (expItems.length) {
      sectionTitle("Experience");
      expItems.forEach((e) => {
        writeWrapped([e.title, e.company].filter(Boolean).join(" — "), {
          bold: true,
          size: 11,
          after: 1,
        });
        writeWrapped(
          [e.location, [e.start, e.end].filter(Boolean).join(" – ")]
            .filter(Boolean)
            .join(" · "),
          { size: 9, color: [90, 100, 110], after: 2 }
        );
        if (e.details) {
          e.details.split(/\n+/).forEach((line) => {
            if (line.trim()) writeWrapped("• " + line.trim(), { size: 9.5, after: 1.5 });
          });
        }
        y += 2;
      });
    }

    const eduItems = state.education.filter(
      (e) => e.school || e.qualification || e.details
    );
    if (eduItems.length) {
      sectionTitle("Education");
      eduItems.forEach((e) => {
        writeWrapped([e.qualification, e.school].filter(Boolean).join(" — "), {
          bold: true,
          size: 11,
          after: 1,
        });
        writeWrapped([e.start, e.end].filter(Boolean).join(" – "), {
          size: 9,
          color: [90, 100, 110],
          after: 2,
        });
        if (e.details) writeWrapped(e.details, { size: 9.5, after: 2 });
      });
    }

    if (skillsArray().length) {
      sectionTitle("Skills");
      writeWrapped(skillsArray().join(" · "), { size: 10, after: 2 });
    }

    pdf.save(`${fileBase()}.pdf`);
  }

  async function printCv() {
    if (!hasContent()) {
      alert("Add some CV details before printing.");
      return;
    }
    setExportBusy(true, "Preparing print view…");
    try {
      const win = await openStyledPrintWindow();
      if (!win) return;
      win.focus();
      win.print();
    } catch (err) {
      console.error(err);
      alert("Print failed. Please try again.");
    } finally {
      setExportBusy(false);
    }
  }

  async function downloadDocx() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } =
      window.docx || {};
    if (!Document || !window.saveAs) {
      alert("Word export failed to load. Check your connection and try again.");
      return;
    }
    if (!hasContent()) {
      alert("Add some CV details before downloading.");
      return;
    }

    const children = [];
    const push = (text, opts = {}) => {
      if (!text) return;
      children.push(
        new Paragraph({
          spacing: { after: opts.after ?? 120 },
          border: opts.borderBottom
            ? {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "1A5F7A",
                  space: 8,
                },
              }
            : undefined,
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
          spacing: { before: 280, after: 120 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "1A5F7A",
              space: 4,
            },
          },
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

    push(state.fullName || "CV", { bold: true, size: 40, after: 60 });
    push(state.headline, { size: 24, color: "1A5F7A", after: 80 });
    push(contactBits().join("  ·  "), {
      size: 20,
      color: "445566",
      after: 200,
      borderBottom: true,
    });

    if (state.summary.trim()) {
      heading("Profile");
      state.summary.split(/\n+/).forEach((line) => push(line.trim(), { after: 80 }));
    }

    const expItems = state.experience.filter((e) => e.title || e.company || e.details);
    if (expItems.length) {
      heading("Experience");
      expItems.forEach((e) => {
        push([e.title, e.company].filter(Boolean).join(" — "), {
          bold: true,
          after: 40,
        });
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
        push([e.qualification, e.school].filter(Boolean).join(" — "), {
          bold: true,
          after: 40,
        });
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

  function applyStateToUi() {
    fillBasics();
    renderRepeatEditors();
    renderPreview();
    persist();
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
  document.getElementById("print-cv").addEventListener("click", printCv);

  document.getElementById("reset-sample").addEventListener("click", () => {
    if (!confirm("Reset to the example CV?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(SAMPLE_CV);
    applyStateToUi();
    if (saveNote) saveNote.textContent = "Example CV restored.";
  });

  loadDraft();
  applyStateToUi();
})();
