-- Metap Watch schema (Vercel Postgres)
-- Run via /api/db-init or https://vercel.com/dashboard/stores/<store>/data (SQL editor).

-- Filings pulled from SEC EDGAR (dedup key: adsh/id)
CREATE TABLE IF NOT EXISTS filings (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  company       TEXT NOT NULL,
  cik           TEXT,
  date          TEXT,
  description   TEXT,
  url           TEXT,
  impact_score  INTEGER NOT NULL DEFAULT 0,
  keywords      JSONB NOT NULL DEFAULT '[]',
  source        TEXT NOT NULL DEFAULT 'edgar',
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_filings_date ON filings (date);
CREATE INDEX IF NOT EXISTS idx_filings_impact ON filings (impact_score DESC);

-- Magma analyses of filings (one per filing, upserted)
CREATE TABLE IF NOT EXISTS analyses (
  filing_id         TEXT PRIMARY KEY REFERENCES filings(id) ON DELETE CASCADE,
  company           TEXT NOT NULL,
  form_type         TEXT NOT NULL,
  filed_date        TEXT,
  entities          JSONB NOT NULL DEFAULT '[]',
  sentiment         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  sentiment_label   TEXT NOT NULL DEFAULT 'neutral',
  risk_score        INTEGER NOT NULL DEFAULT 30,
  materiality_score INTEGER NOT NULL DEFAULT 40,
  key_findings      JSONB NOT NULL DEFAULT '[]',
  financial_signals JSONB NOT NULL DEFAULT '[]',
  regulatory_signals JSONB NOT NULL DEFAULT '[]',
  market_moving_events JSONB NOT NULL DEFAULT '[]',
  raw               JSONB,
  analyzed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated prediction markets (from analyses)
CREATE TABLE IF NOT EXISTS markets (
  id                   TEXT PRIMARY KEY,
  filing_id            TEXT REFERENCES filings(id) ON DELETE CASCADE,
  generated_from       TEXT,
  question             TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'binary',
  yes_initial          DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  no_initial           DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  time_horizon         TEXT NOT NULL DEFAULT '90d',
  resolution_source    TEXT,
  reasoning            TEXT,
  related_entities     JSONB NOT NULL DEFAULT '[]',
  confidence           DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  sentiment            DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_markets_confidence ON markets (confidence DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  filing_id   TEXT REFERENCES filings(id) ON DELETE SET NULL,
  filing_type TEXT,
  filing_company TEXT,
  impact_score INTEGER,
  matched_question TEXT,
  match_score DOUBLE PRECISION,
  direction   TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);

-- Spend / usage accounting for paid (x402) + AI calls, for rate limiting + spend caps
CREATE TABLE IF NOT EXISTS usage(
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,          -- 'ai_scan' | 'magma' | 'x402'
  actor      TEXT NOT NULL DEFAULT '', -- api key id / client id
  tokens     INTEGER NOT NULL DEFAULT 0,
  cost_units DOUBLE PRECISION NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_actor ON usage (actor, kind, consumed_at);
