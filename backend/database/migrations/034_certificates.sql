-- Certificates (bonafide, transfer, study, character). Each issued certificate gets a per-school gap-free
-- number from school_counters (the 'certificate' series), a snapshot of the student and school profile at
-- issue time, and a voided_at/void_reason pair for revocation. Reissue creates a new row with a new number;
-- the old row stays visible as superseded.
ALTER TABLE school_counters DROP CONSTRAINT school_counters_name_check;
ALTER TABLE school_counters ADD CONSTRAINT school_counters_name_check CHECK(name IN ('invoice','receipt','refund','certificate'));
INSERT INTO school_counters(school_id,name,next_value) SELECT id,'certificate',1 FROM schools WHERE NOT EXISTS (SELECT 1 FROM school_counters c WHERE c.school_id=schools.id AND c.name='certificate');

CREATE TABLE certificates_issued (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 certificate_number bigint NOT NULL,
 type varchar(20) NOT NULL CHECK(type IN ('bonafide','transfer','study','character')),
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
 issued_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 issued_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb NOT NULL,
 voided_at timestamptz,
 voided_by uuid REFERENCES users(id) ON DELETE SET NULL,
 void_reason varchar(200),
 superseded_by uuid REFERENCES certificates_issued(id) ON DELETE SET NULL,
 UNIQUE(school_id, certificate_number),
 CHECK((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR
       (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) >= 3))
);
CREATE INDEX certificates_student_idx ON certificates_issued(student_id);
CREATE INDEX certificates_school_type_idx ON certificates_issued(school_id, type);

CREATE FUNCTION assign_certificate_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.certificate_number := next_school_number(NEW.school_id,'certificate'); RETURN NEW; END; $$;
CREATE TRIGGER certificates_issued_number BEFORE INSERT ON certificates_issued FOR EACH ROW EXECUTE FUNCTION assign_certificate_number();
