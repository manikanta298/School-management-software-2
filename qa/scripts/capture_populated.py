#!/usr/bin/env python3
"""Take screenshots of the populated dashboard + key module pages for the CRUD test report."""
import os, time
from playwright.sync_api import sync_playwright

SITE = "https://school-management-software-2.vercel.app/"
EMAIL = os.environ.get("QA_EMAIL", "")
PWD = os.environ.get("QA_PASSWORD", "")
SHOTS = "/home/z/my-project/download/crud-screenshots"
os.makedirs(SHOTS, exist_ok=True)

MODULES_TO_SHOT = [
    ("Overview",            "01-overview-populated.png"),
    ("Students & parents",  "02-students-populated.png"),
    ("Teachers",            "03-teachers-populated.png"),
    ("Academic setup",      "04-academic-populated.png"),
    ("Attendance",          "05-attendance-populated.png"),
    ("Fees & invoices",     "06-fees-populated.png"),
    ("Exams & results",     "07-exams-populated.png"),
    ("Notices",             "08-notices-populated.png"),
    ("Timetable",           "09-timetable-populated.png"),
    ("School calendar",     "10-calendar-populated.png"),
    ("User accounts",       "11-users-populated.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width":1440,"height":900})
    page = ctx.new_page()
    page.goto(SITE, wait_until="networkidle", timeout=20000)
    page.fill('input[type=email], [placeholder="Email"]', EMAIL)
    page.fill('input[type=password], [placeholder="Password"]', PWD)
    page.get_by_role("button", name="Sign in", exact=True).click()
    try: page.wait_for_load_state("networkidle", timeout=15000)
    except: pass
    time.sleep(3)
    for label, fname in MODULES_TO_SHOT:
        try:
            page.get_by_role("button", name=label, exact=True).first.click(timeout=5000)
            time.sleep(2)
            try: page.wait_for_load_state("networkidle", timeout=5000)
            except: pass
        except Exception as e:
            print(f"  nav {label}: failed {e}")
            continue
        path = os.path.join(SHOTS, fname)
        page.screenshot(path=path, full_page=False)
        print(f"  Saved {fname}")
    browser.close()
print("All screenshots captured")
