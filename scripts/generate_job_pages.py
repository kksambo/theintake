#!/usr/bin/env python3
"""Build static job pages, sitemap.xml, and robots.txt from jobs.json.

GitHub Pages for this repo is the legacy "deploy from branch" mode: the
main branch root is served at https://theintake.co.za/. Pages therefore
have to be real files in the repo. A push that changes jobs.json (the
Monday feed update) reruns this script via GitHub Actions and commits
the result. Jobs that disappear from jobs.json lose their directories.

validThrough
    Each page sets validThrough to the UTC date this script runs, plus
    30 days. The feed is the source of truth for which roles are still
    open, and many of them stay in jobs.json for longer than 30 days
    after posting_date. Dating expiry from posting_date would mark those
    live pages as already expired. The weekly rebuild moves validThrough
    forward while the role remains in the feed. Removing the role deletes
    the page (HTTP 404), which is how Google wants a filled job dropped.

baseSalary
    Emitted only when the salary string matches a pattern this script
    knows how to read (a monthly rand range, or a yearly USD range in
    thousands). "Up to" amounts and total packages are left as visible
    text and omitted from the markup. employmentType is never guessed.

Locations
    On-site and hybrid roles get a PostalAddress. addressCountry is ZA:
    this feed is South African jobs. addressLocality is taken from the
    location string. addressRegion is added from a gazetteer when the
    named place is unambiguous, and omitted otherwise. Fully remote
    roles (the word "remote" / "work from home", and not hybrid) use
    jobLocationType TELECOMMUTE plus applicantLocationRequirements for
    South Africa, which every remote string in this feed allows.
    Hybrid roles keep a physical jobLocation and are not marked
    TELECOMMUTE. Street addresses and postal codes are never invented.

Slugs
    /jobs/<slug>/ is derived from the title, company, and apply link.
    The same algorithm lives in job-slug.js for the homepage cards.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://theintake.co.za"
VALID_DAYS = 30
ASSET_VERSION = "20261117a"
JOBS_DIR_NAME = "jobs"

SALARY_UNITS = {"HOUR", "DAY", "WEEK", "MONTH", "YEAR"}
ZAR_RANGE = re.compile(
    r"^R\s*(\d{1,3}(?:,\d{3})+|\d+)\s*[-–]\s*R\s*(\d{1,3}(?:,\d{3})+|\d+)\s*per\s+month$",
    re.IGNORECASE,
)
USD_YEAR_RANGE = re.compile(
    r"^\$\s*(\d+(?:\.\d+)?)\s*k\s*[-–]\s*\$\s*(\d+(?:\.\d+)?)\s*k\s*/\s*yr(?:\s*\([^)]*\))?$",
    re.IGNORECASE,
)
REMOTE_RE = re.compile(r"\bremote\b|\bwork from home\b|\bwfh\b", re.IGNORECASE)
HYBRID_RE = re.compile(r"\bhybrid\b", re.IGNORECASE)
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BASED_IN_RE = re.compile(
    r"must be based in ([A-Za-z][A-Za-z .'-]*?) or ([A-Za-z][A-Za-z .'-]*?)(?:$|[.(])",
    re.IGNORECASE,
)

# locality, province. Keys are norm_key() of a place name that appears in
# the location string. Provinces are included only for places that sit in
# one province. Unknown text is passed through as addressLocality with no
# region rather than assigned a guessed city.
PLACES: dict[str, tuple[str | None, str | None]] = {
    "cape town": ("Cape Town", "Western Cape"),
    "city of cape town": ("Cape Town", "Western Cape"),
    "cape town cbd": ("Cape Town", "Western Cape"),
    "cape town international airport": ("Cape Town", "Western Cape"),
    "cpt - southern suburbs": ("Cape Town", "Western Cape"),
    "pinelands": ("Pinelands", "Western Cape"),
    "claremont": ("Claremont", "Western Cape"),
    "kenilworth": ("Kenilworth", "Western Cape"),
    "stellenbosch": ("Stellenbosch", "Western Cape"),
    "ottery": ("Ottery", "Western Cape"),
    "blue downs": ("Blue Downs", "Western Cape"),
    "paarl": ("Paarl", "Western Cape"),
    "wellington": ("Wellington", "Western Cape"),
    "ceres": ("Ceres", "Western Cape"),
    "bellville": ("Bellville", "Western Cape"),
    "belville": ("Belville", "Western Cape"),
    "durbanville": ("Durbanville", "Western Cape"),
    "milnerton": ("Milnerton", "Western Cape"),
    "somerset west": ("Somerset West", "Western Cape"),
    "philippi": ("Philippi", "Western Cape"),
    "cape winelands": ("Cape Winelands", "Western Cape"),
    "overberg": ("Overberg", "Western Cape"),
    "west coast": ("West Coast", "Western Cape"),
    "swartland local municipality": ("Swartland", "Western Cape"),
    "swartland": ("Swartland", "Western Cape"),
    "johannesburg": ("Johannesburg", "Gauteng"),
    "city of johannesburg": ("Johannesburg", "Gauteng"),
    "johannesburg metropolitan area": ("Johannesburg", "Gauteng"),
    "johannesburg region": ("Johannesburg", "Gauteng"),
    "johannesburg south": ("Johannesburg", "Gauteng"),
    "sandton": ("Sandton", "Gauteng"),
    "bryanston": ("Bryanston", "Gauteng"),
    "braamfontein": ("Braamfontein", "Gauteng"),
    "braamfontein (braampark)": ("Braamfontein", "Gauteng"),
    "boksburg": ("Boksburg", "Gauteng"),
    "midrand": ("Midrand", "Gauteng"),
    "randburg": ("Randburg", "Gauteng"),
    "roodepoort": ("Roodepoort", "Gauteng"),
    "fourways": ("Fourways", "Gauteng"),
    "pretoria": ("Pretoria", "Gauteng"),
    "centurion": ("Centurion", "Gauteng"),
    "hatfield": ("Hatfield", "Gauteng"),
    "brooklyn": ("Brooklyn", "Gauteng"),
    "kempton park": ("Kempton Park", "Gauteng"),
    "rosebank": ("Rosebank", "Gauteng"),
    "edenvale": ("Edenvale", "Gauteng"),
    "sunninghill": ("Sunninghill", "Gauteng"),
    "woodmead": ("Woodmead", "Gauteng"),
    "jet park": ("Jet Park", "Gauteng"),
    "isando": ("Isando", "Gauteng"),
    "vanderbijlpark": ("Vanderbijlpark", "Gauteng"),
    "germiston": ("Germiston", "Gauteng"),
    "benoni": ("Benoni", "Gauteng"),
    "alberton": ("Alberton", "Gauteng"),
    "krugersdorp": ("Krugersdorp", "Gauteng"),
    "akasia": ("Akasia", "Gauteng"),
    "hazelwood": ("Hazelwood", "Gauteng"),
    "allen's nek": ("Allen's Nek", "Gauteng"),
    "allens nek": ("Allen's Nek", "Gauteng"),
    "west rand": ("West Rand", "Gauteng"),
    "west rand district": ("West Rand", "Gauteng"),
    "netcare akasia hospital": ("Akasia", "Gauteng"),
    "netcare krugersdorp hospital": ("Krugersdorp", "Gauteng"),
    "netcare montana hospital": ("Montana", "Gauteng"),
    "durban": ("Durban", "KwaZulu-Natal"),
    "umhlanga": ("Umhlanga", "KwaZulu-Natal"),
    "pinetown": ("Pinetown", "KwaZulu-Natal"),
    "mtubatuba": ("Mtubatuba", "KwaZulu-Natal"),
    "pietermaritzburg": ("Pietermaritzburg", "KwaZulu-Natal"),
    "newcastle": ("Newcastle", "KwaZulu-Natal"),
    "durban northern suburbs": ("Durban", "KwaZulu-Natal"),
    "durban western suburbs": ("Durban", "KwaZulu-Natal"),
    "gqeberha": ("Gqeberha", "Eastern Cape"),
    "port elizabeth": ("Port Elizabeth", "Eastern Cape"),
    "uitenhage": ("Uitenhage", "Eastern Cape"),
    "east london": ("East London", "Eastern Cape"),
    "bloemfontein": ("Bloemfontein", "Free State"),
    "potchefstroom": ("Potchefstroom", "North West"),
    "klerksdorp": ("Klerksdorp", "North West"),
    "rustenburg": ("Rustenburg", "North West"),
    "brits": ("Brits", "North West"),
    "emalahleni": ("Emalahleni", "Mpumalanga"),
    "nelspruit": ("Nelspruit", "Mpumalanga"),
    "witbank": ("Witbank", "Mpumalanga"),
    "polokwane": ("Polokwane", "Limpopo"),
    "kenhardt": ("Kenhardt", "Northern Cape"),
}

PROVINCES = {
    "western cape": "Western Cape",
    "eastern cape": "Eastern Cape",
    "northern cape": "Northern Cape",
    "gauteng": "Gauteng",
    "gp": "Gauteng",
    "kwazulu-natal": "KwaZulu-Natal",
    "kwazulu natal": "KwaZulu-Natal",
    "kzn": "KwaZulu-Natal",
    "free state": "Free State",
    "limpopo": "Limpopo",
    "mpumalanga": "Mpumalanga",
    "north west": "North West",
}

COUNTRY_ONLY = {"south africa", "sa"}


@dataclass
class PreparedJob:
    raw: dict
    title: str
    company: str
    location: str
    description: str
    requirements: str | None
    salary: str | None
    posting_date: str
    link: str
    company_url: str | None
    category: str
    industry: str | None
    source: str | None
    logo_url: str | None
    slug: str


@dataclass
class GenerateResult:
    written: int = 0
    removed: int = 0
    skipped: list[str] = field(default_factory=list)
    slugs: list[str] = field(default_factory=list)


def fnv1a(text: str) -> str:
    hash_value = 2166136261
    for byte in text.encode("utf-8"):
        hash_value ^= byte
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    return f"{hash_value:08x}"


def slug_part(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def display_title(job: dict) -> str:
    return str(job.get("title") or "").strip() or "Untitled role"


def display_company(job: dict) -> str:
    return str(job.get("company") or "").strip() or "Unknown company"


def base_slug(job: dict) -> str:
    title = display_title(job)
    company = display_company(job)
    link = str(job.get("link") or "").strip()
    base = slug_part(f"{title}-{company}")[:60].strip("-")
    suffix = fnv1a(link or f"{title}\n{company}")[:8]
    return f"{base}-{suffix}" if base else suffix


def assign_slugs(jobs: list[dict]) -> list[str]:
    seen: dict[str, int] = {}
    slugs: list[str] = []
    for job in jobs:
        slug = base_slug(job)
        count = seen.get(slug, 0) + 1
        seen[slug] = count
        if count > 1:
            slug = f"{slug}-{count}"
        slugs.append(slug)
    return slugs


def http_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.startswith("https://") or text.startswith("http://"):
        return text
    return None


def parse_salary(salary: object) -> dict | None:
    if not isinstance(salary, str):
        return None
    text = salary.strip()
    zar = ZAR_RANGE.fullmatch(text)
    if zar:
        low = int(zar.group(1).replace(",", ""))
        high = int(zar.group(2).replace(",", ""))
        return _salary("ZAR", "MONTH", low, high)
    usd = USD_YEAR_RANGE.fullmatch(text)
    if usd:
        low = int(round(float(usd.group(1)) * 1000))
        high = int(round(float(usd.group(2)) * 1000))
        return _salary("USD", "YEAR", low, high)
    return None


def _salary(currency: str, unit: str, low: int, high: int) -> dict | None:
    if low <= 0 or high <= 0 or low > high:
        return None
    value: dict = {"@type": "QuantitativeValue", "unitText": unit}
    if low == high:
        value["value"] = low
    else:
        value["minValue"] = low
        value["maxValue"] = high
    return {"@type": "MonetaryAmount", "currency": currency, "value": value}


def is_hybrid(location: str) -> bool:
    return bool(HYBRID_RE.search(location or ""))


def is_remote(location: str) -> bool:
    if is_hybrid(location):
        return False
    return bool(REMOTE_RE.search(location or ""))


def norm_key(text: str) -> str:
    text = text.replace("–", "-").replace("—", "-").lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def strip_notes(location: str) -> str:
    text = location.strip().replace("–", "-").replace("—", "-")
    text = re.sub(r"\s*-\s*hybrid\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\([^)]*\)", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -;")


def resolve_fragment(fragment: str) -> tuple[str | None, str | None] | None:
    key = norm_key(fragment)
    if not key:
        return None
    if key in PLACES:
        return PLACES[key]
    if key in PROVINCES:
        return (None, PROVINCES[key])
    if key in COUNTRY_ONLY:
        return (None, None)
    return None


def postal_address(locality: str | None, region: str | None) -> dict:
    address: dict = {"@type": "PostalAddress", "addressCountry": "ZA"}
    if locality:
        address["addressLocality"] = locality
    if region:
        address["addressRegion"] = region
    return {"@type": "Place", "address": address}


def onsite_locations(location: str) -> list[dict]:
    raw = location.strip()
    if re.search(r"ad title", raw, re.IGNORECASE) and re.search(r"\bgauteng\b", raw, re.IGNORECASE):
        return [postal_address(None, "Gauteng")]

    key = norm_key(raw)
    if key in {"johannesburg,pretoria", "johannesburg, pretoria"}:
        return [
            postal_address("Johannesburg", "Gauteng"),
            postal_address("Pretoria", "Gauteng"),
        ]

    cleaned = strip_notes(raw)
    direct = resolve_fragment(cleaned)
    if direct is not None and norm_key(cleaned) in PLACES or norm_key(cleaned) in PROVINCES:
        locality, region = direct
        if locality or region:
            return [postal_address(locality, region)]
    if norm_key(cleaned) in COUNTRY_ONLY or norm_key(raw) in COUNTRY_ONLY:
        return [postal_address(None, None)]

    parts = [part.strip() for part in re.split(r",|\s+-\s+", cleaned) if part.strip()]
    if len(parts) >= 2:
        locality = None
        region = None
        recognized = False
        for part in parts:
            resolved = resolve_fragment(part)
            if resolved is None:
                if locality is None:
                    locality = part
                continue
            recognized = True
            part_locality, part_region = resolved
            if part_region:
                region = part_region
            if part_locality and locality is None:
                locality = part_locality
        if recognized or locality:
            return [postal_address(locality, region)]

    fallback = cleaned or raw
    resolved = resolve_fragment(fallback)
    if resolved:
        locality, region = resolved
        return [postal_address(locality, region)]
    return [postal_address(fallback, None)]


def applicant_requirements(location: str) -> dict | list:
    match = BASED_IN_RE.search(location or "")
    if not match:
        return {"@type": "Country", "name": "South Africa"}
    cities = []
    for group in (match.group(1), match.group(2)):
        name = re.sub(r"\s+", " ", group).strip(" .")
        resolved = resolve_fragment(name)
        label = resolved[0] if resolved and resolved[0] else name
        cities.append({"@type": "City", "name": f"{label}, South Africa"})
    return cities


def company_initials(name: str) -> str:
    cleaned = re.sub(r"\(.*?\)", "", name or "").strip()
    parts = [part for part in cleaned.split() if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def format_posted(iso_date: str) -> str:
    parsed = datetime.strptime(iso_date, "%Y-%m-%d")
    return f"{parsed.day} {parsed.strftime('%b')} {parsed.year}"


def meta_description(job: PreparedJob) -> str:
    text = re.sub(r"\s+", " ", job.description).strip()
    if len(text) > 140:
        text = text[:140].rsplit(" ", 1)[0].rstrip(".,;:") + "…"
    where = job.location or "South Africa"
    line = f"{text} {job.company}, {where}."
    if len(line) > 180:
        line = line[:177].rstrip() + "…"
    return line


def schema_description(job: PreparedJob) -> str:
    parts = [f"<p>{html.escape(job.description)}</p>"]
    if job.requirements:
        parts.append("<p><strong>Requirements</strong></p>")
        parts.append(f"<p>{html.escape(job.requirements)}</p>")
    return "".join(parts)


def build_jobposting(job: PreparedJob, today: date) -> dict:
    posting: dict = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": job.title,
        "description": schema_description(job),
        "datePosted": job.posting_date,
        "validThrough": (today + timedelta(days=VALID_DAYS)).isoformat(),
        "directApply": False,
        "hiringOrganization": {"@type": "Organization", "name": job.company},
    }
    org = posting["hiringOrganization"]
    if job.company_url:
        org["sameAs"] = job.company_url
    if job.logo_url:
        org["logo"] = job.logo_url
    if is_remote(job.location):
        posting["jobLocationType"] = "TELECOMMUTE"
        posting["applicantLocationRequirements"] = applicant_requirements(job.location)
    else:
        places = onsite_locations(job.location)
        posting["jobLocation"] = places[0] if len(places) == 1 else places
    salary = parse_salary(job.salary)
    if salary:
        posting["baseSalary"] = salary
    return posting


def validate_jobposting(data: dict, job: PreparedJob, today: date) -> list[str]:
    errors: list[str] = []
    if data.get("@context") not in {"https://schema.org", "https://schema.org/"}:
        errors.append("@context")
    if data.get("@type") != "JobPosting":
        errors.append("@type")
    if data.get("title") != job.title or not job.title:
        errors.append("title")
    description = data.get("description")
    if not isinstance(description, str) or "<p>" not in description:
        errors.append("description html")
    elif job.title and description.strip() in {job.title, f"<p>{html.escape(job.title)}</p>"}:
        errors.append("description equals title")
    if data.get("datePosted") != job.posting_date or not ISO_DATE.fullmatch(job.posting_date or ""):
        errors.append("datePosted")
    expected_through = (today + timedelta(days=VALID_DAYS)).isoformat()
    if data.get("validThrough") != expected_through:
        errors.append("validThrough")
    if data.get("directApply") is not False:
        errors.append("directApply")
    if "employmentType" in data or "identifier" in data:
        errors.append("unexpected optional field")

    org = data.get("hiringOrganization")
    if not isinstance(org, dict) or org.get("@type") != "Organization" or org.get("name") != job.company:
        errors.append("hiringOrganization")
    else:
        if job.company_url:
            if org.get("sameAs") != job.company_url:
                errors.append("sameAs")
        elif "sameAs" in org:
            errors.append("unexpected sameAs")
        if job.logo_url:
            if org.get("logo") != job.logo_url:
                errors.append("logo")
        elif "logo" in org:
            errors.append("unexpected logo")

    remote = is_remote(job.location)
    if remote:
        if data.get("jobLocationType") != "TELECOMMUTE":
            errors.append("jobLocationType")
        if "jobLocation" in data:
            errors.append("remote jobLocation")
        areas = data.get("applicantLocationRequirements")
        area_list = areas if isinstance(areas, list) else [areas]
        if not area_list or not all(_valid_area(area) for area in area_list):
            errors.append("applicantLocationRequirements")
    else:
        if "jobLocationType" in data or "applicantLocationRequirements" in data:
            errors.append("unexpected telecommute")
        places = data.get("jobLocation")
        place_list = places if isinstance(places, list) else [places]
        if not place_list or not all(_valid_place(place) for place in place_list):
            errors.append("jobLocation")

    parsed = parse_salary(job.salary)
    if parsed:
        if data.get("baseSalary") != parsed:
            errors.append("baseSalary")
    elif "baseSalary" in data:
        errors.append("unparsed baseSalary")
    salary = data.get("baseSalary")
    if isinstance(salary, dict):
        unit = (salary.get("value") or {}).get("unitText")
        if unit not in SALARY_UNITS:
            errors.append("salary unit")
        address_bits = json.dumps(salary)
        if "streetAddress" in address_bits:
            errors.append("salary street")

    blob = json.dumps(data)
    if "streetAddress" in blob or "postalCode" in blob:
        errors.append("fabricated address detail")
    return errors


def _valid_area(area: object) -> bool:
    if not isinstance(area, dict):
        return False
    if area.get("@type") not in {"Country", "City", "State", "AdministrativeArea"}:
        return False
    name = area.get("name")
    return isinstance(name, str) and bool(name.strip())


def _valid_place(place: object) -> bool:
    if not isinstance(place, dict) or place.get("@type") != "Place":
        return False
    address = place.get("address")
    if not isinstance(address, dict) or address.get("@type") != "PostalAddress":
        return False
    country = address.get("addressCountry")
    if not isinstance(country, str) or not country.strip():
        return False
    for key in ("streetAddress", "postalCode"):
        if key in address:
            return False
    return True


def skip_reason(job: dict) -> str | None:
    title = str(job.get("title") or "").strip()
    company = str(job.get("company") or "").strip()
    description = str(job.get("description") or "").strip()
    posting_date = str(job.get("posting_date") or "").strip()
    location = str(job.get("location") or "").strip()
    if not title:
        return "missing title"
    if not company:
        return "missing company"
    if not description:
        return "missing description"
    if not ISO_DATE.fullmatch(posting_date):
        return "invalid posting_date"
    try:
        datetime.strptime(posting_date, "%Y-%m-%d")
    except ValueError:
        return "invalid posting_date"
    if not location:
        return "missing location"
    if not http_url(job.get("link")):
        return "missing apply link"
    return None


def public_description(title: str, company: str, location: str, description: str) -> str:
    text = description.strip()
    if text != title.strip():
        return text
    where = f", {location}" if location else ""
    return f"{text} — {company}{where}."


def prepare(raw_jobs: list[dict]) -> tuple[list[PreparedJob], list[str]]:
    slugs = assign_slugs(raw_jobs)
    prepared: list[PreparedJob] = []
    skipped: list[str] = []
    for index, raw in enumerate(raw_jobs):
        reason = skip_reason(raw)
        label = display_title(raw) if isinstance(raw, dict) else f"row {index}"
        if not isinstance(raw, dict):
            skipped.append(f"row {index}: not an object")
            continue
        if reason:
            skipped.append(f"{label}: {reason}")
            continue
        description = public_description(
            display_title(raw),
            display_company(raw),
            str(raw.get("location") or "").strip(),
            str(raw.get("description") or ""),
        )
        requirements = raw.get("requirements")
        requirement_text = str(requirements).strip() if isinstance(requirements, str) and requirements.strip() else None
        salary = raw.get("salary")
        salary_text = str(salary).strip() if isinstance(salary, str) and salary.strip() else None
        prepared.append(
            PreparedJob(
                raw=raw,
                title=display_title(raw),
                company=display_company(raw),
                location=str(raw.get("location") or "").strip(),
                description=description,
                requirements=requirement_text,
                salary=salary_text,
                posting_date=str(raw.get("posting_date")).strip(),
                link=http_url(raw.get("link")) or "",
                company_url=http_url(raw.get("company_url")),
                category=str(raw.get("category") or "").strip() or "Uncategorized",
                industry=str(raw.get("industry") or "").strip() or None,
                source=str(raw.get("source") or "").strip() or None,
                logo_url=http_url(raw.get("logo_url")),
                slug=slugs[index],
            )
        )
    return prepared, skipped


def render_page(job: PreparedJob, posting: dict) -> str:
    url = f"{SITE}/{JOBS_DIR_NAME}/{job.slug}/"
    title = f"{job.title} at {job.company} | The Intake"
    description = meta_description(job)
    schema = json.dumps(posting, ensure_ascii=False, indent=2).replace("<", r"\u003c")
    logo_html = logo_markup(job)
    facts = [
        ("Industry", job.industry or "—"),
        ("Listed on", job.source or "—"),
        ("Posted", format_posted(job.posting_date)),
        ("Salary", job.salary or "Not listed"),
        ("Location", job.location or "—"),
    ]
    fact_html = "\n".join(
        f"""        <div>
          <dt>{html.escape(label)}</dt>
          <dd>{html.escape(value)}</dd>
        </div>"""
        for label, value in facts
    )
    requirements_block = ""
    if job.requirements:
        requirements_block = (
            f'\n      <h2 class="posting-subhead">Requirements</h2>\n'
            f'      <p class="dialog-desc">{html.escape(job.requirements)}</p>'
        )
    company_button = ""
    if job.company_url:
        company_button = (
            f'\n        <a class="btn btn-secondary" href="{html.escape(job.company_url, quote=True)}" '
            f'target="_blank" rel="noopener noreferrer">Company website</a>'
        )
    image = job.logo_url or f"{SITE}/logo.jpg"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Generated from jobs.json by scripts/generate_job_pages.py. Do not edit by hand. -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZZCTW6D9QV"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-ZZCTW6D9QV');
  </script>
  <script>
    !function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '2066436563865929');
    fbq('track', 'PageView');
  </script>
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description, quote=True)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#1a5f7a" />
  <link rel="canonical" href="{html.escape(url, quote=True)}" />
  <link rel="icon" href="/logo-icon.png?v=20261114e" type="image/png" />
  <link rel="icon" href="/favicon-32.png?v=20261114e" type="image/png" sizes="32x32" />
  <link rel="icon" href="/favicon-16.png?v=20261114e" type="image/png" sizes="16x16" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261114e" sizes="180x180" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="The Intake" />
  <meta property="og:title" content="{html.escape(title, quote=True)}" />
  <meta property="og:description" content="{html.escape(description, quote=True)}" />
  <meta property="og:url" content="{html.escape(url, quote=True)}" />
  <meta property="og:image" content="{html.escape(image, quote=True)}" />
  <meta property="og:locale" content="en_ZA" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{html.escape(title, quote=True)}" />
  <meta name="twitter:description" content="{html.escape(description, quote=True)}" />
  <meta name="twitter:image" content="{html.escape(image, quote=True)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?v={ASSET_VERSION}" />
  <script type="application/ld+json">
{schema}
  </script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="The Intake">
        <img class="brand-logo" src="/logo.jpg" alt="The Intake" width="220" height="124" />
      </a>
      <nav class="header-nav" id="site-nav" aria-label="Primary">
        <a href="/#listings">Find jobs</a>
        <a href="/cv.html">CV builder</a>
      </nav>
      <p class="header-count"><a href="/#listings">All jobs</a></p>
      <button
        type="button"
        class="nav-toggle"
        id="nav-toggle"
        aria-expanded="false"
        aria-controls="site-nav"
        aria-label="Open menu"
      >
        <span class="nav-toggle-bars" aria-hidden="true"></span>
      </button>
    </div>
  </header>

  <main class="posting">
    <article class="posting-inner">
      <p class="posting-back"><a href="/#listings">← All jobs</a></p>
      <div class="dialog-body posting-article">
        <div class="dialog-header">
          {logo_html}
          <div class="dialog-heading">
            <p class="dialog-eyebrow">{html.escape(job.category)}</p>
            <h1>{html.escape(job.title)}</h1>
            <p class="dialog-meta">{html.escape(job.company)} · {html.escape(job.location)}</p>
          </div>
        </div>
        <p class="dialog-desc">{html.escape(job.description)}</p>{requirements_block}
        <dl class="dialog-facts">
{fact_html}
        </dl>
        <div class="dialog-actions">
          <a class="btn btn-primary" href="{html.escape(job.link, quote=True)}" target="_blank" rel="noopener noreferrer">Apply now</a>{company_button}
        </div>
        <p class="posting-note">Listed on The Intake for {html.escape(job.company)}. Apply now opens the original posting.</p>
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <a class="footer-brand" href="/" aria-label="The Intake">
        <img class="footer-logo" src="/logo.jpg" alt="The Intake" width="160" height="90" />
      </a>
      <p class="footer-note">Discover roles that fit.</p>
    </div>
  </footer>
  <script src="/nav.js?v=20261114j"></script>
</body>
</html>
"""


def logo_markup(job: PreparedJob) -> str:
    initials = html.escape(company_initials(job.company))
    if not job.logo_url:
        return f'<div class="job-logo job-logo-lg is-fallback" aria-hidden="true"><span class="job-logo-fallback">{initials}</span></div>'
    src = html.escape(job.logo_url, quote=True)
    return (
        '<div class="job-logo job-logo-lg" aria-hidden="true">'
        f'<span class="job-logo-fallback">{initials}</span>'
        f'<img class="job-logo-img" src="{src}" alt="" loading="lazy" decoding="async" '
        "referrerpolicy=\"no-referrer\" "
        "onerror=\"this.closest('.job-logo').classList.add('is-fallback')\" />"
        "</div>"
    )


def render_sitemap(jobs: list[PreparedJob], today: date) -> str:
    lastmod = today.isoformat()
    urls = [
        ("/", "daily", "1.0", lastmod),
        ("/cv.html", "weekly", "0.8", None),
        ("/links.html", "monthly", "0.5", None),
    ]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, freq, priority, modified in urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(SITE + path)}</loc>")
        if modified:
            lines.append(f"    <lastmod>{modified}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    for job in jobs:
        loc = html.escape(f"{SITE}/{JOBS_DIR_NAME}/{job.slug}/")
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                "    <changefreq>weekly</changefreq>",
                "    <priority>0.8</priority>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def render_robots() -> str:
    return f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n"


def generate(root: Path, today: date | None = None) -> GenerateResult:
    today = today or datetime.now(timezone.utc).date()
    payload = json.loads((root / "jobs.json").read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit("jobs.json must be a JSON array")
    prepared, skipped = prepare(payload)
    pages: list[tuple[str, str]] = []
    errors: list[str] = []
    for job in prepared:
        posting = build_jobposting(job, today)
        problems = validate_jobposting(posting, job, today)
        if problems:
            errors.append(f"{job.slug}: {', '.join(problems)}")
            continue
        pages.append((job.slug, render_page(job, posting)))
    if errors:
        raise SystemExit("Refusing to write invalid JobPosting pages:\n" + "\n".join(errors))

    jobs_dir = root / JOBS_DIR_NAME
    jobs_dir.mkdir(exist_ok=True)
    expected = {slug for slug, _ in pages}
    removed = 0
    for child in jobs_dir.iterdir():
        if child.is_dir() and (child / "index.html").is_file() and child.name not in expected:
            shutil.rmtree(child)
            removed += 1
    for slug, page in pages:
        destination = jobs_dir / slug
        destination.mkdir(exist_ok=True)
        (destination / "index.html").write_text(page, encoding="utf-8")
    written_jobs = [job for job in prepared if job.slug in expected]
    (root / "sitemap.xml").write_text(render_sitemap(written_jobs, today), encoding="utf-8")
    (root / "robots.txt").write_text(render_robots(), encoding="utf-8")
    return GenerateResult(
        written=len(pages),
        removed=removed,
        skipped=skipped,
        slugs=[job.slug for job in written_jobs],
    )


def main(argv: list[str]) -> int:
    root = Path(argv[1]).resolve() if len(argv) > 1 else ROOT
    today = date.fromisoformat(argv[2]) if len(argv) > 2 else datetime.now(timezone.utc).date()
    result = generate(root, today)
    print(
        f"Wrote {result.written} job pages, removed {result.removed}, skipped {len(result.skipped)}."
    )
    for line in result.skipped:
        print(f"skipped: {line}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
