-- Fees carry-over (BATCH_1_HANDOFF.md §2.1). fee_invoices.amount_minor stays snapshot-protected; concessions,
-- instalments, penalties and refunds live in their own tables so the invoice row remains immutable.
-- Balance = invoice.amount_minor - concessions - payments + penalties + refunds. The existing guard_fee_payment
-- trigger is replaced so a payment is rejected only when it would exceed this balance. Concessions and refunds
-- are also guarded so they cannot bring the effective outstanding amount below zero.

CREATE TABLE fee_concessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES fee_invoices(id) ON DELETE RESTRICT,
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000),
 reason varchar(200) NOT NULL CHECK(length(trim(reason)) >= 3),
 approved_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL DEFAULT now(),
 voided_at timestamptz,
 voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
 void_reason varchar(200),
 CHECK((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR
       (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) >= 3))
);
CREATE INDEX fee_concessions_invoice_idx ON fee_concessions(invoice_id, voided_at);

CREATE TABLE fee_instalments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
 due_on date NOT NULL,
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000),
 position integer NOT NULL DEFAULT 0,
 UNIQUE(invoice_id, due_on)
);
CREATE INDEX fee_instalments_invoice_idx ON fee_instalments(invoice_id, position);

CREATE TABLE fee_penalties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES fee_invoices(id) ON DELETE RESTRICT,
 rule varchar(40) NOT NULL CHECK(rule IN ('late_flat','late_percentage','manual')),
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000),
 applied_on date NOT NULL CHECK(applied_on <= CURRENT_DATE),
 applied_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 reason varchar(200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fee_penalties_invoice_idx ON fee_penalties(invoice_id);

CREATE TABLE fee_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES fee_invoices(id) ON DELETE RESTRICT,
 payment_id uuid NOT NULL REFERENCES fee_payments(id) ON DELETE RESTRICT,
 refund_number bigint NOT NULL,
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000),
 reason varchar(200) NOT NULL CHECK(length(trim(reason)) >= 3),
 refunded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 refunded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id, payment_id),
 FOREIGN KEY(payment_id, invoice_id) REFERENCES fee_payments(id, invoice_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX fee_refunds_school_number_key ON fee_refunds(school_id, refund_number);
CREATE INDEX fee_refunds_payment_idx ON fee_refunds(payment_id);

-- Extend school_counters to also cover the refund series. The certificate series is added in 034.
ALTER TABLE school_counters DROP CONSTRAINT school_counters_name_check;
ALTER TABLE school_counters ADD CONSTRAINT school_counters_name_check CHECK(name IN ('invoice','receipt','refund'));
INSERT INTO school_counters(school_id,name,next_value) SELECT id,'refund',1 FROM schools WHERE NOT EXISTS (SELECT 1 FROM school_counters c WHERE c.school_id=schools.id AND c.name='refund');

-- Replace the payment guard so it accounts for concessions, penalties and refunds. The invoice row is still locked.
CREATE OR REPLACE FUNCTION guard_fee_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv fee_invoices; paid bigint; concessions bigint; penalties bigint; refunds bigint; outstanding bigint;
BEGIN
 SELECT * INTO inv FROM fee_invoices WHERE id=NEW.invoice_id FOR UPDATE;
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='23503'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.receipt_number,NEW.invoice_id,NEW.amount_minor,NEW.paid_on,NEW.method,NEW.reference,NEW.idempotency_key,NEW.recorded_by,NEW.recorded_at) IS DISTINCT FROM (OLD.id,OLD.receipt_number,NEW.invoice_id,OLD.amount_minor,OLD.paid_on,OLD.method,OLD.reference,OLD.idempotency_key,NEW.recorded_by,NEW.recorded_at) OR OLD.reversed_at IS NOT NULL OR NEW.reversed_at IS NULL THEN
   RAISE EXCEPTION 'Payments can only be reversed once' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT coalesce(sum(amount_minor),0) INTO paid FROM fee_payments WHERE invoice_id=NEW.invoice_id AND reversed_at IS NULL;
 SELECT coalesce(sum(amount_minor),0) INTO concessions FROM fee_concessions WHERE invoice_id=NEW.invoice_id AND voided_at IS NULL;
 SELECT coalesce(sum(amount_minor),0) INTO penalties FROM fee_penalties WHERE invoice_id=NEW.invoice_id;
 SELECT coalesce(sum(amount_minor),0) INTO refunds FROM fee_refunds WHERE invoice_id=NEW.invoice_id;
 outstanding := inv.amount_minor - concessions - paid + penalties - refunds;
 IF inv.voided_at IS NOT NULL OR NEW.paid_on<inv.issued_on OR NEW.amount_minor>outstanding OR NEW.reversed_at IS NOT NULL THEN
  RAISE EXCEPTION 'Invalid payment date, void invoice or overpayment' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;

-- Concessions cannot bring the effective outstanding amount below zero (no negative balance).
CREATE FUNCTION guard_fee_concession() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv fee_invoices; paid bigint; concessions bigint; penalties bigint; refunds bigint; outstanding bigint;
BEGIN
 SELECT * INTO inv FROM fee_invoices WHERE id=NEW.invoice_id FOR UPDATE;
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='23503'; END IF;
 IF inv.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot add a concession to a void invoice' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(amount_minor),0) INTO paid FROM fee_payments WHERE invoice_id=NEW.invoice_id AND reversed_at IS NULL;
 SELECT coalesce(sum(amount_minor),0) INTO concessions FROM fee_concessions WHERE invoice_id=NEW.invoice_id AND voided_at IS NULL;
 SELECT coalesce(sum(amount_minor),0) INTO penalties FROM fee_penalties WHERE invoice_id=NEW.invoice_id;
 SELECT coalesce(sum(amount_minor),0) INTO refunds FROM fee_refunds WHERE invoice_id=NEW.invoice_id;
 outstanding := inv.amount_minor - concessions - paid + penalties - refunds;
 IF NEW.amount_minor > outstanding THEN RAISE EXCEPTION 'Concession exceeds outstanding amount' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fee_concessions_guard BEFORE INSERT OR UPDATE ON fee_concessions FOR EACH ROW EXECUTE FUNCTION guard_fee_concession();

-- Refunds cannot exceed the parent payment's reversible amount.
CREATE FUNCTION guard_fee_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pay fee_payments; already_refunded bigint;
BEGIN
 SELECT * INTO pay FROM fee_payments WHERE id=NEW.payment_id AND invoice_id=NEW.invoice_id FOR UPDATE;
 IF pay.id IS NULL THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE='23503'; END IF;
 IF pay.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot refund a reversed payment' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(amount_minor),0) INTO already_refunded FROM fee_refunds WHERE payment_id=NEW.payment_id AND id<>NEW.id;
 IF NEW.amount_minor > pay.amount_minor - already_refunded THEN RAISE EXCEPTION 'Refund exceeds reversible amount of the payment' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fee_refunds_guard BEFORE INSERT OR UPDATE ON fee_refunds FOR EACH ROW EXECUTE FUNCTION guard_fee_refund();

-- Assign refund numbers from the per-school series.
CREATE FUNCTION assign_refund_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.refund_number := next_school_number(NEW.school_id,'refund'); RETURN NEW; END; $$;
CREATE TRIGGER fee_refunds_number BEFORE INSERT ON fee_refunds FOR EACH ROW EXECUTE FUNCTION assign_refund_number();

-- Extend the fee_events kind vocabulary so concessions, penalties and refunds are auditable alongside invoices and payments.
-- The original CHECK constraints in migration 006 were inline; column-level checks are auto-named fee_events_kind_check,
-- table-level checks are auto-named fee_events_check (presence) and fee_events_check1 (reason). Drop them by name.
ALTER TABLE fee_events DROP CONSTRAINT IF EXISTS fee_events_kind_check;
ALTER TABLE fee_events DROP CONSTRAINT IF EXISTS fee_events_check;
ALTER TABLE fee_events DROP CONSTRAINT IF EXISTS fee_events_check1;
ALTER TABLE fee_events ADD CONSTRAINT fee_events_kind_check CHECK(kind IN ('invoice_issued','invoice_voided','payment_recorded','payment_reversed','concession_recorded','concession_voided','penalty_applied','refund_issued'));
ALTER TABLE fee_events ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE fee_events ADD COLUMN IF NOT EXISTS concession_id uuid REFERENCES fee_concessions(id) ON DELETE SET NULL;
ALTER TABLE fee_events ADD COLUMN IF NOT EXISTS penalty_id uuid REFERENCES fee_penalties(id) ON DELETE SET NULL;
ALTER TABLE fee_events ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES fee_refunds(id) ON DELETE SET NULL;
ALTER TABLE fee_events ADD CONSTRAINT fee_events_payment_presence_check CHECK(
 (kind IN ('payment_recorded','payment_reversed','refund_issued')) = (payment_id IS NOT NULL)
);
ALTER TABLE fee_events ADD CONSTRAINT fee_events_reason_required_check CHECK(
 kind NOT IN ('invoice_voided','payment_reversed','concession_voided','refund_issued') OR (reason IS NOT NULL AND length(trim(reason)) >= 3)
);
