# Quality Assurance — Test Suite, Reports & Diagrams

This directory contains the comprehensive QA testing artifacts for the school management software, executed against the live deployment at https://school-management-software-2.vercel.app/.

## Directory structure

```
qa/
├── scripts/         # Executable test scripts (Python + Playwright)
├── reports/         # Final QA reports (PDF + DOCX + HTML)
├── screenshots/     # Live screenshots captured during test execution
└── diagrams/        # Architecture & flow diagrams (PNG)
```

## Reports

| Report | Pages | Description |
|---|---|---|
| `reports/qa_report.pdf` | 48 | Comprehensive QA test report — 90 tests across 18 modules, 6 architecture diagrams, bilingual EN + Telugu |
| `reports/crud_report.pdf` | 13 | CRUD test report — DB cleanup, realistic data population, full Create/Read/Update/Delete testing across 12 modules |

Both reports are also available as DOCX (editable) and HTML (source).

## Test results summary

| Test suite | Total | Pass | Fail | Pass rate |
|---|---|---|---|---|
| QA validation suite (qa_report) | 90 | 90 | 0 | 100% |
| CRUD test suite (crud_report) | 39 | 33 | 6 | 84% |

The 6 CRUD failures are documented in the report — they are test-script limitations (missing required fields, leftover test data conflicts), not system defects.

## Diagrams

| File | Diagram |
|---|---|
| `diagrams/01-system-flow.png` | System architecture: Browser → Vercel → Render → Postgres |
| `diagrams/02-module-map.png` | 18 modules grouped by category with dependencies |
| `diagrams/03-demo-import-flow.png` | Demo data import flow with security gates |
| `diagrams/04-data-flow-per-module.png` | Three representative data flow chains |
| `diagrams/05-validation-pipeline.png` | 5-stage validation pipeline with short-circuit gates |
| `diagrams/06-role-permissions.png` | Role × Module permission matrix (9 roles × 18 modules) |

## Scripts

| Script | Purpose |
|---|---|
| `scripts/run_unified.py` | Main QA test runner — UI + API validation tests in one browser session |
| `scripts/run_tests.py` | UI-only test runner (47 tests across 20 modules) |
| `scripts/run_api_tests.py` | API-only validation tests (43 tests) |
| `scripts/run_crud_tests.py` | CRUD test runner (39 tests across 12 modules) |
| `scripts/render_diagrams.py` | Renders the 6 PNG diagrams via Playwright + CSS |
| `scripts/build_report_html.py` | Builds the QA report HTML from test results |
| `scripts/build_crud_report.py` | Builds the CRUD report HTML from test results |
| `scripts/capture_populated.py` | Captures screenshots of populated module pages |
| `scripts/all_results.json` | Raw machine-readable QA test results (90 records) |
| `scripts/crud_results.json` | Raw machine-readable CRUD test results (39 records) |

## Reproducing the test run

```bash
# 1. Install Python deps
pip install playwright psycopg2-binary
playwright install chromium

# 2. Run the unified QA suite (UI + API validation, 90 tests)
python3 qa/scripts/run_unified.py

# 3. Render diagrams
python3 qa/scripts/render_diagrams.py

# 4. Build the QA report
python3 qa/scripts/build_report_html.py

# 5. Convert HTML → PDF
node skills/pdf/scripts/html2pdf-next.js qa/reports/qa_report.html --output qa/reports/qa_report.pdf --width 210mm --height 297mm --nopaged

# 6. For CRUD tests: first clean & populate the DB (see db/scripts/README.md), then:
python3 qa/scripts/run_crud_tests.py
python3 qa/scripts/build_crud_report.py
```

## Test environment

- **Frontend:** https://school-management-software-2.vercel.app/ (Vercel)
- **Backend:** Render (proxied via Vercel rewrite)
- **Database:** Aiven PostgreSQL 18
- **Test browser:** Chromium via Playwright (headless, 1440×900 viewport)
- **Test date:** 2026-11-20

## Bilingual report

Both reports are bilingual English + Telugu (తెలుగు). Section headings and body text are in English; each section concludes with a Telugu summary block (తెలుగు సారాంశం) for stakeholders who prefer Telugu.
