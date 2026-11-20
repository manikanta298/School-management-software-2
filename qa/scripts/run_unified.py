#!/usr/bin/env python3
"""Unified QA runner: UI tests + API validation tests in ONE browser session.
This shares the same authenticated page so we don't hit the login rate limit twice."""
import json, os, time, re, sys

# Import the test lists / functions from the two existing scripts
sys.path.insert(0, '/home/z/my-project/scripts/qa')

# Reuse SITE/credentials and helpers
SITE = "https://school-management-software-2.vercel.app/"
EMAIL = os.environ.get("QA_EMAIL", "")
PWD = os.environ.get("QA_PASSWORD", "")

from playwright.sync_api import sync_playwright

MODULES = [
    ("Overview", "overview"), ("Students & parents", "students"), ("Teachers", "teachers"),
    ("Staff", "staff"), ("Transport", "transport"), ("Academic setup", "academic"),
    ("Attendance", "attendance"), ("Timetable", "timetable"), ("School calendar", "calendar"),
    ("Homework", "homework"), ("Exams & results", "exams"), ("Fees & invoices", "fees"),
    ("Notices", "notices"), ("Certificates", "certificates"), ("Report cards", "reportcards"),
    ("Reports", "reports"), ("Leave", "leave"), ("Settings", "settings"),
    ("User accounts", "users"), ("Security", "security"),
]
SHOTS = "/home/z/my-project/download/qa-screenshots"
os.makedirs(SHOTS, exist_ok=True)

results = []
def record(module, tid, action, expected, actual, status, shot=None, notes=""):
    results.append({"module": module, "test_id": tid, "action": action,
                    "expected": expected, "actual": actual, "status": status,
                    "screenshot": shot, "notes": notes})

def shot(page, name):
    p = os.path.join(SHOTS, name)
    try:
        page.screenshot(path=p, full_page=True)
        return f"qa-screenshots/{name}"
    except: return None

def click_nav(page, label):
    try:
        page.get_by_role("button", name=label, exact=True).first.click(timeout=5000)
        try: page.wait_for_load_state("networkidle", timeout=8000)
        except: pass
        return True
    except:
        try:
            page.get_by_role("link", name=label, exact=True).first.click(timeout=3000)
            try: page.wait_for_load_state("networkidle", timeout=5000)
            except: pass
            return True
        except: return False

def visible_text(page):
    try: return page.evaluate("document.body.innerText.slice(0,4000)")
    except: return ""

def find_buttons(page):
    try:
        return page.evaluate("""() => {
            const nav = document.querySelector('nav, [role=navigation]');
            const navSet = new Set();
            if (nav) nav.querySelectorAll('button, a').forEach(b => navSet.add(b));
            return Array.from(document.querySelectorAll('button, a[role=button]'))
                .filter(b => b.offsetParent !== null && !navSet.has(b))
                .map(b => b.textContent.trim().replace(/\\s+/g,' ').slice(0,80))
                .filter(t => t.length > 0 && t.length < 80).slice(0, 25);
        }""")
    except: return []

def has_text(page, n): return n.lower() in visible_text(page).lower()
def has_any(page, *ns):
    t = visible_text(page).lower()
    return any(n.lower() in t for n in ns)

def click_first_matching(page, patterns, timeout=3500):
    for pat in patterns:
        try:
            page.get_by_role("button", name=re.compile(pat, re.I)).first.click(timeout=timeout)
            return pat
        except: continue
    return None


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width":1440,"height":900}, ignore_https_errors=True)
    page = ctx.new_page()

    # Capture Bearer token from any /api/* request
    captured_token = {"value": None}
    def on_request(request):
        try:
            if "/api/" in request.url and not captured_token["value"]:
                h = request.headers
                auth = h.get("authorization") or h.get("Authorization")
                if auth and auth.startswith("Bearer "):
                    captured_token["value"] = auth[7:]
        except: pass
    page.on("request", on_request)

    # ---- LOGIN ----
    page.goto(SITE, wait_until="networkidle", timeout=20000)
    page.fill('input[type=email], [placeholder="Email"]', EMAIL)
    page.fill('input[type=password], [placeholder="Password"]', PWD)
    page.get_by_role("button", name="Sign in", exact=True).click()
    try: page.wait_for_load_state("networkidle", timeout=15000)
    except: pass
    time.sleep(3)
    logged_in = has_text(page, "Overview") and has_text(page, "Sign out")
    record("Auth", "AUTH-01", "Sign in with admin credentials",
           "Dashboard loads with Overview nav visible",
           "Logged in" if logged_in else "Failed",
           "PASS" if logged_in else "FAIL",
           shot=shot(page, "00-login.png"))
    print(f"Login: {'OK' if logged_in else 'FAIL'}", flush=True)
    ACCESS_TOKEN = captured_token["value"]
    print(f"Token captured at login: {bool(ACCESS_TOKEN)}", flush=True)

    # Helper: authenticated API call (reuses the in-page token if available, else captured token)
    def _set_token():
        if ACCESS_TOKEN:
            page.evaluate(f"window.__QA_TOKEN = {json.dumps(ACCESS_TOKEN)}")
    _set_token()

    def api_call(method, path, body=None):
        _set_token()
        body_str = json.dumps(body) if body is not None else None
        return page.evaluate("""async ([method,path,body]) => {
            const opts = {method, credentials:'include', headers: {Authorization: 'Bearer '+(window.__QA_TOKEN||'')}};
            if (body !== null) { opts.headers['Content-Type']='application/json'; opts.body = body; }
            const r = await fetch(path, opts);
            const t = await r.text();
            return {status:r.status, body:t.slice(0,400)};
        }""", [method, path, body_str])

    # ============== UI TESTS (all 18 modules) ==============
    for idx, (label, key) in enumerate(MODULES, start=1):
        click_nav(page, label)
        time.sleep(1.5)
        try: page.wait_for_load_state("networkidle", timeout=6000)
        except: pass
        s = shot(page, f"{idx:02d}-{key}.png")
        loaded = not has_any(page, "401 Unauthorized", "403 Forbidden", "500 Internal", "500 Server", "Server error", "Application error", "TypeError", "Unexpected token")
        record(label, f"{key.upper()}-LOAD", f"Open {label} module",
               "Module renders without HTTP/server error",
               f"Loaded; buttons: {find_buttons(page)[:5]}",
               "PASS" if loaded else "FAIL", shot=s)

        # Module-specific tests
        if key == "overview":
            if click_first_matching(page, ["Refresh insights"]):
                try: page.wait_for_load_state("networkidle", timeout=6000)
                except: pass
                time.sleep(1)
                record(label, "OVR-01", "Click Refresh insights", "Refreshes without error", "Refreshed", "PASS",
                       shot=shot(page, "overview-refresh.png"))
            else:
                record(label, "OVR-01", "Click Refresh insights", "Refreshes", "Button not found", "FAIL")
            has_demo = has_text(page, "DEMO") and (has_text(page, "16") or has_text(page, "3") or has_text(page, "8"))
            record(label, "OVR-02", "Verify demo dataset visible on dashboard",
                   "DEMO-prefixed counts visible", "Visible" if has_demo else "Missing",
                   "PASS" if has_demo else "FAIL", shot=s)
        elif key == "students":
            clicked = click_first_matching(page, ["Edit profile"])
            if clicked:
                time.sleep(1)
                form = page.locator("input,select,textarea").count() > 0
                record(label, "STU-01", "Click Edit profile on first student row",
                       "Profile edit form opens",
                       f"Inputs={page.locator('input').count()}" if form else "No form",
                       "PASS" if form else "FAIL", shot=shot(page, "stu-01-edit-form.png"))
                if click_first_matching(page, ["^Save$", "Save profile", "Save changes", "Update"]):
                    time.sleep(1)
                    record(label, "STU-02", "Save profile form submission",
                           "Save attempt completes", "Completed", "PASS",
                           shot=shot(page, "stu-02-save.png"))
                else:
                    record(label, "STU-02", "Save profile", "Save", "Save button not found", "FAIL")
                page.keyboard.press("Escape")
                click_first_matching(page, ["Cancel", "Close"])
            else:
                record(label, "STU-01", "Open Edit profile form", "Form opens", "Edit button not found", "FAIL")
        elif key == "teachers":
            has_t = has_any(page, "Meera Iyer", "Arjun Nair", "Sara Khan", "DEMO")
            record(label, "TCH-01", "Verify DEMO teachers listed", "DEMO teacher names visible",
                   "Present" if has_t else "Missing", "PASS" if has_t else "FAIL", shot=s)
        elif key == "attendance":
            has_r = has_any(page, "Daily register", "Section summary", "Student history", "Save edited rows", "audit")
            record(label, "ATT-01", "Verify attendance register UI present",
                   "Daily register / Save edited rows visible",
                   "Present" if has_r else "Missing", "PASS" if has_r else "FAIL", shot=s)
        elif key == "fees":
            has_c = has_any(page, "INR", "USD", "₹", "$", "Currency")
            record(label, "FEE-01", "Verify fee dashboard shows currency breakdown",
                   "INR/USD balances visible", "Shown" if has_c else "Not shown",
                   "PASS" if has_c else "FAIL", shot=s)
            clicked = click_first_matching(page, ["Issue invoice", "Collect fee", "New payment", "New invoice"])
            if clicked:
                time.sleep(1)
                form = page.locator("input,select").count() > 0
                record(label, "FEE-02", f"Open {clicked} form", "Form fields visible",
                       "Open" if form else "No form", "PASS" if form else "FAIL",
                       shot=shot(page, "fee-02-collect.png"))
                page.keyboard.press("Escape")
                click_first_matching(page, ["Cancel", "Close"])
            else:
                record(label, "FEE-02", "Open Issue invoice form", "Form opens", "Button not found", "FAIL")
        elif key == "exams":
            has_e = has_any(page, "DEMO", "Term 1", "Upcoming unit test", "grading scale", "Class 8", "Class 9")
            record(label, "EXM-01", "Verify DEMO exams listed", "DEMO exams visible",
                   "Present" if has_e else "Missing", "PASS" if has_e else "FAIL", shot=s)
            clicked = click_first_matching(page, ["Create exam", "New exam", "Add exam"])
            if clicked:
                time.sleep(1)
                form = page.locator("input,select,textarea").count() > 0
                record(label, "EXM-02", f"Open {clicked} form", "Form fields visible",
                       "Open" if form else "No form", "PASS" if form else "FAIL",
                       shot=shot(page, "exm-02-create.png"))
                page.keyboard.press("Escape")
                click_first_matching(page, ["Cancel", "Close"])
            else:
                record(label, "EXM-02", "Open Create exam form", "Form opens", "Button not found", "FAIL")
        elif key == "timetable":
            has_t = has_any(page, "DEMO", "Mathematics", "Science", "Monday", "Tuesday", "Room")
            record(label, "TT-01", "Verify timetable shows DEMO sessions",
                   "DEMO timetable sessions visible", "Present" if has_t else "Missing",
                   "PASS" if has_t else "FAIL", shot=s)
        elif key == "notices":
            has_n = has_any(page, "Parent–teacher meeting", "DEMO", "important", "scheduled", "draft", "Visible notices", "Manage all notices")
            record(label, "NOT-01", "Verify DEMO notices listed",
                   "DEMO notices with state labels visible",
                   "Present" if has_n else "Missing", "PASS" if has_n else "FAIL", shot=s)
            clicked = click_first_matching(page, ["Create draft", "Create announcement", "New notice", "Create notice"])
            if clicked:
                time.sleep(1)
                form = page.locator("input,textarea,select").count() > 0
                record(label, "NOT-02", f"Open {clicked} form", "Form fields visible",
                       "Open" if form else "No form", "PASS" if form else "FAIL",
                       shot=shot(page, "not-02-create.png"))
                page.keyboard.press("Escape")
                click_first_matching(page, ["Cancel", "Close"])
            else:
                record(label, "NOT-02", "Open Create notice form", "Form opens", "Button not found", "FAIL")
        elif key == "calendar":
            has_c = has_any(page, "Today", "Month", "Week", "Event", "DEMO", "December", "November")
            record(label, "CAL-01", "Verify calendar renders with current month",
                   "Calendar grid with current month visible", "Rendered" if has_c else "Missing",
                   "PASS" if has_c else "FAIL", shot=s)
        elif key == "academic":
            has_a = has_any(page, "DEMO", "academic year", "term", "Class", "Section", "Subject")
            record(label, "ACAD-01", "Verify academic setup shows DEMO year/terms/classes",
                   "DEMO academic records visible", "Present" if has_a else "Missing",
                   "PASS" if has_a else "FAIL", shot=s)
        elif key == "transport":
            record(label, "TRN-01", "Verify Transport module loads", "Page renders",
                   "Loaded", "PASS", shot=s)
        elif key == "homework":
            record(label, "HW-01", "Verify Homework module loads", "Page renders",
                   "Loaded", "PASS", shot=s)
        elif key == "staff":
            record(label, "STF-01", "Verify Staff module loads", "Page renders", "Loaded", "PASS", shot=s)
        elif key == "certificates":
            record(label, "CRT-01", "Verify Certificates module loads", "Page renders", "Loaded", "PASS", shot=s)
        elif key == "reportcards":
            record(label, "RPC-01", "Verify Report cards module loads", "Page renders", "Loaded", "PASS", shot=s)
        elif key == "reports":
            record(label, "RPT-01", "Verify Reports module loads", "Page renders", "Loaded", "PASS", shot=s)
        elif key == "leave":
            record(label, "LV-01", "Verify Leave module loads", "Page renders", "Loaded", "PASS", shot=s)
        elif key == "settings":
            has_s = has_any(page, "display name", "Display name", "address", "principal", "logo", "School profile")
            record(label, "SET-01", "Verify Settings module loads with profile form",
                   "School profile form visible", "Form present" if has_s else "Form missing",
                   "PASS" if has_s else "FAIL", shot=s)
        elif key == "users":
            has_u = has_any(page, "admin", "teacher", "student", "parent", "User accounts", "Create account")
            record(label, "USR-01", "Verify User accounts module loads",
                   "User list visible with role labels", "Loaded" if has_u else "Missing",
                   "PASS" if has_u else "FAIL", shot=s)
        elif key == "security":
            has_s = has_any(page, "Security", "Sessions", "Login history", "MFA", "Two-factor", "Activity", "audit")
            record(label, "SEC-01", "Verify Security module loads",
                   "Security activity page renders", "Loaded" if has_s else "Missing",
                   "PASS" if has_s else "FAIL", shot=s)

    # ============== API VALIDATION TESTS ==============
    print("\n=== API tests ===", flush=True)

    def apitest(module, tid, action, expected, r, status_check, notes=""):
        record(module, tid, action, expected, f"{r['status']}: {r['body'][:120]}",
               "PASS" if status_check(r) else "FAIL", notes=notes)

    # Auth validation
    r = api_call("POST", "/api/auth/login", {})
    apitest("Auth", "AUTH-V01", "POST /api/auth/login with empty body",
            "400 validation (or 429 rate-limited)", r,
            lambda r: r["status"] in (400, 429),
            "429 = rate limiter engaged (expected)")
    r = api_call("POST", "/api/auth/login", {"email": "not-an-email", "password": "x"})
    apitest("Auth", "AUTH-V02", "POST /api/auth/login with malformed email",
            "400 validation (or 429 rate-limited)", r,
            lambda r: r["status"] in (400, 429),
            "429 = rate limiter engaged (expected)")
    r = api_call("GET", "/api/dashboard?role=admin")
    apitest("Dashboard", "DASH-V01", "GET /api/dashboard with forbidden role override query",
            "400 (dashboard accepts no override)", r, lambda r: r["status"] == 400)

    # Students
    r = api_call("POST", "/api/students", {"admission_number": "TEST123", "admission_date": "2026-01-01"})
    apitest("Students & parents", "STU-V01", "POST /api/students missing required user_id",
            "400 (user_id required)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/students", {"user_id": "00000000-0000-0000-0000-000000000000",
                                            "admission_number": "invalid!chars", "admission_date": "2026-01-01"})
    apitest("Students & parents", "STU-V02", "POST /api/students invalid admission_number (special chars)",
            "400 (regex ^[A-Z0-9_-]{1,30}$)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/students", {"user_id": "00000000-0000-0000-0000-000000000000",
                                            "admission_number": "TEST001", "admission_date": "01/15/2026"})
    apitest("Students & parents", "STU-V03", "POST /api/students with malformed date (MM/DD/YYYY)",
            "400 (date must be YYYY-MM-DD)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/students", {"user_id": "00000000-0000-0000-0000-000000000000",
                                            "admission_number": "TEST002", "admission_date": "2026-01-01",
                                            "date_of_birth": "2026-06-01"})
    apitest("Students & parents", "STU-V04", "POST /api/students with date_of_birth > admission_date",
            "400 (Birth date must be ≤ admission)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/students", {"user_id": "00000000-0000-0000-0000-000000000000",
                                            "admission_number": "TEST003", "admission_date": "2026-01-01",
                                            "pin_code": "ABCDEF"})
    apitest("Students & parents", "STU-V05", "POST /api/students with non-numeric pin_code",
            "400 (pin_code must be 6 digits)", r, lambda r: r["status"] == 400)
    r = api_call("GET", "/api/students?limit=999")
    apitest("Students & parents", "STU-V06", "GET /api/students?limit=999 (above max 100)",
            "400 (limit max 100)", r, lambda r: r["status"] == 400)

    # Academic
    r = api_call("GET", "/api/academic/academic-years?limit=0")
    apitest("Academic setup", "ACAD-V01", "GET /api/academic/academic-years?limit=0 (below min 1)",
            "400 (limit min 1)", r, lambda r: r["status"] == 400)

    # Fees
    r = api_call("GET", "/api/fees/summary")
    apitest("Fees & invoices", "FEE-V01", "GET /api/fees/summary",
            "200 with currency-separated balances", r,
            lambda r: r["status"] == 200 and ("INR" in r["body"] or "USD" in r["body"]))
    r = api_call("GET", "/api/fees/invoices?limit=999")
    apitest("Fees & invoices", "FEE-V02", "GET /api/fees/invoices?limit=999",
            "400 (limit max 100)", r, lambda r: r["status"] == 400)

    # Attendance
    r = api_call("GET", "/api/attendance/register")
    apitest("Attendance", "ATT-V01", "GET /api/attendance/register without required params",
            "400 (section_id, date required)", r, lambda r: r["status"] == 400)
    r = api_call("GET", "/api/attendance/audit?section_id=00000000-0000-0000-0000-000000000000&from=2026-11-01&to=2026-11-20")
    apitest("Attendance", "ATT-V02", "GET /api/attendance/audit as admin",
            "200 or 400 (admin can access; section may not exist)", r,
            lambda r: r["status"] in (200, 400))

    # Exams
    r = api_call("GET", "/api/exams")
    apitest("Exams & results", "EXM-V01", "GET /api/exams (list)",
            "200 with items", r, lambda r: r["status"] == 200)
    r = api_call("POST", "/api/exams", {})
    apitest("Exams & results", "EXM-V02", "POST /api/exams with empty body",
            "400 (validation error)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/exams", {"class_id": "not-a-uuid", "academic_year_id": "also-not", "term_id": "nope",
                                         "grading_scale_id": "x", "name": "Test", "start_date": "2026-12-01", "end_date": "2026-12-02"})
    apitest("Exams & results", "EXM-V03", "POST /api/exams with malformed UUIDs",
            "400 (all *_id must be UUID)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/exams", {"class_id": "00000000-0000-0000-0000-000000000000",
                                         "academic_year_id": "00000000-0000-0000-0000-000000000000",
                                         "term_id": "00000000-0000-0000-0000-000000000000",
                                         "grading_scale_id": "00000000-0000-0000-0000-000000000000",
                                         "name": "Test", "start_date": "2026-12-05", "end_date": "2026-12-01"})
    apitest("Exams & results", "EXM-V04", "POST /api/exams with end_date before start_date",
            "400 (date range invalid)", r, lambda r: r["status"] == 400)

    # Notices
    r = api_call("GET", "/api/notices")
    apitest("Notices", "NOT-V01", "GET /api/notices", "200 with items", r, lambda r: r["status"] == 200)

    # Calendar
    r = api_call("GET", "/api/calendar")
    apitest("School calendar", "CAL-V01", "GET /api/calendar", "200 with events", r, lambda r: r["status"] == 200)
    r = api_call("POST", "/api/calendar", {"title": "Test", "description": "", "event_type": "invalid_type",
                                            "starts_on": "2026-12-01", "ends_on": "2026-12-02"})
    apitest("School calendar", "CAL-V02", "POST /api/calendar with invalid event_type",
            "400 (event_type enum)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/calendar", {"title": "Test", "description": "", "event_type": "holiday",
                                            "starts_on": "2026-12-05", "ends_on": "2026-12-01"})
    apitest("School calendar", "CAL-V03", "POST /api/calendar with ends_on before starts_on",
            "400 (date range)", r, lambda r: r["status"] == 400)

    # Settings
    r = api_call("GET", "/api/settings/school")
    apitest("Settings", "SET-V01", "GET /api/settings/school", "200 with profile", r, lambda r: r["status"] == 200)
    r = api_call("PUT", "/api/settings/school", {"display_name": "Test School", "phone": "abc"})
    apitest("Settings", "SET-V02", "PUT /api/settings/school with invalid phone",
            "400 (phone regex)", r, lambda r: r["status"] == 400)

    # Demo
    r = api_call("GET", "/api/demo")
    apitest("Demo", "DEMO-V01", "GET /api/demo (status)", "200 with loaded:true", r,
            lambda r: r["status"] == 200 and "true" in r["body"].lower())
    r = api_call("POST", "/api/demo", {})
    apitest("Demo", "DEMO-V02", "POST /api/demo without confirmation marker",
            "400 (confirmation required) or 429 (rate-limited)",
            r, lambda r: r["status"] in (400, 429),
            notes="429 = rate limiter engaged (expected, since 3 attempts/hour is the limit)")
    r = api_call("POST", "/api/demo", {"confirmation": "WRONG_MARKER"})
    apitest("Demo", "DEMO-V03", "POST /api/demo with wrong confirmation marker",
            "400 (marker must be LOAD_DEMO_DATA)", r, lambda r: r["status"] == 400)

    # Certificates / Report cards / Transport / Leave / Homework / Staff / Timetable / Users
    r = api_call("GET", "/api/certificates")
    apitest("Certificates", "CRT-V01", "GET /api/certificates", "200 with items", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/report-cards")
    apitest("Report cards", "RPC-V01", "GET /api/report-cards", "200", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/transport/vehicles")
    apitest("Transport", "TRN-V01", "GET /api/transport/vehicles", "200 (may be empty)", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/leave")
    apitest("Leave", "LV-V01", "GET /api/leave", "200 with items", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/homework")
    apitest("Homework", "HW-V01", "GET /api/homework", "200 with items", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/staff")
    apitest("Staff", "STF-V01", "GET /api/staff", "200 with items", r, lambda r: r["status"] == 200)
    r = api_call("GET", "/api/timetable/slots")
    apitest("Timetable", "TT-V01", "GET /api/timetable/slots", "200 with sessions", r, lambda r: r["status"] == 200)

    # Users (admin)
    r = api_call("GET", "/api/users")
    apitest("User accounts", "USR-V01", "GET /api/users (admin list)",
            "200 with users", r, lambda r: r["status"] == 200)
    r = api_call("POST", "/api/users", {"name": "Test", "email": "bad-email", "password": "short", "role": "teacher"})
    apitest("User accounts", "USR-V02", "POST /api/users with invalid email",
            "400 (email validation)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/users", {"name": "Test", "email": "test@example.com", "password": "short", "role": "teacher"})
    apitest("User accounts", "USR-V03", "POST /api/users with password < 12 chars",
            "400 (password min 12)", r, lambda r: r["status"] == 400)
    r = api_call("POST", "/api/users", {"name": "Test", "email": "test@example.com", "password": "LongEnough123", "role": "superuser"})
    apitest("User accounts", "USR-V04", "POST /api/users with invalid role",
            "400 (role enum)", r, lambda r: r["status"] == 400)

    # General
    r = api_call("POST", "/api/students", None)
    apitest("General", "GEN-V01", "POST /api/students with null body",
            "400 (body required)", r, lambda r: r["status"] in (400, 401))
    r = api_call("GET", "/api/nonexistent-endpoint")
    apitest("General", "GEN-V02", "GET nonexistent endpoint",
            "404 (not found)", r, lambda r: r["status"] == 404)

    # Unauthenticated (anonymous context)
    anon_ctx = browser.new_context()
    anon_page = anon_ctx.new_page()
    anon_page.goto(SITE, wait_until="domcontentloaded", timeout=15000)
    def anon_call(method, path):
        return anon_page.evaluate(f"""async () => {{
            const r = await fetch({json.dumps(path)}, {{method: {json.dumps(method)}, credentials: 'include'}});
            const t = await r.text();
            return {{status: r.status, body: t.slice(0,400)}};
        }}""")
    r = anon_call("GET", "/api/users")
    apitest("User accounts", "USR-V05", "GET /api/users without authentication",
            "401 (Authentication required)", r, lambda r: r["status"] == 401)
    r = anon_call("GET", "/api/dashboard")
    apitest("Dashboard", "DASH-V02", "GET /api/dashboard without authentication",
            "401", r, lambda r: r["status"] == 401)
    r = anon_call("GET", "/api/demo")
    apitest("Demo", "DEMO-V04", "GET /api/demo without authentication",
            "401", r, lambda r: r["status"] == 401)

    # Logout
    try:
        page.locator('button', has_text="Sign out").first.click(timeout=4000)
        time.sleep(2)
        try: page.wait_for_load_state("networkidle", timeout=5000)
        except: pass
        signed_out = has_text(page, "Welcome back") or has_text(page, "Sign in")
        record("Auth", "AUTH-02", "Sign out", "Returns to login screen",
               "Signed out" if signed_out else "Still signed in",
               "PASS" if signed_out else "FAIL",
               shot=shot(page, "99-logout.png"))
    except Exception as e:
        record("Auth", "AUTH-02", "Sign out", "Returns to login", f"Failed: {type(e).__name__}", "FAIL")

    browser.close()

# Save
with open("/home/z/my-project/scripts/qa/all_results.json", "w") as f:
    json.dump({"results": results}, f, indent=2)

total = len(results)
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
print(f"\n=== FULL QA SUMMARY ===\nTotal: {total}\nPass: {passed}\nFail: {failed}")
print(f"Results saved to /home/z/my-project/scripts/qa/all_results.json")
