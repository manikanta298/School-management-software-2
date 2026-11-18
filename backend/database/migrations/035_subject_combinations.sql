-- Subject combinations per class: a class may declare which subjects are taught, so report cards and
-- timetable generation can iterate a fixed set rather than scanning every paper. Light-touch: a link table
-- with class_id + subject_id, scoped per school (the class and subject tables are already school-scoped).
CREATE TABLE class_subject_combinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL,
 subject_id uuid NOT NULL,
 is_compulsory boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(class_id, subject_id),
 FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
 FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE RESTRICT
);
CREATE INDEX class_subject_combinations_class_idx ON class_subject_combinations(class_id);
CREATE INDEX class_subject_combinations_subject_idx ON class_subject_combinations(subject_id);
-- Same-school guard: the class and subject must belong to the same school as the row.
CREATE FUNCTION guard_class_subject_combination() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cls classes; sub subjects;
BEGIN
 SELECT * INTO cls FROM classes WHERE id=NEW.class_id FOR SHARE;
 SELECT * INTO sub FROM subjects WHERE id=NEW.subject_id FOR SHARE;
 IF cls.id IS NULL OR sub.id IS NULL OR cls.school_id<>NEW.school_id OR sub.school_id<>NEW.school_id THEN
  RAISE EXCEPTION 'Class and subject must belong to the same school' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER class_subject_combinations_guard BEFORE INSERT OR UPDATE ON class_subject_combinations FOR EACH ROW EXECUTE FUNCTION guard_class_subject_combination();
