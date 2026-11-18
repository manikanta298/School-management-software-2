-- Student documents (§2.2 P1). Tenant-owned document table with MIME/size guards per D1.
-- Supports the profile "documents" tab: upload, list, download with tenant-scoped authorization.
CREATE TABLE student_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 name varchar(120) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 mime varchar(64) NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg')),
 bytea bytea NOT NULL CHECK(octet_length(bytea) <= 524288),
 uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_documents_student_idx ON student_documents(student_id);
CREATE INDEX student_documents_school_idx ON student_documents(school_id, created_at DESC);
