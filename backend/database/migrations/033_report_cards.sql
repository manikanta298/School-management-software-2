-- Report card remarks: principal/teacher can store a free-text remark per student per academic year per term.
-- The mark and grade data itself comes from the existing exams tables; this table only stores the human remark.
CREATE TABLE report_card_remarks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
 term varchar(40) NOT NULL CHECK(length(trim(term)) BETWEEN 1 AND 40),
 remark varchar(500) NOT NULL CHECK(length(trim(remark)) BETWEEN 1 AND 500),
 author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(student_id, academic_year_id, term)
);
CREATE INDEX report_card_remarks_student_idx ON report_card_remarks(student_id, academic_year_id);
