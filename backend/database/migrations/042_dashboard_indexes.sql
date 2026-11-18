-- Dashboard KPI indexes (§2.1). Add only where EXPLAIN would benefit on a realistic dataset.
-- These are tenant-scoped composite indexes that the dashboard queries filter on.
CREATE INDEX IF NOT EXISTS students_school_lifecycle_idx ON students(school_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS staff_members_school_type_status_idx ON staff_members(school_id, staff_type, employment_status);
CREATE INDEX IF NOT EXISTS attendance_registers_school_date_idx ON attendance_registers(school_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS fee_payments_school_paid_on_idx ON fee_payments(school_id, paid_on DESC) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS fee_invoices_school_year_due_idx ON fee_invoices(school_id, academic_year_id, due_on) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS exams_school_year_status_idx ON exams(school_id, academic_year_id, status);
CREATE INDEX IF NOT EXISTS notices_school_status_available_idx ON notices(school_id, status, available_from DESC);
CREATE INDEX IF NOT EXISTS leave_requests_school_status_idx ON leave_requests(school_id, status, requested_at DESC);
