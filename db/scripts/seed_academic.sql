-- Populate the school database with realistic test data using standard names.
-- Inserts are scoped to the existing school_id (the only school in `schools`).
-- All inserts use parameterized values via Python; this file is the documentation form.

BEGIN;
SET session_replication_role = replica;

-- 1. Academic year + 2 terms (current year, no DEMO prefix)
INSERT INTO academic_years (id, name, start_date, end_date, is_current, school_id)
SELECT gen_random_uuid(), 'Academic Year 2026-27', '2026-06-01'::date, '2027-04-30'::date, true, s.id
FROM schools s
WHERE NOT EXISTS (SELECT 1 FROM academic_years);

-- Capture the year id (use a fixed marker UUID for deterministic references)
UPDATE academic_years SET id = 'aaaaaaaa-0001-4000-8000-000000000001'
WHERE is_current = true AND school_id = (SELECT id FROM schools LIMIT 1);

-- 2. Terms
INSERT INTO terms (id, academic_year_id, name, start_date, end_date)
VALUES
  ('aaaaaaaa-0002-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'Term 1', '2026-06-01'::date, '2026-10-31'::date),
  ('aaaaaaaa-0002-4000-8000-000000000002', 'aaaaaaaa-0001-4000-8000-000000000001', 'Term 2', '2026-11-01'::date, '2027-04-30'::date);

-- 3. Classes (Class 8, Class 9, Class 10)
INSERT INTO classes (id, academic_year_id, name, school_id)
VALUES
  ('aaaaaaaa-0003-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'Class 8', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0003-4000-8000-000000000002', 'aaaaaaaa-0001-4000-8000-000000000001', 'Class 9', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0003-4000-8000-000000000003', 'aaaaaaaa-0001-4000-8000-000000000001', 'Class 10', (SELECT id FROM schools LIMIT 1));

-- 4. Sections (A, B for each class — 6 total)
INSERT INTO sections (id, class_id, name, capacity, school_id)
VALUES
  ('aaaaaaaa-0004-4000-8000-000000000001', 'aaaaaaaa-0003-4000-8000-000000000001', 'A', 40, (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0004-4000-8000-000000000002', 'aaaaaaaa-0003-4000-8000-000000000001', 'B', 40, (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0004-4000-8000-000000000003', 'aaaaaaaa-0003-4000-8000-000000000002', 'A', 40, (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0004-4000-8000-000000000004', 'aaaaaaaa-0003-4000-8000-000000000002', 'B', 40, (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0004-4000-8000-000000000005', 'aaaaaaaa-0003-4000-8000-000000000003', 'A', 35, (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0004-4000-8000-000000000006', 'aaaaaaaa-0003-4000-8000-000000000003', 'B', 35, (SELECT id FROM schools LIMIT 1));

-- 5. Subjects
INSERT INTO subjects (id, name, code, school_id)
VALUES
  ('aaaaaaaa-0005-4000-8000-000000000001', 'Mathematics', 'MATH', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0005-4000-8000-000000000002', 'Science',      'SCI',  (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0005-4000-8000-000000000003', 'English',      'ENG',  (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0005-4000-8000-000000000004', 'Social Studies','SOC', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0005-4000-8000-000000000005', 'Hindi',        'HIN',  (SELECT id FROM schools LIMIT 1));

-- 6. School rooms
INSERT INTO school_rooms (id, name, location, school_id)
VALUES
  ('aaaaaaaa-0006-4000-8000-000000000001', 'Room 101', 'Ground floor · Main building', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0006-4000-8000-000000000002', 'Room 102', 'Ground floor · Main building', (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0006-4000-8000-000000000003', 'Room 201', 'First floor · Science block',  (SELECT id FROM schools LIMIT 1)),
  ('aaaaaaaa-0006-4000-8000-000000000004', 'Room 202', 'First floor · Science block',  (SELECT id FROM schools LIMIT 1));

SET session_replication_role = DEFAULT;
COMMIT;
