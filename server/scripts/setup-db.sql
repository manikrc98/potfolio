-- Run this in the Supabase SQL Editor to set up required tables and indexes.

-- Sessions table for persistent session storage (replaces in-memory Map)
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  github_token TEXT NOT NULL,
  user_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Indexes on the existing portfolios table for efficient lookups
CREATE INDEX IF NOT EXISTS idx_portfolios_owner ON portfolios (owner);
CREATE INDEX IF NOT EXISTS idx_portfolios_repo_owner ON portfolios (repo_name, owner);
