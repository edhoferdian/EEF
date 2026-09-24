-- Reference schema for the approval loop (SQLite 3.35+). See approval-loop.md.
-- The guards that matter live here, not in application code: one open draft
-- per (counterparty, channel), stale-epoch decisions rejected, immutable
-- approval snapshots, one active claim per obligation, a one-way claim state
-- machine, and one delivery receipt per (obligation, decision).
-- Every connection must run: PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obligations (
  id            INTEGER PRIMARY KEY,
  counterparty  TEXT NOT NULL CHECK (length(trim(counterparty)) > 0),
  channel       TEXT NOT NULL CHECK (length(trim(channel)) > 0),
  direction     TEXT NOT NULL CHECK (direction IN ('we_owe_them', 'they_owe_us')),
  status        TEXT NOT NULL CHECK (status IN ('drafted', 'approved', 'rejected', 'sent')),
  epoch         INTEGER NOT NULL DEFAULT 1 CHECK (epoch >= 1),
  answers_obligation_id INTEGER REFERENCES obligations(id),
  auto_send_after INTEGER            -- epoch seconds; NULL = wait for a human
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_draft_per_counterparty_channel
  ON obligations(counterparty, channel) WHERE status = 'drafted';

CREATE TABLE IF NOT EXISTS drafts (
  obligation_id INTEGER PRIMARY KEY REFERENCES obligations(id),
  text          TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
  sha256        TEXT NOT NULL CHECK (length(sha256) = 64),
  origin_platform TEXT NOT NULL,
  origin_channel  TEXT NOT NULL,
  origin_thread   TEXT,
  priority      TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  context       TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
  id            INTEGER PRIMARY KEY,
  obligation_id INTEGER NOT NULL REFERENCES obligations(id),
  decision      TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  operator_id   TEXT NOT NULL CHECK (length(trim(operator_id)) > 0),
  nonce         TEXT NOT NULL UNIQUE,
  epoch         INTEGER NOT NULL,
  decided_at    INTEGER NOT NULL
);

-- A decision must be made against the obligation's current epoch while it is
-- still drafted; anything else is stale and is refused outright.
CREATE TRIGGER IF NOT EXISTS decisions_current_epoch_only
BEFORE INSERT ON decisions
WHEN NOT EXISTS (SELECT 1 FROM obligations o
                 WHERE o.id = NEW.obligation_id AND o.epoch = NEW.epoch
                   AND o.status = 'drafted')
BEGIN SELECT RAISE(ABORT, 'stale or non-drafted decision'); END;

-- Written in the same transaction as an approve decision; the only thing that
-- can authorise dispatch.
CREATE TABLE IF NOT EXISTS approval_snapshots (
  decision_id   INTEGER PRIMARY KEY REFERENCES decisions(id),
  obligation_id INTEGER NOT NULL REFERENCES obligations(id),
  epoch         INTEGER NOT NULL,
  text          TEXT NOT NULL,
  sha256        TEXT NOT NULL CHECK (length(sha256) = 64),
  dest_platform TEXT NOT NULL,
  dest_channel  TEXT NOT NULL,
  dest_thread   TEXT
);

CREATE TRIGGER IF NOT EXISTS snapshot_needs_approve_decision
BEFORE INSERT ON approval_snapshots
WHEN NOT EXISTS (SELECT 1 FROM decisions d
                 WHERE d.id = NEW.decision_id AND d.decision = 'approve'
                   AND d.obligation_id = NEW.obligation_id AND d.epoch = NEW.epoch)
BEGIN SELECT RAISE(ABORT, 'snapshot without matching approve decision'); END;

CREATE TRIGGER IF NOT EXISTS snapshot_immutable_update
BEFORE UPDATE ON approval_snapshots
BEGIN SELECT RAISE(ABORT, 'approval snapshots are immutable'); END;

CREATE TRIGGER IF NOT EXISTS snapshot_immutable_delete
BEFORE DELETE ON approval_snapshots
BEGIN SELECT RAISE(ABORT, 'approval snapshots are immutable'); END;

CREATE TABLE IF NOT EXISTS claims (
  id            INTEGER PRIMARY KEY,
  obligation_id INTEGER NOT NULL REFERENCES obligations(id),
  decision_id   INTEGER NOT NULL REFERENCES approval_snapshots(decision_id),
  token         TEXT NOT NULL UNIQUE CHECK (length(token) >= 16),
  state         TEXT NOT NULL CHECK (state IN ('claimed', 'dispatching', 'unknown', 'delivered', 'cancelled')),
  updated_at    INTEGER NOT NULL
);

-- At most one live claim per obligation; a decision can be claimed only once
-- unless the earlier claim was cancelled before dispatch.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_claim_per_obligation
  ON claims(obligation_id) WHERE state IN ('claimed', 'dispatching', 'unknown');
CREATE UNIQUE INDEX IF NOT EXISTS decision_not_reclaimed_after_dispatch
  ON claims(decision_id) WHERE state <> 'cancelled';

CREATE TRIGGER IF NOT EXISTS claims_start_claimed
BEFORE INSERT ON claims WHEN NEW.state <> 'claimed'
BEGIN SELECT RAISE(ABORT, 'claims start in state claimed'); END;

CREATE TRIGGER IF NOT EXISTS claims_one_way
BEFORE UPDATE OF state ON claims
WHEN NOT (
     (OLD.state = 'claimed'     AND NEW.state IN ('dispatching', 'cancelled'))
  OR (OLD.state = 'dispatching' AND NEW.state IN ('delivered', 'unknown'))
  OR (OLD.state = 'unknown'     AND NEW.state = 'delivered'))
BEGIN SELECT RAISE(ABORT, 'illegal claim transition'); END;

CREATE TRIGGER IF NOT EXISTS claims_no_delete
BEFORE DELETE ON claims
BEGIN SELECT RAISE(ABORT, 'claims are never deleted'); END;

-- While a claim is live, the draft behind it cannot change.
CREATE TRIGGER IF NOT EXISTS drafts_frozen_while_claimed
BEFORE UPDATE ON drafts
WHEN EXISTS (SELECT 1 FROM claims c WHERE c.obligation_id = OLD.obligation_id
             AND c.state IN ('claimed', 'dispatching', 'unknown'))
BEGIN SELECT RAISE(ABORT, 'draft frozen by an active claim'); END;

CREATE TABLE IF NOT EXISTS deliveries (
  id            INTEGER PRIMARY KEY,
  obligation_id INTEGER NOT NULL REFERENCES obligations(id),
  decision_id   INTEGER NOT NULL REFERENCES approval_snapshots(decision_id),
  provider_message_ref TEXT NOT NULL,   -- e.g. platform message id / timestamp
  delivered_at  INTEGER NOT NULL,
  UNIQUE (obligation_id, decision_id)
);

CREATE TRIGGER IF NOT EXISTS delivery_needs_dispatched_claim
BEFORE INSERT ON deliveries
WHEN NOT EXISTS (SELECT 1 FROM claims c WHERE c.decision_id = NEW.decision_id
                 AND c.state IN ('dispatching', 'unknown', 'delivered'))
BEGIN SELECT RAISE(ABORT, 'delivery without a dispatched claim'); END;
