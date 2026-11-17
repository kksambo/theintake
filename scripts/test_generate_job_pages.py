#!/usr/bin/env python3
"""Checks slug parity with job-slug.js and JobPosting required properties."""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODAY = date(2026, 11, 17)


def load_generator():
    path = ROOT / "scripts" / "generate_job_pages.py"
    spec = importlib.util.spec_from_file_location("generate_job_pages", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["generate_job_pages"] = module
    spec.loader.exec_module(module)
    return module


GEN = load_generator()


def load_jobs():
    return json.loads((ROOT / "jobs.json").read_text(encoding="utf-8"))


def js_slugs(jobs):
    with tempfile.TemporaryDirectory() as tmp:
        payload = Path(tmp) / "jobs.json"
        payload.write_text(json.dumps(jobs), encoding="utf-8")
        script = f"""
          const {{assignSlugs}} = require({json.dumps(str(ROOT / "job-slug.js"))});
          const jobs = require({json.dumps(str(payload))});
          process.stdout.write(JSON.stringify(assignSlugs(jobs)));
        """
        completed = subprocess.run(
            ["node", "-e", script],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(completed.stdout)


class SlugTests(unittest.TestCase):
    def test_python_matches_javascript_for_the_live_feed(self):
        jobs = load_jobs()
        self.assertEqual(GEN.assign_slugs(jobs), js_slugs(jobs))

    def test_slugs_are_unique_and_readable(self):
        slugs = GEN.assign_slugs(load_jobs())
        self.assertEqual(len(slugs), len(set(slugs)))
        for slug in slugs:
            self.assertRegex(slug, r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            self.assertLessEqual(len(slug), 80)

    def test_collision_suffix_is_stable(self):
        jobs = [
            {"title": "Nurse", "company": "Clinic", "link": "https://example.com/a"},
            {"title": "Nurse", "company": "Clinic", "link": "https://example.com/a"},
        ]
        first, second = GEN.assign_slugs(jobs)
        self.assertTrue(second.startswith(first + "-"))
        self.assertEqual(GEN.assign_slugs(jobs), js_slugs(jobs))


class SalaryTests(unittest.TestCase):
    def test_rand_monthly_range(self):
        parsed = GEN.parse_salary("R30,000 - R42,500 per month")
        self.assertEqual(parsed["currency"], "ZAR")
        self.assertEqual(parsed["value"]["unitText"], "MONTH")
        self.assertEqual(parsed["value"]["minValue"], 30000)
        self.assertEqual(parsed["value"]["maxValue"], 42500)

    def test_usd_yearly_range(self):
        parsed = GEN.parse_salary("$35.3k–$52k/yr (Remotive)")
        self.assertEqual(parsed["currency"], "USD")
        self.assertEqual(parsed["value"]["unitText"], "YEAR")
        self.assertEqual(parsed["value"]["minValue"], 35300)
        self.assertEqual(parsed["value"]["maxValue"], 52000)

    def test_up_to_and_package_are_not_base_salary(self):
        self.assertIsNone(GEN.parse_salary("Up to USD 88,000 total annual package"))
        self.assertIsNone(GEN.parse_salary("Competitive"))
        self.assertIsNone(GEN.parse_salary(None))


class LocationTests(unittest.TestCase):
    def test_remote_hybrid_and_office(self):
        self.assertTrue(GEN.is_remote("Remote – South Africa"))
        self.assertTrue(GEN.is_remote("Remote – must be based in Johannesburg or Cape Town"))
        self.assertFalse(GEN.is_remote("Cape Town – hybrid (2 office / 3 remote)"))
        self.assertFalse(GEN.is_remote("Johannesburg, Gauteng"))

        restricted = GEN.applicant_requirements(
            "Remote – must be based in Johannesburg or Cape Town"
        )
        self.assertEqual(
            [area["name"] for area in restricted],
            ["Johannesburg, South Africa", "Cape Town, South Africa"],
        )
        self.assertEqual(
            GEN.applicant_requirements("Remote – worldwide (SA eligible)"),
            {"@type": "Country", "name": "South Africa"},
        )

    def test_every_live_location_resolves_without_invented_streets(self):
        jobs = load_jobs()
        seen = {}
        for job in jobs:
            location = job["location"]
            if location in seen:
                continue
            if GEN.is_remote(location):
                seen[location] = "remote"
                continue
            places = GEN.onsite_locations(location)
            self.assertGreaterEqual(len(places), 1, location)
            for place in places:
                address = place["address"]
                self.assertEqual(address["addressCountry"], "ZA", location)
                self.assertNotIn("streetAddress", address, location)
                self.assertNotIn("postalCode", address, location)
                self.assertTrue(address.get("addressLocality") or address.get("addressRegion") or address["addressCountry"])
            seen[location] = places


class PageTests(unittest.TestCase):
    def test_generator_writes_valid_pages_and_drops_removed_jobs(self):
        jobs = load_jobs()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "jobs.json").write_text(json.dumps(jobs), encoding="utf-8")
            stale = root / "jobs" / "this-role-left-the-feed-abcdef12"
            stale.mkdir(parents=True)
            (stale / "index.html").write_text("old", encoding="utf-8")

            result = GEN.generate(root, TODAY)
            self.assertEqual(result.skipped, [])
            self.assertEqual(result.written, len(jobs))
            self.assertEqual(result.removed, 1)
            self.assertFalse(stale.exists())

            sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
            robots = (root / "robots.txt").read_text(encoding="utf-8")
            self.assertIn("Sitemap: https://theintake.co.za/sitemap.xml", robots)
            self.assertIn("https://theintake.co.za/", sitemap)
            self.assertIn("https://theintake.co.za/cv.html", sitemap)
            self.assertIn("https://theintake.co.za/links.html", sitemap)
            self.assertEqual(sitemap.count("<loc>"), len(jobs) + 3)

            samples = _sample_jobs(jobs, result.slugs)
            for job, slug in samples:
                page = (root / "jobs" / slug / "index.html").read_text(encoding="utf-8")
                self.assertIn(f"<h1>{_escape(job['title'])}</h1>", page)
                self.assertIn(job["link"], page.replace("&amp;", "&"))
                self.assertIn("Apply now", page)
                if job.get("company_url"):
                    self.assertIn(job["company_url"], page.replace("&amp;", "&"))
                if job.get("logo_url"):
                    self.assertIn(job["logo_url"], page.replace("&amp;", "&"))
                data = _json_ld(page)
                prepared = _prepared(job, slug)
                errors = GEN.validate_jobposting(data, prepared, TODAY)
                self.assertEqual(errors, [], slug)
                self.assertEqual(data["directApply"], False)
                self.assertNotIn("employmentType", data)
                self.assertEqual(data["validThrough"], "2026-12-17")
                self.assertEqual(data["datePosted"], job["posting_date"])
                self.assertEqual(data["hiringOrganization"]["name"], job["company"])
                if job.get("salary") and GEN.parse_salary(job["salary"]):
                    self.assertIn(job["salary"], page)
                    self.assertIn("baseSalary", data)
                else:
                    self.assertNotIn("baseSalary", data)
                if GEN.is_remote(job["location"]):
                    self.assertEqual(data["jobLocationType"], "TELECOMMUTE")
                    self.assertNotIn("jobLocation", data)
                else:
                    self.assertNotIn("jobLocationType", data)
                    places = data["jobLocation"]
                    places = places if isinstance(places, list) else [places]
                    for place in places:
                        self.assertEqual(place["address"]["addressCountry"], "ZA")

            second = GEN.generate(root, TODAY)
            self.assertEqual(second.removed, 0)
            self.assertEqual(second.written, len(jobs))


def _sample_jobs(jobs, slugs):
    picked = []
    wanted = {
        "salary": lambda job: bool(GEN.parse_salary(job.get("salary"))),
        "unparsed_salary": lambda job: bool(job.get("salary")) and not GEN.parse_salary(job.get("salary")),
        "remote": lambda job: GEN.is_remote(job["location"]),
        "hybrid": lambda job: GEN.is_hybrid(job["location"]),
        "no_logo": lambda job: not job.get("logo_url"),
        "requirements": lambda job: bool(job.get("requirements")),
        "province_only": lambda job: job["location"] == "Gauteng",
        "country_only": lambda job: job["location"] == "South Africa",
    }
    used = set()
    for name, predicate in wanted.items():
        for index, job in enumerate(jobs):
            if index in used or not predicate(job):
                continue
            used.add(index)
            picked.append((job, slugs[index]))
            break
        else:
            raise AssertionError(f"missing sample for {name}")
    return picked


def _prepared(job, slug):
    prepared, skipped = GEN.prepare([job])
    if skipped:
        raise AssertionError(skipped)
    prepared[0].slug = slug
    return prepared[0]


def _json_ld(page: str) -> dict:
    match = re.search(
        r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
        page,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("missing JSON-LD")
    return json.loads(match.group(1))


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


if __name__ == "__main__":
    unittest.main()
