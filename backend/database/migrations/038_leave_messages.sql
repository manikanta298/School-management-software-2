-- Batch 4 part 1: leave management (student + staff) and teacher-parent messaging (D6: Phase 1 includes
-- student and staff leave; payroll is Phase 2 and NOT included here).
CREATE TABLE leave_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 person_type varchar(10) NOT NULL CHECK(person_type IN ('student','staff')),
 person_id uuid NOT NULL,
 from_date date NOT NULL,
 to_date date NOT NULL CHECK(to_date >= from_date),
 reason varchar(500) NOT NULL CHECK(length(trim(reason)) >= 3),
 status varchar(10) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 review_note varchar(200),
 academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
 CHECK((reviewed_at IS NULL) = (reviewed_by IS NULL) OR status='pending')
);
CREATE INDEX leave_requests_school_status_idx ON leave_requests(school_id, status);
CREATE INDEX leave_requests_person_idx ON leave_requests(person_type, person_id);

CREATE TABLE leave_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 staff_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
 academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
 total_days integer NOT NULL CHECK(total_days >= 0),
 used_days integer NOT NULL DEFAULT 0 CHECK(used_days >= 0 AND used_days <= total_days),
 UNIQUE(school_id, staff_id, academic_year_id)
);
CREATE INDEX leave_balances_staff_idx ON leave_balances(staff_id, academic_year_id);

CREATE TABLE message_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
 parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id, teacher_id, parent_id, student_id)
);
CREATE INDEX message_threads_parent_idx ON message_threads(parent_id);
CREATE INDEX message_threads_teacher_idx ON message_threads(teacher_id);

CREATE TABLE message_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
 body varchar(2000) NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
 sent_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 sent_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX message_messages_thread_idx ON message_messages(thread_id, sent_at);
CREATE INDEX message_messages_recipient_idx ON message_messages(school_id, sent_at DESC);
