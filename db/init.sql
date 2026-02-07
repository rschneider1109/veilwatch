-- Veilwatch minimal persistence schema (JSONB state)
CREATE TABLE IF NOT EXISTS vw_state (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
