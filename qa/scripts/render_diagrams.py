#!/usr/bin/env python3
"""Render 6 QA diagrams as PNG via Playwright."""
import os, time
from playwright.sync_api import sync_playwright

OUT = "/home/z/my-project/download/qa-diagrams"
os.makedirs(OUT, exist_ok=True)

# Common CSS
BASE_CSS = """
@font-face { font-family: 'NotoTelugu'; src: url('file:///home/z/.fonts/NotoSansTelugu.ttf') format('truetype'); font-weight: 400; }
@font-face { font-family: 'NotoTelugu'; src: url('file:///home/z/.fonts/NotoSansTelugu-Bold.ttf') format('truetype'); font-weight: 700; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'NotoTelugu', Roboto, sans-serif; }
body { background: #ffffff; color: #243447; padding: 28px; }
.diagram-title { font-size: 22px; font-weight: 700; color: #1f2937; margin-bottom: 4px; letter-spacing: -0.01em; }
.diagram-subtitle { font-size: 12px; color: #6b7280; margin-bottom: 20px; font-style: italic; }
.telugu-note { font-family: 'NotoTelugu', sans-serif; color: #4b5563; font-size: 11px; margin-top: 16px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
"""

# ---------- Diagram 1: System flow ----------
SYSFLOW_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1100px; padding: 8px; }}
.row {{ display: flex; align-items: stretch; gap: 16px; }}
.tier {{ flex: 1; min-height: 140px; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; }}
.tier.backend {{ background: #eff6ff; border-color: #93c5fd; }}
.tier.db {{ background: #f0fdf4; border-color: #86efac; }}
.tier-title {{ font-size: 13px; font-weight: 700; color: #1e3a8a; margin-bottom: 6px; }}
.tier.backend .tier-title {{ color: #1e40af; }}
.tier.db .tier-title {{ color: #14532d; }}
.tier-sub {{ font-size: 11px; color: #475569; line-height: 1.5; }}
.tier-sub b {{ color: #0f172a; }}
.arrow-col {{ display: flex; flex-direction: column; align-items: center; justify-content: center; width: 36px; color: #64748b; font-size: 18px; font-weight: 700; }}
.layers {{ margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #fff; }}
.layers-title {{ font-size: 11px; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.08em; }}
.layer-row {{ display: flex; gap: 8px; margin-bottom: 6px; }}
.layer-pill {{ flex: 1; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px; padding: 5px 10px; font-size: 11px; color: #334155; text-align: center; }}
.layer-pill.accent {{ background: #fef3c7; border-color: #fcd34d; color: #92400e; font-weight: 600; }}
</style></head><body><div class="canvas">
<div class="diagram-title">System architecture &amp; request flow</div>
<div class="diagram-subtitle">Browser → Vite frontend on Vercel → Express backend on Render → PostgreSQL 17 — with auth, tenant isolation and audit layers</div>
<div class="row">
  <div class="tier">
    <div class="tier-title">Client (Browser)</div>
    <div class="tier-sub">
      <b>User roles:</b> admin, principal, accountant, receptionist, librarian, transport_manager, teacher, student, parent<br/>
      <b>State:</b> Access JWT in memory (15 min); refresh token in HttpOnly SameSite=Strict cookie (7 days)<br/>
      <b>Stack:</b> React 18 + Vite, single-page app
    </div>
  </div>
  <div class="arrow-col">→</div>
  <div class="tier backend">
    <div class="tier-title">Frontend · Vercel</div>
    <div class="tier-sub">
      <b>URL:</b> https://school-management-software-2.vercel.app<br/>
      <b>Build:</b> Static assets + vercel.json rewrite → /api/* proxied to backend<br/>
      <b>Pages:</b> 36 module pages (Dashboard, Students, Attendance, Fees, Exams, Timetable, Notices, Transport, etc.)
    </div>
  </div>
  <div class="arrow-col">→</div>
  <div class="tier backend">
    <div class="tier-title">Backend · Render</div>
    <div class="tier-sub">
      <b>Stack:</b> Node.js + Express, Zod validators, JWT auth + MFA<br/>
      <b>Routes:</b> 23 route files mounted under /api/*<br/>
      <b>Guards:</b> originGuard, authenticate, authorize, moduleAccess, rate limits
    </div>
  </div>
  <div class="arrow-col">→</div>
  <div class="tier db">
    <div class="tier-title">PostgreSQL 17</div>
    <div class="tier-sub">
      <b>Schema:</b> 42 migrations, multi-tenant via school_id on every row<br/>
      <b>Triggers:</b> audit tables for attendance, fees, exams, timetable, notices<br/>
      <b>Backups:</b> pg_dump scripts; verification job
    </div>
  </div>
</div>
<div class="layers">
  <div class="layers-title">Cross-cutting concerns applied to every request</div>
  <div class="layer-row">
    <div class="layer-pill accent">Origin guard (same-origin POST)</div>
    <div class="layer-pill">JWT authenticate</div>
    <div class="layer-pill">authorize(role)</div>
    <div class="layer-pill">moduleAccess(module)</div>
    <div class="layer-pill">Zod validate</div>
    <div class="layer-pill accent">Tenant scope (school_id)</div>
    <div class="layer-pill">Audit trigger (DB)</div>
  </div>
</div>
<div class="telugu-note">సిస్టమ్ ఫ్లో: వినియోగదారుడు బ్రౌజర్ నుండి లాగిన్ అవుతారు → ఫ్రంటెండ్ (Vercel) అభ్యర్థనను బ్యాకెండ్ (Render) కు పంపుతుంది → బ్యాకెండ్ ప్రతి అభ్యర్థనను ధృవీకరిస్తుంది, ధృవీకరిస్తుంది, స్కూల్-స్కోప్ చేస్తుంది → PostgreSQL డేటాబేస్‌లో నిల్వ చేస్తుంది.</div>
</div></body></html>"""

# ---------- Diagram 2: Module map ----------
MODULES_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1200px; padding: 8px; }}
.grid {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 8px; }}
.cat-label {{ font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 14px 0 6px 0; }}
.mod {{ border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #f8fafc; }}
.mod-core {{ background: #eff6ff; border-color: #93c5fd; }}
.mod-finance {{ background: #fef3c7; border-color: #fcd34d; }}
.mod-acad {{ background: #f0fdf4; border-color: #86efac; }}
.mod-comm {{ background: #fae8ff; border-color: #d8b4fe; }}
.mod-name {{ font-size: 12px; font-weight: 700; color: #1f2937; margin-bottom: 2px; }}
.mod-desc {{ font-size: 10px; color: #6b7280; line-height: 1.4; }}
.dep-line {{ font-size: 10px; color: #2563eb; margin-top: 4px; font-style: italic; }}
</style></head><body><div class="canvas">
<div class="diagram-title">Module map — 18 modules and their dependencies</div>
<div class="diagram-subtitle">Grouped by functional category. Arrows in italics show which modules depend on each other.</div>

<div class="cat-label">Core / Setup</div>
<div class="grid">
  <div class="mod mod-core"><div class="mod-name">Academic setup</div><div class="mod-desc">Years, terms, classes, sections, subjects, subject combinations</div><div class="dep-line">→ required by all modules</div></div>
  <div class="mod mod-core"><div class="mod-name">Students &amp; parents</div><div class="mod-desc">Profiles, family links, enrollments, bulk import, promotions</div><div class="dep-line">→ depends on Academic</div></div>
  <div class="mod mod-core"><div class="mod-name">Teachers</div><div class="mod-desc">Staff profiles, class-teacher &amp; subject-teacher assignments</div><div class="dep-line">→ depends on Academic</div></div>
  <div class="mod mod-core"><div class="mod-name">Staff</div><div class="mod-desc">Non-teaching staff roles, leave balances</div><div class="dep-line">→ feeds Leave module</div></div>
  <div class="mod mod-core"><div class="mod-name">Transport</div><div class="mod-desc">Vehicles, routes, stops, allocations with capacity guards</div></div>
</div>

<div class="cat-label">Academic operations</div>
<div class="grid">
  <div class="mod mod-acad"><div class="mod-name">Attendance</div><div class="mod-desc">Daily registers, half-day, corrections with admin approval, audit trail</div><div class="dep-line">→ depends on Students, Timetable</div></div>
  <div class="mod mod-acad"><div class="mod-name">Timetable</div><div class="mod-desc">Weekly section schedules, rooms, conflict checks, teacher-wise view</div><div class="dep-line">→ depends on Teachers, Academic</div></div>
  <div class="mod mod-acad"><div class="mod-name">Homework</div><div class="mod-desc">Assignments, due dates, completion tracking per section</div><div class="dep-line">→ depends on Timetable</div></div>
  <div class="mod mod-acad"><div class="mod-name">Exams &amp; results</div><div class="mod-desc">Grading scales, papers, candidates, marks, publish/reopen, ranks</div><div class="dep-line">→ depends on Students, Academic</div></div>
  <div class="mod mod-acad"><div class="mod-name">Report cards</div><div class="mod-desc">Generated per student from exam marks; printable</div><div class="dep-line">→ depends on Exams</div></div>
</div>

<div class="cat-label">Finance</div>
<div class="grid">
  <div class="mod mod-finance"><div class="mod-name">Fees &amp; invoices</div><div class="mod-desc">Structures, invoices, payments, concessions, currency-separated balances</div><div class="dep-line">→ depends on Students</div></div>
  <div class="mod mod-finance"><div class="mod-name">Certificates</div><div class="mod-desc">Issue, void, printable certificates with audit history</div><div class="dep-line">→ depends on Students</div></div>
  <div class="mod mod-finance"><div class="mod-name">Reports</div><div class="mod-desc">CSV exports across modules; collection/defaulters reports</div><div class="dep-line">→ depends on Fees, Attendance</div></div>
  <div class="mod mod-finance"><div class="mod-name">Leave</div><div class="mod-desc">Staff leave requests, approvals, balances</div><div class="dep-line">→ depends on Staff</div></div>
  <div class="mod mod-finance"><div class="mod-name">School calendar</div><div class="mod-desc">School events, holidays; shared read-only view</div></div>
</div>

<div class="cat-label">Communication &amp; portal</div>
<div class="grid">
  <div class="mod mod-comm"><div class="mod-name">Notices</div><div class="mod-desc">Targeted announcements, draft/scheduled/published, read receipts</div></div>
  <div class="mod mod-comm"><div class="mod-name">Dashboard</div><div class="mod-desc">Role-scoped KPIs; pulls live data from every module</div><div class="dep-line">→ reads from all modules</div></div>
  <div class="mod mod-comm"><div class="mod-name">Settings</div><div class="mod-desc">School profile, logo, MFA enrollment, notification prefs</div></div>
  <div class="mod mod-comm"><div class="mod-name">User accounts</div><div class="mod-desc">Admin user CRUD, temp passwords, reset &amp; revoke sessions</div></div>
  <div class="mod mod-comm"><div class="mod-name">Security</div><div class="mod-desc">Session list, login history, revoke session, MFA status</div></div>
</div>

<div class="telugu-note">మాడ్యూల్ మ్యాప్: 18 మాడ్యూల్‌లు 5 వర్గాలుగా విభజించబడ్డాయి — కోర్ సెటప్, విద్యా కార్యకలాపాలు, ఆర్థిక, కమ్యూనికేషన్, పోర్టల్. ప్రతి మాడ్యూల్ ఒకదానిపై ఒకటి ఆధారపడి ఉంటుంది.</div>
</div></body></html>"""

# ---------- Diagram 3: Demo import flow ----------
DEMO_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1100px; padding: 8px; }}
.phase {{ border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #f8fafc; }}
.phase.client {{ border-color: #93c5fd; background: #eff6ff; }}
.phase.api {{ border-color: #fcd34d; background: #fffbeb; }}
.phase.db {{ border-color: #86efac; background: #f0fdf4; }}
.phase-title {{ font-size: 13px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }}
.phase.api .phase-title {{ color: #92400e; }}
.phase.db .phase-title {{ color: #14532d; }}
.steps {{ display: flex; flex-direction: column; gap: 6px; }}
.step {{ display: flex; gap: 10px; align-items: flex-start; font-size: 12px; line-height: 1.5; }}
.step-num {{ width: 22px; height: 22px; border-radius: 50%; background: #1e40af; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }}
.phase.api .step-num {{ background: #b45309; }}
.phase.db .step-num {{ background: #15803d; }}
.step-text {{ color: #1f2937; flex: 1; }}
.step-text b {{ color: #0f172a; }}
.step-text .code {{ font-family: ui-monospace, 'SF Mono', Menlo, monospace; background: #e0e7ff; padding: 1px 5px; border-radius: 3px; font-size: 11px; color: #1e3a8a; }}
.gate {{ background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 4px 8px; font-size: 11px; color: #991b1b; display: inline-block; margin-top: 4px; }}
.down-arrow {{ text-align: center; color: #64748b; font-size: 18px; margin: -4px 0; }}
</style></head><body><div class="canvas">
<div class="diagram-title">Demo import flow — "Load demonstration content" action</div>
<div class="diagram-subtitle">Step-by-step trace of a single admin click → 16 students, 8 parents, 3 teachers, 80 attendance entries, 17 invoices, 4 exams, 6 notices inserted transactionally</div>

<div class="phase client">
  <div class="phase-title">Phase 1 · Client (browser)</div>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-text">Admin clicks <b>"Load demonstration content"</b> on the dashboard Quick actions panel</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">Browser shows <span class="code">window.confirm("Insert clearly labeled demonstration records across all modules?...")</span> dialog</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">Admin clicks <b>OK</b>; React calls <span class="code">api('/demo', {{ method:'POST', body:{{ confirmation:'LOAD_DEMO_DATA' }} }})</span> via the in-memory access token</div></div>
  </div>
</div>
<div class="down-arrow">↓</div>

<div class="phase api">
  <div class="phase-title">Phase 2 · Backend middleware chain (in order)</div>
  <div class="steps">
    <div class="step"><div class="step-num">4</div><div class="step-text"><b>authenticate</b> — verifies JWT, loads user, attaches <span class="code">req.user.id</span> and <span class="code">req.schoolId</span></div></div>
    <div class="step"><div class="step-num">5</div><div class="step-text"><b>authorize('admin')</b> — rejects if <span class="code">req.user.role !== 'admin'</span></div></div>
    <div class="step"><div class="step-num">6</div><div class="step-text"><b>rateLimit({{ windowMs:3600000, limit:3 }})</b> — max 3 attempts/hour per client IP <span class="gate">gate: 429 Too many requests</span></div></div>
    <div class="step"><div class="step-num">7</div><div class="step-text"><b>originGuard</b> — checks <span class="code">req.headers.origin === env.FRONTEND_ORIGIN</span> <span class="gate">gate: 403 Untrusted origin</span></div></div>
    <div class="step"><div class="step-num">8</div><div class="step-text">Route handler validates body: <span class="code">Object.keys(req.body).length === 1 &amp;&amp; req.body.confirmation === 'LOAD_DEMO_DATA'</span> <span class="gate">gate: 400 Explicit confirmation required</span></div></div>
  </div>
</div>
<div class="down-arrow">↓</div>

<div class="phase db">
  <div class="phase-title">Phase 3 · Database transaction (seedDemo)</div>
  <div class="steps">
    <div class="step"><div class="step-num">9</div><div class="step-text"><b>BEGIN</b> → <span class="code">SELECT pg_advisory_xact_lock(7182027)</span> — serializes all demo imports globally</div></div>
    <div class="step"><div class="step-num">10</div><div class="step-text">Verifies active default school membership for the admin; if demo year exists, returns <i>"already exists"</i> without mutating</div></div>
    <div class="step"><div class="step-num">11</div><div class="step-text">Creates academic year, 2 terms, 2 classes, 2 sections, 3 subjects, 2 rooms</div></div>
    <div class="step"><div class="step-num">12</div><div class="step-text">Creates 3 teacher + 8 parent + 16 student accounts (bcrypt-hashed random passwords, <span class="code">@example.invalid</span> emails); all names prefixed <b>"DEMO ·"</b></div></div>
    <div class="step"><div class="step-num">13</div><div class="step-text">Inserts 30 timetable sessions, 80 attendance entries (with one audited correction), 3 fee structures, 17 invoices, 10 payments, 4 exams, 6 papers, 48 marks, 6 notices, 3 read receipts</div></div>
    <div class="step"><div class="step-num">14</div><div class="step-text">All tenant tables receive <span class="code">school_id</span>; audit triggers fire automatically for attendance/fee/exam/timetable/notice events</div></div>
    <div class="step"><div class="step-num">15</div><div class="step-text"><b>COMMIT</b> → response 201 Created with counts summary; or <b>ROLLBACK</b> on any error → atomic</div></div>
  </div>
</div>

<div class="telugu-note">డెమో ఇంపోర్ట్ ఫ్లో: అడ్మిన్ బటన్ క్లిక్ → కన్ఫర్మ్ డైలాగ్ → JWT ధృవీకరణ → రోల్ చెక్ → రేట్ లిమిట్ (గంటకు 3 సార్లు) → ఆరిజన్ గార్డ్ → కన్ఫర్మేషన్ మార్కర్ → ట్రాన్సాక్షన్ (BEGIN → లాక్ → డేటా ఇన్సర్ట్ → COMMIT) → ఆడిట్ ట్రిగ్గర్లు.</div>
</div></body></html>"""

# ---------- Diagram 4: Data flow per module (3 representative flows) ----------
DATAFLOW_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1200px; padding: 8px; }}
.flow {{ border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px; background: #f8fafc; }}
.flow-title {{ font-size: 13px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px; }}
.chain {{ display: flex; align-items: stretch; gap: 0; flex-wrap: nowrap; }}
.node {{ flex: 1; padding: 10px 8px; border: 1px solid #94a3b8; border-radius: 6px; background: white; text-align: center; font-size: 11px; }}
.node.start {{ background: #dbeafe; border-color: #60a5fa; font-weight: 600; }}
.node.audit {{ background: #fef3c7; border-color: #fcd34d; font-style: italic; }}
.node-name {{ color: #0f172a; font-weight: 600; display: block; margin-bottom: 3px; font-size: 11px; }}
.node-detail {{ color: #475569; font-size: 10px; line-height: 1.3; }}
.arrow {{ display: flex; align-items: center; justify-content: center; width: 18px; color: #64748b; font-size: 16px; font-weight: 700; flex-shrink: 0; }}
</style></head><body><div class="canvas">
<div class="diagram-title">Per-module data flow — three representative chains</div>
<div class="diagram-subtitle">Each chain shows how a record moves from intake through validation, storage and audit. Audit tables are highlighted.</div>

<div class="flow">
  <div class="flow-title">Flow A · Student intake → enrollment → attendance</div>
  <div class="chain">
    <div class="node start"><span class="node-name">POST /api/students</span><span class="node-detail">Admin creates student profile (validator: admission_number regex, date format, pin_code 6-digit, birth ≤ admission)</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">users + students</span><span class="node-detail">Insert user (role=student) + student record; both get school_id</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">POST /api/students/:id/enrollments</span><span class="node-detail">Enroll in section for current academic year</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">enrollments</span><span class="node-detail">Active status; ties student to class+section for the year</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">attendance_registers</span><span class="node-detail">Daily register per section; created by teacher</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">attendance_entries</span><span class="node-detail">Per-student status (present/absent/late/excused/half-day)</span></div>
    <div class="arrow">→</div>
    <div class="node audit"><span class="node-name">attendance_audit</span><span class="node-detail">Triggered on every status change; records actor, reason, prior value</span></div>
  </div>
</div>

<div class="flow">
  <div class="flow-title">Flow B · Fee structure → invoice → payment → reversal</div>
  <div class="chain">
    <div class="node start"><span class="node-name">POST /api/fees/structures</span><span class="node-detail">Admin defines amount_minor + currency per class/year</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">fee_structures</span><span class="node-detail">Currency separated (INR ≠ USD; never summed)</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">POST /api/fees/invoices</span><span class="node-detail">Invoice per student per structure; issued_on + due_on</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">fee_invoices</span><span class="node-detail">Outstanding = amount − payments − concessions</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">POST /api/fees/invoices/:id/payments</span><span class="node-detail">Manual payment record (bank_transfer / cash / etc.); idempotency_key</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">fee_payments + fee_events</span><span class="node-detail">Events: issued, paid, reversed, concession-added, voided</span></div>
    <div class="arrow">→</div>
    <div class="node audit"><span class="node-name">fee_events (audit)</span><span class="node-detail">Immutable history; protected by schema</span></div>
  </div>
</div>

<div class="flow">
  <div class="flow-title">Flow C · Exam → papers → marks → publish → report card</div>
  <div class="chain">
    <div class="node start"><span class="node-name">POST /api/exams</span><span class="node-detail">Admin creates exam (class, year, term, grading_scale, dates)</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">exams</span><span class="node-detail">Draft state; can be reopened/cancelled with reason</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">POST /api/exams/:id/papers</span><span class="node-detail">Subject paper with held_on, max_marks, pass_marks</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">exam_candidates + exam_marks</span><span class="node-detail">Per-student per-paper score; remark optional</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">POST /api/exams/:id/publish</span><span class="node-detail">Status: draft → published (with reason)</span></div>
    <div class="arrow">→</div>
    <div class="node"><span class="node-name">exam_events</span><span class="node-detail">All transitions audited; ranks computed on publish</span></div>
    <div class="arrow">→</div>
    <div class="node audit"><span class="node-name">report_cards</span><span class="node-detail">Generated from marks; printable; exam_mark_audit on every change</span></div>
  </div>
</div>

<div class="telugu-note">డేటా ఫ్లో: మూడు ప్రాతినిధ్య గొలుసులు — (A) విద్యార్థి → ఎన్రోల్మెంట్ → హాజరు → ఆడిట్, (B) ఫీజు నిర్మాణం → ఇన్వాయిస్ → చెల్లిత ఆడిట్, (C) పరీక్ష → పేపర్ → మార్కులు → ప్రచురణ → రిపోర్ట్ కార్డ్. ప్రతి గొలుసు ఆడిట్ టేబుల్‌తో ముగుస్తుంది.</div>
</div></body></html>"""

# ---------- Diagram 5: Validation pipeline ----------
VALIDATION_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1100px; padding: 8px; }}
.pipe {{ display: flex; flex-direction: column; gap: 0; }}
.stage {{ border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; background: #f8fafc; position: relative; }}
.stage.front {{ border-color: #93c5fd; background: #eff6ff; }}
.stage.valid {{ border-color: #a78bfa; background: #f5f3ff; }}
.stage.ctrl {{ border-color: #fcd34d; background: #fffbeb; }}
.stage.svc {{ border-color: #86efac; background: #f0fdf4; }}
.stage.db {{ border-color: #64748b; background: #f1f5f9; }}
.stage-head {{ font-size: 12px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }}
.stage-meta {{ font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }}
.stage-body {{ font-size: 12px; color: #374151; line-height: 1.5; margin-top: 6px; }}
.stage-body .code {{ font-family: ui-monospace, 'SF Mono', monospace; background: #e0e7ff; padding: 1px 5px; border-radius: 3px; font-size: 11px; }}
.gate {{ display: inline-block; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-top: 6px; }}
.connector {{ text-align: center; color: #64748b; font-size: 16px; margin: -2px 0; }}
</style></head><body><div class="canvas">
<div class="diagram-title">Validation pipeline — every request passes through 5 stages</div>
<div class="diagram-subtitle">Each stage can reject the request. Failures short-circuit and return a structured 4xx response; success propagates downward.</div>

<div class="pipe">
  <div class="stage front">
    <div class="stage-meta">Stage 1 · Client</div>
    <div class="stage-head">React form submit</div>
    <div class="stage-body">User fills form → <span class="code">api(path, {{ method, body }})</span> wrapper adds <span class="code">Authorization: Bearer &lt;token&gt;</span> header and serializes JSON body.</div>
    <div class="gate">Browser: required-attribute check on inputs (HTML5)</div>
  </div>
  <div class="connector">↓</div>
  <div class="stage valid">
    <div class="stage-meta">Stage 2 · Zod validator (route middleware)</div>
    <div class="stage-head"><span class="code">validate(schema)</span> — backend/src/validators/*.js</div>
    <div class="stage-body">Schema declared with <span class="code">z.object({{...}}).strict()</span> — rejects unknown keys. Per-field rules: <span class="code">z.string().trim().max(N).regex(...)</span>, <span class="code">z.uuid()</span>, <span class="code">z.enum([...])</span>, <span class="code">z.coerce.number().int().min(1).max(100)</span>. Cross-field rules via <span class="code">.refine()</span> (e.g. birth ≤ admission).</div>
    <div class="gate">400 Invalid input + field-level errors object</div>
  </div>
  <div class="connector">↓</div>
  <div class="stage ctrl">
    <div class="stage-meta">Stage 3 · Controller</div>
    <div class="stage-head">controllers/*.js</div>
    <div class="stage-body">Calls service layer with <span class="code">req.user.id</span>, <span class="code">req.schoolId</span>, validated <span class="code">req.body</span>. Enforces admin-only mutations via <span class="code">authorize('admin')</span> middleware before this stage.</div>
    <div class="gate">403 Forbidden (role mismatch) — raised earlier by authorize()</div>
  </div>
  <div class="connector">↓</div>
  <div class="stage svc">
    <div class="stage-meta">Stage 4 · Service</div>
    <div class="stage-head">services/*.js — business logic</div>
    <div class="stage-body">Runs inside a transaction (<span class="code">BEGIN ... COMMIT/ROLLBACK</span>). Applies advisory locks where needed (e.g. demo import). Performs existence checks, conflict detection (e.g. timetable overlaps), capacity guards (transport).</div>
    <div class="gate">404 / 409 Conflict (business rule violation)</div>
  </div>
  <div class="connector">↓</div>
  <div class="stage db">
    <div class="stage-meta">Stage 5 · Database</div>
    <div class="stage-head">PostgreSQL constraints + audit triggers</div>
    <div class="stage-body">Foreign keys, <span class="code">UNIQUE</span> constraints, <span class="code">CHECK</span> constraints, per-row <span class="code">school_id</span> (tenant isolation). Audit triggers write to <span class="code">*_audit</span> tables on INSERT/UPDATE/DELETE for attendance, fees, exams, timetable, notices.</div>
    <div class="gate">500 / 23505 unique violation / 23503 FK violation</div>
  </div>
</div>

<div class="telugu-note">వాలిడేషన్ పైప్‌లైన్: క్లయింట్ → Zod స్కీమా (400) → కంట్రోలర్ (403 రోల్ చెక్) → సర్వీస్ (404/409 బిజినెస్ రూల్) → డేటాబేస్ (500/FK/CHECK constraints). ప్రతి స్టేజ్ వద్ద తిరస్కరణ సంభవిస్తుంది.</div>
</div></body></html>"""

# ---------- Diagram 6: Role permissions matrix ----------
PERMS_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.canvas {{ width: 1300px; padding: 8px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 11px; }}
th, td {{ border: 1px solid #e5e7eb; padding: 6px 8px; text-align: center; }}
th {{ background: #f1f5f9; color: #1f2937; font-weight: 700; }}
th.role {{ background: #1e3a8a; color: white; }}
td.mod {{ text-align: left; font-weight: 600; background: #f8fafc; color: #1f2937; }}
.full {{ background: #d1fae5; color: #065f46; font-weight: 700; }}
.view {{ background: #dbeafe; color: #1e40af; }}
.none {{ color: #9ca3af; }}
.legend {{ margin-top: 10px; font-size: 11px; color: #4b5563; }}
.legend span {{ display: inline-block; padding: 2px 8px; border-radius: 3px; margin-right: 12px; }}
</style></head><body><div class="canvas">
<div class="diagram-title">Role × Module permission matrix</div>
<div class="diagram-subtitle">From backend/src/config/permissions.js. admin has full access to every module; staff roles inherit scoped view/manage rights.</div>
<table>
<thead><tr><th class="mod">Module</th><th class="role">admin</th><th class="role">principal</th><th class="role">accountant</th><th class="role">receptionist</th><th class="role">librarian</th><th class="role">transport_manager</th><th class="role">teacher</th><th class="role">student</th><th class="role">parent</th></tr></thead>
<tbody>
<tr><td class="mod">academic</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">students</td><td class="full">manage</td><td class="view">view</td><td class="view">view</td><td class="full">manage</td><td class="view">view</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">parents</td><td class="full">manage</td><td class="view">view</td><td class="view">view</td><td class="full">manage</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">teachers</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">staff</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">attendance</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">scoped</td></tr>
<tr><td class="mod">fees</td><td class="full">manage</td><td class="view">view</td><td class="full">manage</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">exams</td><td class="full">manage</td><td class="full">manage</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">scoped</td></tr>
<tr><td class="mod">timetable</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">homework</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">—</td></tr>
<tr><td class="mod">notices</td><td class="full">manage</td><td class="full">manage</td><td class="view">view</td><td class="view">view</td><td class="view">view</td><td class="view">view</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">scoped</td></tr>
<tr><td class="mod">transport</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="full">manage</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">calendar</td><td class="full">manage</td><td class="full">manage</td><td class="view">view</td><td class="view">view</td><td class="view">view</td><td class="view">view</td><td class="none">view</td><td class="none">view</td><td class="none">view</td></tr>
<tr><td class="mod">dashboard</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">scoped</td></tr>
<tr><td class="mod">settings</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">own</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">report_cards</td><td class="full">manage</td><td class="view">view</td><td class="none">—</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">scoped</td><td class="none">scoped</td><td class="none">scoped</td></tr>
<tr><td class="mod">certificates</td><td class="full">manage</td><td class="full">manage</td><td class="none">—</td><td class="view">view</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td></tr>
<tr><td class="mod">portal</td><td class="full">manage</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">—</td><td class="none">own</td><td class="none">own</td></tr>
</tbody></table>
<div class="legend">
<span class="full">manage</span> = view + create/edit/delete
<span class="view">view</span> = read-only school-wide access
<span class="none">scoped</span> = record-level (own/own child/own class)
<span class="none">—</span> = no access
</div>
<div class="telugu-note">రోల్ అనుమతులు: admin అన్ని మాడ్యూల్‌లకు పూర్తి యాక్సెస్ కలిగి ఉంటారు. ప్రిన్సిపాల్ చాలా మాడ్యూల్‌లను చూడగలరు, నోటిస్‌లు/క్యాలెండర్/సర్టిఫికేట్‌లు/పరీక్షలను నిర్వహించగలరు. అకౌంటెంట్ ఫీజులను నిర్వహిస్తారు. టీచర్/విద్యార్థి/పేరెంట్ స్కోప్డ్ రికార్డ్-లెవల్ యాక్సెస్ కలిగి ఉంటారు.</div>
</div></body></html>"""

DIAGRAMS = [
    ("01-system-flow.png",        SYSFLOW_HTML),
    ("02-module-map.png",         MODULES_HTML),
    ("03-demo-import-flow.png",   DEMO_HTML),
    ("04-data-flow-per-module.png", DATAFLOW_HTML),
    ("05-validation-pipeline.png", VALIDATION_HTML),
    ("06-role-permissions.png",   PERMS_HTML),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, html in DIAGRAMS:
        # Use small viewport so body.scrollHeight reflects actual content, not viewport
        page = browser.new_page(viewport={"width": 1320, "height": 800}, device_scale_factor=2)
        page.set_content(html, wait_until="networkidle")
        time.sleep(0.6)
        # Get the canvas element bounding box for exact content size
        rect = page.evaluate("""() => {
            const c = document.querySelector('.canvas') || document.body;
            const r = c.getBoundingClientRect();
            return {w: Math.ceil(r.width + r.left), h: Math.ceil(r.height + r.top)};
        }""")
        h = max(int(rect['h']), 600)
        # Resize viewport to content height then take full_page (no clip)
        page.set_viewport_size({"width": 1320, "height": h})
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT, name), full_page=True)
        page.close()
        print(f"Rendered {name} ({h}px tall)", flush=True)
    browser.close()
print(f"\nAll 6 diagrams rendered to {OUT}/")
