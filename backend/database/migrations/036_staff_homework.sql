-- Batch 3 part 1: staff attendance, staff documents, homework attachments and submissions (D1: bytea ≤512 KiB).
CREATE TABLE staff_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 staff_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
 attendance_date date NOT NULL CHECK(attendance_date <= CURRENT_DATE),
 status varchar(10) NOT NULL CHECK(status IN ('present','absent','leave','half_day')),
 note varchar(200),
 recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(staff_id, attendance_date)
);
CREATE INDEX staff_attendance_school_date_idx ON staff_attendance(school_id, attendance_date);
CREATE INDEX staff_attendance_staff_idx ON staff_attendance(staff_id, attendance_date);

CREATE TABLE staff_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 staff_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
 name varchar(120) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 mime varchar(64) NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg')),
 bytea bytea NOT NULL CHECK(octet_length(bytea) <= 524288),
 uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_documents_staff_idx ON staff_documents(staff_id);

CREATE TABLE homework_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
 name varchar(120) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 mime varchar(64) NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg')),
 bytea bytea NOT NULL CHECK(octet_length(bytea) <= 524288),
 uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX homework_attachments_homework_idx ON homework_attachments(homework_id);

CREATE TABLE homework_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 name varchar(120) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 mime varchar(64) NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg')),
 bytea bytea NOT NULL CHECK(octet_length(bytea) <= 524288),
 note varchar(500),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 feedback varchar(1000),
 feedback_by uuid REFERENCES users(id) ON DELETE SET NULL,
 feedback_at timestamptz,
 UNIQUE(homework_id, student_id)
);
CREATE INDEX homework_submissions_homework_idx ON homework_submissions(homework_id);
CREATE INDEX homework_submissions_student_idx ON homework_submissions(student_id);
