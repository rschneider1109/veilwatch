-- Veilwatch minimal persistence schema
-- Stores the whole state as JSONB so you can evolve structure without migrations.

CREATE TABLE IF NOT EXISTS vw_state (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION vw_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vw_state_touch ON vw_state;
CREATE TRIGGER vw_state_touch
BEFORE UPDATE ON vw_state
FOR EACH ROW
EXECUTE FUNCTION vw_touch_updated_at();
