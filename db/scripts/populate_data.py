#!/usr/bin/env python3
"""Populate the school database with realistic test data using standard Indian names.
Inserts via direct SQL with proper FK chains. All records are scoped to the existing school_id."""
import psycopg2, hashlib, os, json
from datetime import date, datetime, timedelta
import uuid

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    raise SystemExit("ERROR: Set DATABASE_URL env var, e.g. postgresql://user:pass@host:port/db?sslmode=require")

# Use the demo data's password hash approach: random discarded hash
# But for our realistic data, use a known password so users can sign in if needed
# Password: "TestPass12345" -> bcrypt hash
# Use a pre-computed bcrypt hash to avoid needing bcrypt library
# Actually let's just use a SHA-256 placeholder; the app uses bcrypt, but since these are test users
# and we're testing CRUD via the admin account, we can use a random hash that won't validate.
# Per the demo script approach, generate random bytes for the hash so these accounts have no working password.
import secrets
def make_password_hash():
    """Generate a random hash that won't validate any password (per demo approach)."""
    return "bcrypt$" + secrets.token_hex(32)  # Not a real bcrypt hash, just a placeholder

# Standard Indian names
TEACHERS = [
    ("Rajesh Kumar",    "T-001", "M.Sc. Mathematics", "+91 98765 10001"),
    ("Lakshmi Rao",     "T-002", "M.Sc. Physics",     "+91 98765 10002"),
    ("Suresh Babu",     "T-003", "M.A. English",      "+91 98765 10003"),
    ("Anita Desai",     "T-004", "M.Sc. Chemistry",   "+91 98765 10004"),
]

PARENTS = [
    ("Ramesh Gupta",    "+91 99876 20001"),
    ("Sunita Sharma",   "+91 99876 20002"),
    ("Mohan Reddy",     "+91 99876 20003"),
    ("Kavita Nair",     "+91 99876 20004"),
    ("Arvind Patel",    "+91 99876 20005"),
    ("Deepika Iyer",    "+91 99876 20006"),
    ("Vikram Singh",    "+91 99876 20007"),
    ("Pooja Mehta",     "+91 99876 20008"),
    ("Sanjay Verma",    "+91 99876 20009"),
    ("Anjali Joshi",    "+91 99876 20010"),
]

# 20 students: 8 per class (Class 8, 9) + 4 in Class 10
STUDENTS = [
    # Class 8 / A
    ("Aarav Gupta",     "S-1001", "2013-05-12", "male",    "Ramesh Gupta",  "father"),
    ("Diya Sharma",     "S-1002", "2013-08-23", "female",  "Sunita Sharma", "mother"),
    ("Ishaan Reddy",    "S-1003", "2013-02-14", "male",    "Mohan Reddy",   "father"),
    ("Ananya Nair",     "S-1004", "2013-11-07", "female",  "Kavita Nair",   "mother"),
    # Class 8 / B
    ("Kabir Patel",     "S-1005", "2013-04-19", "male",    "Arvind Patel",  "father"),
    ("Riya Iyer",       "S-1006", "2013-09-30", "female",  "Deepika Iyer",  "mother"),
    ("Vivaan Singh",    "S-1007", "2013-07-25", "male",    "Vikram Singh",  "father"),
    ("Saanvi Mehta",    "S-1008", "2013-12-03", "female",  "Pooja Mehta",   "mother"),
    # Class 9 / A
    ("Arjun Verma",     "S-1009", "2012-06-15", "male",    "Sanjay Verma",  "father"),
    ("Aadhya Joshi",    "S-1010", "2012-10-22", "female",  "Anjali Joshi",  "mother"),
    ("Reyansh Gupta",   "S-1011", "2012-03-08", "male",    "Ramesh Gupta",  "father"),
    ("Kiara Sharma",    "S-1012", "2012-08-17", "female",  "Sunita Sharma", "mother"),
    # Class 9 / B
    ("Aditya Reddy",    "S-1013", "2012-01-29", "male",    "Mohan Reddy",   "father"),
    ("Myra Nair",       "S-1014", "2012-11-11", "female",  "Kavita Nair",   "mother"),
    ("Krishna Patel",   "S-1015", "2012-05-04", "male",    "Arvind Patel",  "father"),
    ("Ira Iyer",        "S-1016", "2012-09-28", "female",  "Deepika Iyer",  "mother"),
    # Class 10 / A
    ("Veer Singh",      "S-1017", "2011-04-12", "male",    "Vikram Singh",  "father"),
    ("Anvi Mehta",      "S-1018", "2011-07-19", "female",  "Pooja Mehta",   "mother"),
    ("Arnav Verma",     "S-1019", "2011-02-08", "male",    "Sanjay Verma",  "father"),
    ("Diya Joshi",      "S-1020", "2011-10-30", "female",  "Anjali Joshi",  "mother"),
]

def random_uuid():
    return str(uuid.uuid4())

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()
    # Disable triggers for bulk insert
    cur.execute("SET session_replication_role = replica")

    school_id_q = cur.execute("SELECT id FROM schools LIMIT 1")
    school_id = cur.fetchone()[0]
    admin_id = cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1") or cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    admin_id = cur.fetchone()[0]

    print(f"School: {school_id}")
    print(f"Admin: {admin_id}")

    # === ACADEMIC YEAR ===
    cur.execute("""INSERT INTO academic_years (id, name, start_date, end_date, is_current, school_id)
                   VALUES (%s, 'Academic Year 2026-27', '2026-06-01', '2027-04-30', true, %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0001-4000-8000-000000000001', school_id))
    ay_id = 'aaaaaaaa-0001-4000-8000-000000000001'

    # === TERMS ===
    cur.execute("""INSERT INTO terms (id, academic_year_id, name, start_date, end_date, school_id) VALUES
                   (%s, %s, 'Term 1', '2026-06-01', '2026-10-31', %s),
                   (%s, %s, 'Term 2', '2026-11-01', '2027-04-30', %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0002-4000-8000-000000000001', ay_id, school_id,
                 'aaaaaaaa-0002-4000-8000-000000000002', ay_id, school_id))
    term1_id = 'aaaaaaaa-0002-4000-8000-000000000001'
    term2_id = 'aaaaaaaa-0002-4000-8000-000000000002'

    # === CLASSES ===
    cur.execute("""INSERT INTO classes (id, academic_year_id, name, school_id) VALUES
                   (%s, %s, 'Class 8',  %s),
                   (%s, %s, 'Class 9',  %s),
                   (%s, %s, 'Class 10', %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0003-4000-8000-000000000001', ay_id, school_id,
                 'aaaaaaaa-0003-4000-8000-000000000002', ay_id, school_id,
                 'aaaaaaaa-0003-4000-8000-000000000003', ay_id, school_id))
    cls8 = 'aaaaaaaa-0003-4000-8000-000000000001'
    cls9 = 'aaaaaaaa-0003-4000-8000-000000000002'
    cls10 = 'aaaaaaaa-0003-4000-8000-000000000003'

    # === SECTIONS ===
    cur.execute("""INSERT INTO sections (id, class_id, name, capacity, school_id) VALUES
                   (%s, %s, 'A', 40, %s), (%s, %s, 'B', 40, %s),
                   (%s, %s, 'A', 40, %s), (%s, %s, 'B', 40, %s),
                   (%s, %s, 'A', 35, %s), (%s, %s, 'B', 35, %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0004-4000-8000-000000000001', cls8, school_id,
                 'aaaaaaaa-0004-4000-8000-000000000002', cls8, school_id,
                 'aaaaaaaa-0004-4000-8000-000000000003', cls9, school_id,
                 'aaaaaaaa-0004-4000-8000-000000000004', cls9, school_id,
                 'aaaaaaaa-0004-4000-8000-000000000005', cls10, school_id,
                 'aaaaaaaa-0004-4000-8000-000000000006', cls10, school_id))
    sec8a = 'aaaaaaaa-0004-4000-8000-000000000001'
    sec8b = 'aaaaaaaa-0004-4000-8000-000000000002'
    sec9a = 'aaaaaaaa-0004-4000-8000-000000000003'
    sec9b = 'aaaaaaaa-0004-4000-8000-000000000004'
    sec10a = 'aaaaaaaa-0004-4000-8000-000000000005'
    sec10b = 'aaaaaaaa-0004-4000-8000-000000000006'

    # === SUBJECTS ===
    cur.execute("""INSERT INTO subjects (id, name, code, school_id) VALUES
                   (%s, 'Mathematics',     'MATH', %s),
                   (%s, 'Science',         'SCI',  %s),
                   (%s, 'English',         'ENG',  %s),
                   (%s, 'Social Studies',  'SOC',  %s),
                   (%s, 'Hindi',           'HIN',  %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0005-4000-8000-000000000001', school_id,
                 'aaaaaaaa-0005-4000-8000-000000000002', school_id,
                 'aaaaaaaa-0005-4000-8000-000000000003', school_id,
                 'aaaaaaaa-0005-4000-8000-000000000004', school_id,
                 'aaaaaaaa-0005-4000-8000-000000000005', school_id))
    sub_math = 'aaaaaaaa-0005-4000-8000-000000000001'
    sub_sci  = 'aaaaaaaa-0005-4000-8000-000000000002'
    sub_eng  = 'aaaaaaaa-0005-4000-8000-000000000003'
    sub_soc  = 'aaaaaaaa-0005-4000-8000-000000000004'
    sub_hin  = 'aaaaaaaa-0005-4000-8000-000000000005'

    # === ROOMS ===
    cur.execute("""INSERT INTO school_rooms (id, name, location, active, version, school_id) VALUES
                   (%s, 'Room 101', 'Ground floor · Main building', true, 1, %s),
                   (%s, 'Room 102', 'Ground floor · Main building', true, 1, %s),
                   (%s, 'Room 201', 'First floor · Science block',  true, 1, %s),
                   (%s, 'Room 202', 'First floor · Science block',  true, 1, %s)
                   ON CONFLICT (id) DO NOTHING""",
                ('aaaaaaaa-0006-4000-8000-000000000001', school_id,
                 'aaaaaaaa-0006-4000-8000-000000000002', school_id,
                 'aaaaaaaa-0006-4000-8000-000000000003', school_id,
                 'aaaaaaaa-0006-4000-8000-000000000004', school_id))
    room101 = 'aaaaaaaa-0006-4000-8000-000000000001'
    room102 = 'aaaaaaaa-0006-4000-8000-000000000002'
    room201 = 'aaaaaaaa-0006-4000-8000-000000000003'
    room202 = 'aaaaaaaa-0006-4000-8000-000000000004'

    # === TEACHERS ===
    # Create user accounts + teacher records
    teacher_ids = []
    for name, emp_no, qual, phone in TEACHERS:
        uid = random_uuid()
        email = f"teacher.{emp_no.lower().replace('-','')}@example.invalid"
        cur.execute("""INSERT INTO users (id, name, email, password_hash, role, active, must_change_password)
                       VALUES (%s, %s, %s, %s, 'teacher', true, false)""",
                    (uid, name, email, make_password_hash()))
        cur.execute("""INSERT INTO school_memberships (id, school_id, user_id, role, status, is_default)
                       VALUES (%s, %s, %s, 'teacher', 'active', true)""",
                    (random_uuid(), school_id, uid))
        tid = random_uuid()
        cur.execute("""INSERT INTO teachers (id, user_id, account_role, employee_number, joining_date, phone, qualification, employment_status, school_id)
                       VALUES (%s, %s, 'teacher', %s, '2024-06-01', %s, %s, 'active', %s)""",
                    (tid, uid, emp_no, phone, qual, school_id))
        teacher_ids.append((tid, name, emp_no))

    # Map teacher indices to subjects
    # Teacher 0 = Math, Teacher 1 = Science, Teacher 2 = English, Teacher 3 = Science (Class 10)
    teacher_subjects = {0: sub_math, 1: sub_sci, 2: sub_eng}

    # === TEACHER ASSIGNMENTS ===
    # Class teachers + subject teachers
    assignments = []
    # Class teachers: 1 per class (8, 9, 10)
    for idx, cls in [(0, cls8), (1, cls9), (2, cls10)]:
        aid = random_uuid()
        cur.execute("""INSERT INTO teacher_assignments (id, teacher_id, class_id, academic_year_id, kind, school_id)
                       VALUES (%s, %s, %s, %s, 'class_teacher', %s)""",
                    (aid, teacher_ids[idx][0], cls, ay_id, school_id))
        assignments.append((aid, teacher_ids[idx][0], cls, None))
    # Subject teachers: ONE per (class, subject) — schema enforces unique (school_id, class_id, subject_id)
    for cls in [cls8, cls9, cls10]:
        for tidx, sub in teacher_subjects.items():
            aid = random_uuid()
            cur.execute("""INSERT INTO teacher_assignments (id, teacher_id, class_id, academic_year_id, kind, subject_id, school_id)
                           VALUES (%s, %s, %s, %s, 'subject_teacher', %s, %s)""",
                        (aid, teacher_ids[tidx][0], cls, ay_id, sub, school_id))

    # === PARENTS ===
    parent_map = {}  # name -> parent_id
    for name, phone in PARENTS:
        uid = random_uuid()
        email = f"parent.{name.lower().replace(' ','.')}@example.invalid"
        cur.execute("""INSERT INTO users (id, name, email, password_hash, role, active, must_change_password)
                       VALUES (%s, %s, %s, %s, 'parent', true, false)""",
                    (uid, name, email, make_password_hash()))
        cur.execute("""INSERT INTO school_memberships (id, school_id, user_id, role, status, is_default)
                       VALUES (%s, %s, %s, 'parent', 'active', true)""",
                    (random_uuid(), school_id, uid))
        pid = random_uuid()
        cur.execute("""INSERT INTO parents (id, user_id, account_role, phone, address, school_id)
                       VALUES (%s, %s, 'parent', %s, 'Hyderabad, Telangana', %s)""",
                    (pid, uid, phone, school_id))
        parent_map[name] = pid

    # === STUDENTS ===
    # Class 8: students 0-3 → sec8a, 4-7 → sec8b
    # Class 9: students 8-11 → sec9a, 12-15 → sec9b
    # Class 10: students 16-17 → sec10a, 18-19 → sec10b
    section_for_idx = []
    for i in range(20):
        if i < 4:   section_for_idx.append((cls8,  sec8a))
        elif i < 8: section_for_idx.append((cls8,  sec8b))
        elif i < 12: section_for_idx.append((cls9, sec9a))
        elif i < 16: section_for_idx.append((cls9, sec9b))
        elif i < 18: section_for_idx.append((cls10, sec10a))
        else:        section_for_idx.append((cls10, sec10b))

    student_ids = []
    enrollment_ids = []
    for i, (name, adm_no, dob, gender, parent_name, relation) in enumerate(STUDENTS):
        uid = random_uuid()
        email = f"student.{adm_no.lower().replace('-','')}@example.invalid"
        cur.execute("""INSERT INTO users (id, name, email, password_hash, role, active, must_change_password)
                       VALUES (%s, %s, %s, %s, 'student', true, false)""",
                    (uid, name, email, make_password_hash()))
        cur.execute("""INSERT INTO school_memberships (id, school_id, user_id, role, status, is_default)
                       VALUES (%s, %s, %s, 'student', 'active', true)""",
                    (random_uuid(), school_id, uid))
        sid = random_uuid()
        cur.execute("""INSERT INTO students (id, user_id, account_role, admission_number, admission_date, date_of_birth,
                                             address, gender, school_id, lifecycle_status)
                       VALUES (%s, %s, 'student', %s, '2026-06-01', %s, 'Hyderabad, Telangana', %s, %s, 'active')""",
                    (sid, uid, adm_no, dob, gender, school_id))
        student_ids.append(sid)

        # Family link
        parent_id = parent_map[parent_name]
        cur.execute("""INSERT INTO student_parents (student_id, parent_id, relationship, school_id)
                       VALUES (%s, %s, %s, %s)""",
                    (sid, parent_id, relation, school_id))

        # Enrollment
        cls, sec = section_for_idx[i]
        eid = random_uuid()
        cur.execute("""INSERT INTO enrollments (id, student_id, academic_year_id, class_id, section_id, enrolled_on, status, school_id)
                       VALUES (%s, %s, %s, %s, %s, '2026-06-01', 'active', %s)""",
                    (eid, sid, ay_id, cls, sec, school_id))
        enrollment_ids.append(eid)

    # === FEE STRUCTURES + INVOICES ===
    # 3 fee structures (one per class)
    fee_struct_ids = []
    for cls, name, amount in [(cls8, "Class 8 Tuition", 60000), (cls9, "Class 9 Tuition", 70000), (cls10, "Class 10 Tuition", 80000)]:
        fid = random_uuid()
        cur.execute("""INSERT INTO fee_structures (id, class_id, academic_year_id, name, amount_minor, currency, active, category, school_id)
                       VALUES (%s, %s, %s, %s, %s, 'INR', true, 'tuition', %s)""",
                    (fid, cls, ay_id, name, amount, school_id))
        fee_struct_ids.append((cls, fid, amount))

    # Invoice each student
    inv_count = 0
    pay_count = 0
    for i, sid in enumerate(student_ids):
        cls = section_for_idx[i][0]
        fs = next(f for c, f, a in fee_struct_ids if c == cls)
        amount = next(a for c, f, a in fee_struct_ids if c == cls)
        eid = enrollment_ids[i]
        inv_id = random_uuid()
        due_offset = 14 if i % 3 != 0 else -3  # some overdue
        issued = date.today() - timedelta(days=14)
        due = date.today() + timedelta(days=due_offset)
        cur.execute("""INSERT INTO fee_invoices (id, invoice_number, student_id, fee_structure_id, enrollment_id, class_id, academic_year_id,
                                                  title, amount_minor, currency, issued_on, due_on, created_by, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, 'Term Tuition Fee', %s, 'INR', %s, %s, %s, %s)""",
                    (inv_id, 1001+i, sid, fs, eid, cls, ay_id, amount, issued, due, admin_id, school_id))
        inv_count += 1
        # Record payment for ~70% of invoices
        if i % 3 != 0:
            pay_amount = amount if i % 3 == 1 else amount // 2  # full or half
            cur.execute("""INSERT INTO fee_payments (id, receipt_number, invoice_id, amount_minor, paid_on, method, reference, idempotency_key, recorded_by, school_id)
                           VALUES (%s, %s, %s, %s, %s, 'bank_transfer', %s, %s, %s, %s)""",
                        (random_uuid(), 2001+i, inv_id, pay_amount, date.today()-timedelta(days=7),
                         f"BANK-REF-{3001+i}", str(uuid.uuid4()), admin_id, school_id))
            pay_count += 1
    print(f"Invoices: {inv_count}, Payments: {pay_count}")

    # === EXAM GRADING SCALE ===
    scale_id = random_uuid()
    cur.execute("INSERT INTO exam_grading_scales (id, name, school_id) VALUES (%s, 'Standard Grades', %s)",
                (scale_id, school_id))
    for pct, label in [(90, 'A+'), (80, 'A'), (70, 'B'), (60, 'C'), (40, 'D'), (0, 'F')]:
        cur.execute("INSERT INTO exam_grade_bands (scale_id, minimum_percent, label, school_id) VALUES (%s, %s, %s, %s)",
                    (scale_id, pct, label, school_id))

    # === EXAMS ===
    # 2 exams per class (Term 1 published + Term 2 draft)
    exam_count = 0
    paper_count = 0
    mark_count = 0
    candidate_count = 0
    for cls, cls_name in [(cls8, 'Class 8'), (cls9, 'Class 9'), (cls10, 'Class 10')]:
        # Term 1 exam (published)
        exam1 = random_uuid()
        cur.execute("""INSERT INTO exams (id, class_id, academic_year_id, term_id, grading_scale_id, name, start_date, end_date, status, created_by, updated_by, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'published', %s, %s, %s)""",
                    (exam1, cls, ay_id, term1_id, scale_id, f"{cls_name} Term 1 Exam",
                     date.today()-timedelta(days=20), date.today()-timedelta(days=18), admin_id, admin_id, school_id))
        exam_count += 1

        # Papers (Math, Science, English)
        paper_ids = []
        for sub, sub_name in [(sub_math, "Math"), (sub_sci, "Science"), (sub_eng, "English")]:
            pid = random_uuid()
            cur.execute("""INSERT INTO exam_papers (id, exam_id, subject_id, held_on, max_marks, pass_marks, version, school_id)
                           VALUES (%s, %s, %s, %s, 100, 40, 1, %s)""",
                        (pid, exam1, sub, date.today()-timedelta(days=20), school_id))
            paper_ids.append((sub, pid))
            paper_count += 1

        # Candidates from this class
        cls_student_indices = [i for i in range(20) if section_for_idx[i][0] == cls]
        for idx in cls_student_indices:
            sid = student_ids[idx]
            eid = enrollment_ids[idx]
            sec = section_for_idx[idx][1]
            cur.execute("""INSERT INTO exam_candidates (exam_id, student_id, enrollment_id, section_id, class_id, school_id)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (exam1, sid, eid, sec, cls, school_id))
            candidate_count += 1
            # Marks for each paper
            for sub, pid in paper_ids:
                score = 55 + ((idx * 7 + paper_count) % 43)  # 55-97
                cur.execute("""INSERT INTO exam_marks (id, exam_id, paper_id, student_id, outcome, score, remark, updated_by, school_id)
                               VALUES (%s, %s, %s, %s, 'scored', %s, '', %s, %s)""",
                            (random_uuid(), exam1, pid, sid, score, admin_id, school_id))
                mark_count += 1

        # Term 2 exam (draft)
        exam2 = random_uuid()
        cur.execute("""INSERT INTO exams (id, class_id, academic_year_id, term_id, grading_scale_id, name, start_date, end_date, status, created_by, updated_by, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s, %s, %s)""",
                    (exam2, cls, ay_id, term2_id, scale_id, f"{cls_name} Term 2 Exam",
                     date.today()+timedelta(days=30), date.today()+timedelta(days=32), admin_id, admin_id, school_id))
        exam_count += 1

    print(f"Exams: {exam_count}, Papers: {paper_count}, Candidates: {candidate_count}, Marks: {mark_count}")

    # === ATTENDANCE ===
    # Last 5 weekdays attendance for each section
    reg_count = 0
    entry_count = 0
    sections_with_students = [(sec8a, cls8, [student_ids[i] for i in range(0,4)],   [enrollment_ids[i] for i in range(0,4)]),
                              (sec8b, cls8, [student_ids[i] for i in range(4,8)],   [enrollment_ids[i] for i in range(4,8)]),
                              (sec9a, cls9, [student_ids[i] for i in range(8,12)],  [enrollment_ids[i] for i in range(8,12)]),
                              (sec9b, cls9, [student_ids[i] for i in range(12,16)], [enrollment_ids[i] for i in range(12,16)]),
                              (sec10a, cls10, [student_ids[i] for i in range(16,18)], [enrollment_ids[i] for i in range(16,18)]),
                              (sec10b, cls10, [student_ids[i] for i in range(18,20)], [enrollment_ids[i] for i in range(18,20)])]
    for day_offset in [5, 4, 3, 2, 1]:  # 5 weekdays back
        d = date.today() - timedelta(days=day_offset)
        if d.weekday() >= 5: continue  # skip Sat/Sun
        for sec, cls, studs, enrolls in sections_with_students:
            rid = random_uuid()
            cur.execute("""INSERT INTO attendance_registers (id, section_id, class_id, academic_year_id, attendance_date, version, created_by, school_id)
                           VALUES (%s, %s, %s, %s, %s, 1, %s, %s)""",
                        (rid, sec, cls, ay_id, d, admin_id, school_id))
            reg_count += 1
            for i, (sid, eid) in enumerate(zip(studs, enrolls)):
                status = 'present'
                if (i + day_offset) % 11 == 0: status = 'absent'
                elif (i + day_offset) % 7 == 0: status = 'late'
                elif (i + day_offset) % 13 == 0: status = 'excused'
                cur.execute("""INSERT INTO attendance_entries (id, register_id, attendance_date, student_id, enrollment_id, status, note, updated_by, school_id)
                               VALUES (%s, %s, %s, %s, %s, %s, '', %s, %s)""",
                            (random_uuid(), rid, d, sid, eid, status, admin_id, school_id))
                entry_count += 1
    print(f"Attendance registers: {reg_count}, entries: {entry_count}")

    # === NOTICES ===
    notice_count = 0
    notices_data = [
        ("Parent-Teacher Meeting", "PTM scheduled for Saturday. Please attend to discuss your child's progress.", "parent", "important", "live"),
        ("Term 1 Exam Results Published", "Term 1 exam results are available. Check the Exams module.", "all", "normal", "live"),
        ("Staff Meeting", "Monthly staff review meeting on Friday at 3 PM.", "teacher", "normal", "live"),
        ("Annual Sports Day", "Sports day registration opens next week.", "student", "normal", "scheduled"),
        ("Holiday Declaration", "School closed on Monday for regional festival.", "all", "important", "live"),
        ("Library Reading Week", "Reading week starts next Monday. Submit book reviews.", "student", "normal", "draft"),
    ]
    first_notice_id = None
    for title, body, audience, priority, state in notices_data:
        nid = random_uuid()
        offset = -1 if state == "live" else (7 if state == "scheduled" else 0)
        available_from = datetime.now() + timedelta(days=offset)
        status_val = "published" if state in ("live", "scheduled") else "draft"
        cur.execute("""INSERT INTO notices (id, title, body, audience, priority, available_from, status, version, content_revision, created_by, updated_by, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, 1, 1, %s, %s, %s)""",
                    (nid, title, body, audience, priority, available_from, status_val, admin_id, admin_id, school_id))
        if first_notice_id is None and audience == "all":
            first_notice_id = nid
        notice_count += 1
    print(f"Notices: {notice_count}")

    # === TIMETABLE SLOTS ===
    # One slot per section per weekday per subject (3 subjects × 5 days × 6 sections = 90 slots)
    tt_count = 0
    subject_ids = [sub_math, sub_sci, sub_eng]
    teacher_for_sub = {sub_math: teacher_ids[0][0], sub_sci: teacher_ids[1][0], sub_eng: teacher_ids[2][0]}
    rooms_list = [room101, room102, room201, room202]
    for sec, cls, sec_label in [(sec8a, cls8, '8A'), (sec8b, cls8, '8B'),
                                 (sec9a, cls9, '9A'), (sec9b, cls9, '9B'),
                                 (sec10a, cls10, '10A'), (sec10b, cls10, '10B')]:
        for day in range(1, 6):  # Mon-Fri
            for sub_idx, sub in enumerate(subject_ids):
                # Find the subject_teacher assignment for this section's class + subject
                cur.execute("""SELECT id FROM teacher_assignments 
                               WHERE class_id=%s AND academic_year_id=%s AND kind='subject_teacher' AND subject_id=%s LIMIT 1""",
                            (cls, ay_id, sub))
                r = cur.fetchone()
                if not r: continue
                aid = r[0]
                tid = teacher_for_sub[sub]
                room = rooms_list[sub_idx % len(rooms_list)]
                start_min = 540 + sub_idx * 60  # 9:00, 10:00, 11:00
                end_min = start_min + 45
                cur.execute("""INSERT INTO timetable_slots (id, section_id, class_id, academic_year_id, assignment_id, teacher_id, subject_id, room_id,
                                                              weekday, start_minute, end_minute, effective_from, effective_to, active, version,
                                                              created_by, changed_by, change_note, school_id)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, '2026-06-01', '2027-04-30', true, 1, %s, %s, 'Initial schedule', %s)""",
                            (random_uuid(), sec, cls, ay_id, aid, tid, sub, room, day, start_min, end_min,
                             admin_id, admin_id, school_id))
                tt_count += 1
    print(f"Timetable slots: {tt_count}")

    # === TRANSPORT ===
    cur.execute("""INSERT INTO transport_vehicles (id, registration_number, capacity, driver_name, driver_phone, insurance_expiry, permit_expiry, active, school_id)
                   VALUES (%s, 'TS09AB1234', 30, 'Ravi Kumar', '+91 98765 30001', '2027-06-30', '2027-03-31', true, %s)""",
                (random_uuid(), school_id))
    cur.execute("""INSERT INTO transport_vehicles (id, registration_number, capacity, driver_name, driver_phone, insurance_expiry, permit_expiry, active, school_id)
                   VALUES (%s, 'TS09CD5678', 40, 'Suresh Yadav', '+91 98765 30002', '2027-06-30', '2027-03-31', true, %s)""",
                (random_uuid(), school_id))

    # === HOMEWORK ===
    for sec, cls in [(sec8a, cls8), (sec9a, cls9), (sec10a, cls10)]:
        cur.execute("""INSERT INTO homework (id, section_id, class_id, academic_year_id, subject_id, teacher_id, created_by, title, details, assigned_on, due_on, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (random_uuid(), sec, cls, ay_id, sub_math, teacher_ids[0][0], admin_id,
                     "Math Exercises Chapter 5",
                     "Complete exercises 5.1 through 5.5 from the textbook. Show all working.",
                     date.today(), date.today()+timedelta(days=3), school_id))

    # === SCHOOL EVENTS ===
    events = [
        ("Annual Day", "Annual cultural program", "event", date.today()+timedelta(days=30), date.today()+timedelta(days=30)),
        ("Sports Day", "Annual sports meet", "event", date.today()+timedelta(days=15), date.today()+timedelta(days=15)),
        ("Independence Day", "Flag hoisting ceremony", "holiday", date.today()+timedelta(days=45), date.today()+timedelta(days=45)),
        ("Parent-Teacher Meeting", "Term review with parents", "meeting", date.today()+timedelta(days=20), date.today()+timedelta(days=20)),
    ]
    for title, desc, etype, start, end in events:
        cur.execute("""INSERT INTO school_events (id, title, description, event_type, starts_on, ends_on, created_by, school_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (random_uuid(), title, desc, etype, start, end, admin_id, school_id))

    # Re-enable triggers
    cur.execute("SET session_replication_role = DEFAULT")
    conn.commit()

    # === FINAL COUNTS ===
    print("\n=== Final populated counts ===")
    for t in ['users', 'students', 'parents', 'teachers', 'academic_years', 'classes', 'sections',
              'subjects', 'enrollments', 'fee_invoices', 'fee_payments', 'exams', 'exam_papers',
              'exam_marks', 'attendance_entries', 'notices', 'timetable_slots', 'homework',
              'school_events', 'transport_vehicles']:
        cur.execute(f"SELECT count(*) FROM {t}")
        print(f"  {t}: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__":
    main()
