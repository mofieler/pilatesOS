-- Migration: credit_lots
-- One row per "deposit" of credits. Replaces the single creditBalances.expiresAt
-- column (which silently overwrote older expiry dates on top-up) with a
-- lot-based FIFO ledger.
--
-- Phase: ADDITIVE. Existing code paths continue to read/write credit_balances.
-- The dual-write through credit.service.addCredits() in Sprint 3 starts
-- populating credit_lots in parallel. FIFO debit (Sprint 4) reads from lots.
-- A backfill script (Sprint 5) seeds lots from existing credit_balances rows.

CREATE TABLE IF NOT EXISTS credit_lots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credit_type       credit_type NOT NULL,
  original_amount   INTEGER NOT NULL,
  remaining_amount  INTEGER NOT NULL,
  purchase_id       UUID REFERENCES credit_purchases(id) ON DELETE SET NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_lots_remaining_nonneg CHECK (remaining_amount >= 0),
  CONSTRAINT credit_lots_remaining_lte_original CHECK (remaining_amount <= original_amount),
  CONSTRAINT credit_lots_status_valid CHECK (status IN ('active','exhausted','expired'))
);

-- FIFO query: WHERE user_id AND credit_type AND status='active' AND expires_at > NOW()
--             ORDER BY expires_at ASC FOR UPDATE
CREATE INDEX IF NOT EXISTS credit_lots_fifo_idx
  ON credit_lots (user_id, credit_type, status, expires_at);

-- Cron expiry sweep: WHERE status='active' AND expires_at <= NOW()
CREATE INDEX IF NOT EXISTS credit_lots_expiry_sweep_idx
  ON credit_lots (status, expires_at);

CREATE INDEX IF NOT EXISTS credit_lots_user_idx
  ON credit_lots (user_id);

COMMENT ON TABLE credit_lots IS
  'Per-deposit credit ledger. FIFO-consumed by expires_at. Replaces the legacy single-row expires_at on credit_balances.';
