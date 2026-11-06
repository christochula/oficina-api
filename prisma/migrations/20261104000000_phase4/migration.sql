-- Projections/process state owned exclusively by OS Service. No foreign DB access.
CREATE TABLE phase4_orders (id TEXT PRIMARY KEY, numero SERIAL UNIQUE, data JSONB NOT NULL);
CREATE TABLE phase4_inbox (message_id TEXT PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE phase4_outbox (
 id TEXT PRIMARY KEY, destination TEXT NOT NULL, message JSONB NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 sent_at TIMESTAMPTZ, last_error TEXT
);
CREATE INDEX phase4_outbox_pending ON phase4_outbox(available_at) WHERE sent_at IS NULL;
