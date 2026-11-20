-- Cleanup script: Remove all demo data from the school management database.
-- Strategy:
--   1. Disable triggers session-wide (avoids audit-trigger FK/circular constraints)
--   2. TRUNCATE all tenant-scoped tables with CASCADE
--   3. Preserve: schools row, the admin user + their school_memberships, schema_migrations
--   4. Reset school_counters so per-school numbering starts fresh
--   5. Re-enable triggers
--
-- Run as superuser/owner. Idempotent.

BEGIN;

-- 1. Disable triggers and FK checks for this session
SET session_replication_role = replica;

-- 2. Truncate all tenant-scoped tables in FK-safe order (children first)
-- Order matters: deep children first, parents last.

-- Audit tables (write-only by trigger)
TRUNCATE TABLE attendance_audit, exam_mark_audit, exam_events, fee_events, notice_audit, timetable_audit CASCADE;

-- Attendance
TRUNCATE TABLE attendance_corrections, attendance_entries, attendance_registers CASCADE;

-- Exams
TRUNCATE TABLE exam_student_remarks, exam_marks, exam_candidates, exam_papers, exams, exam_grade_bands, exam_grading_scales, exam_types CASCADE;

-- Fees
TRUNCATE TABLE fee_refunds, fee_penalties, fee_instalments, fee_concessions, fee_payments, fee_events, fee_invoices, fee_structures CASCADE;

-- Homework
TRUNCATE TABLE homework_submissions, homework_completions, homework_attachments, homework CASCADE;

-- Leave
TRUNCATE TABLE leave_requests, leave_balances CASCADE;

-- Notices
TRUNCATE TABLE notice_reads, notices, notice_audit CASCADE;

-- Notifications
TRUNCATE TABLE notification_delivery_attempts, notification_outbox, notification_preferences CASCADE;

-- Messages
TRUNCATE TABLE message_messages, message_threads CASCADE;

-- Certificates
TRUNCATE TABLE certificates_issued CASCADE;

-- Report cards
TRUNCATE TABLE report_card_remarks CASCADE;

-- Transport
TRUNCATE TABLE transport_allocations, transport_stops, transport_routes, transport_vehicles CASCADE;

-- Staff
TRUNCATE TABLE staff_attendance, staff_documents, staff_members CASCADE;

-- Student documents & history
TRUNCATE TABLE student_documents, student_status_history CASCADE;

-- Timetable
TRUNCATE TABLE timetable_slots, timetable_periods, school_rooms, teacher_assignments CASCADE;

-- Calendar / events
TRUNCATE TABLE school_events CASCADE;

-- Subjects & combinations
TRUNCATE TABLE class_subject_combinations, subjects CASCADE;

-- Enrollments + family links
TRUNCATE TABLE student_parents, enrollments, students, parents CASCADE;

-- Sections + classes + terms
TRUNCATE TABLE sections, classes, terms CASCADE;

-- Academic years
TRUNCATE TABLE academic_years CASCADE;

-- School profile (optional - delete since it's a per-school config)
TRUNCATE TABLE school_profiles CASCADE;

-- School counters (reset to fresh state - will be re-created by app when needed)
TRUNCATE TABLE school_counters CASCADE;

-- Auth sessions & login history (logout everyone; admin will sign in fresh)
TRUNCATE TABLE auth_sessions, login_events CASCADE;

-- MFA (no MFA enrolled yet, but clear for safety)
TRUNCATE TABLE user_mfa_secrets CASCADE;

-- 3. Identify and preserve the admin user
-- Delete demo users (those with example.invalid emails) but keep the admin
DELETE FROM school_memberships WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@example.invalid' OR name LIKE 'Demo ·%'
);
DELETE FROM users WHERE email LIKE '%@example.invalid' OR name LIKE 'Demo ·%';

-- 4. Verify admin preserved
DO $$
DECLARE admin_count int;
BEGIN
  SELECT count(*) INTO admin_count FROM users WHERE role = 'admin';
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'No admin user found after cleanup - aborting';
  END IF;
  RAISE NOTICE 'Admin users preserved: %', admin_count;
END $$;

-- 5. Reset school_counters (next_value must be >= 1 per check constraint)
-- Re-insert counter rows for the existing school at value 1 so numbering restarts from 1
INSERT INTO school_counters (school_id, name, next_value)
SELECT s.id, k, 1
FROM schools s
CROSS JOIN (VALUES ('invoice'), ('receipt'), ('refund'), ('certificate')) AS v(k)
WHERE NOT EXISTS (
  SELECT 1 FROM school_counters sc WHERE sc.school_id = s.id AND sc.name = v.k
);

-- 6. Re-enable triggers
SET session_replication_role = DEFAULT;

COMMIT;

-- 7. Verification queries (run separately)
-- SELECT count(*) FROM users;        -- should be 1 (admin only)
-- SELECT count(*) FROM students;     -- should be 0
-- SELECT count(*) FROM teachers;     -- should be 0
-- SELECT count(*) FROM fee_invoices; -- should be 0
-- SELECT count(*) FROM notices;      -- should be 0
-- SELECT count(*) FROM exams;        -- should be 0
