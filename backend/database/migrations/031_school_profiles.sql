-- Per-school public profile: display name, address, contact details, principal name, and an optional logo
-- stored as bytea (decision D1: small files in PostgreSQL, ≤512 KiB, MIME and size checked at the API boundary).
CREATE TABLE school_profiles (
 school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
 display_name varchar(120) NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 120),
 address varchar(500),
 phone varchar(30) CHECK(phone IS NULL OR phone ~ '^[+0-9() .-]{7,30}$'),
 email varchar(254) CHECK(email IS NULL OR email = lower(email)),
 principal_name varchar(100) CHECK(principal_name IS NULL OR length(trim(principal_name)) BETWEEN 1 AND 100),
 letterhead_text varchar(500),
 logo_mime varchar(64) CHECK(logo_mime IS NULL OR logo_mime IN ('image/png','image/jpeg')),
 logo_bytea bytea CHECK(logo_bytea IS NULL OR octet_length(logo_bytea) <= 524288),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
