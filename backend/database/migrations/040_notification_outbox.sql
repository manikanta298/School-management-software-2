-- Notification outbox (referenced by §2.5 attendance, §2.13 communication, §2.15 certificates,
-- §2.12 transport expiry, §2.9 homework). Provider delivery is P2; this table records the intent
-- transactionally with the business action so a worker can pick it up later.
CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 event_type varchar(40) NOT NULL CHECK(length(trim(event_type)) BETWEEN 1 AND 40),
 channel varchar(10) NOT NULL CHECK(channel IN ('in_app','email','sms','whatsapp')),
 recipient_ref varchar(254) NOT NULL,
 template_key varchar(60) NOT NULL CHECK(length(trim(template_key)) BETWEEN 1 AND 60),
 payload_ref uuid,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','dead')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 provider_message_id varchar(200),
 last_error_code varchar(60),
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
CREATE INDEX notification_outbox_status_next_idx ON notification_outbox(status, next_attempt_at);
CREATE INDEX notification_outbox_school_created_idx ON notification_outbox(school_id, created_at DESC);
CREATE INDEX notification_outbox_recipient_idx ON notification_outbox(school_id, recipient_ref);

CREATE TABLE notification_delivery_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 outbox_id uuid NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
 attempted_at timestamptz NOT NULL DEFAULT now(),
 success boolean NOT NULL,
 provider_response_code varchar(20),
 provider_response_ref varchar(200),
 error_message varchar(500)
);
CREATE INDEX notification_delivery_attempts_outbox_idx ON notification_delivery_attempts(outbox_id, attempted_at);
