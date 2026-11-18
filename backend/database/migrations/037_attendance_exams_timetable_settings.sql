-- Batch 3 part 2: attendance corrections queue, exam types, exam principal remarks, timetable periods,
-- notification preferences. All tenant-scoped; school_id is written explicitly on every insert.
CREATE TABLE attendance_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 attendance_date date NOT NULL,
 requested_status varchar(8) NOT NULL CHECK(requested_status IN ('present','absent','late','excused','half_day')),
 reason varchar(200) NOT NULL CHECK(length(trim(reason)) >= 3),
 requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 requested_at timestamptz NOT NULL DEFAULT now(),
 status varchar(10) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 review_note varchar(200),
 UNIQUE(student_id, attendance_date)
);
CREATE INDEX attendance_corrections_school_status_idx ON attendance_corrections(school_id, status);
CREATE INDEX attendance_corrections_student_idx ON attendance_corrections(student_id);

CREATE TABLE exam_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 name varchar(60) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60),
 code varchar(20) NOT NULL CHECK(code ~ '^[A-Z0-9_-]{1,20}$'),
 UNIQUE(school_id, code)
);
CREATE UNIQUE INDEX exam_types_school_name_unique ON exam_types(school_id, lower(name));
CREATE INDEX exam_types_school_idx ON exam_types(school_id);

CREATE TABLE exam_student_remarks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 remark varchar(500) NOT NULL CHECK(length(trim(remark)) BETWEEN 1 AND 500),
 author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(exam_id, student_id)
);
CREATE INDEX exam_student_remarks_exam_idx ON exam_student_remarks(exam_id);

CREATE TABLE timetable_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 day_of_week smallint NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
 period_index smallint NOT NULL CHECK(period_index BETWEEN 1 AND 20),
 start_time time NOT NULL,
 end_time time NOT NULL CHECK(end_time > start_time),
 is_break boolean NOT NULL DEFAULT false,
 label varchar(40),
 UNIQUE(school_id, day_of_week, period_index)
);
CREATE INDEX timetable_periods_school_day_idx ON timetable_periods(school_id, day_of_week, period_index);

CREATE TABLE notification_preferences (
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 channel varchar(20) NOT NULL CHECK(channel IN ('in_app','email','sms')),
 enabled boolean NOT NULL DEFAULT true,
 digest varchar(10) NOT NULL DEFAULT 'instant' CHECK(digest IN ('instant','daily','weekly')),
 PRIMARY KEY(school_id, user_id, channel)
);
CREATE INDEX notification_preferences_user_idx ON notification_preferences(user_id);
