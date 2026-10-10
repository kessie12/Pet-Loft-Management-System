-- Additive migration. Business records stay in Google Sheets; never drop legacy tables.
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  rooms_json TEXT NOT NULL CHECK (json_valid(rooms_json)),
  services_json TEXT NOT NULL CHECK (json_valid(services_json)),
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS app_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Boss','Staff')),
  phone TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  credit_access INTEGER CHECK (credit_access IN (0,1)),
  password_hash TEXT NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  auth_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS app_rate_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_sheet_locks (
  sheet_id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
);
-- Metadata only: no booking/customer/credit data or request bodies in D1.
CREATE TABLE IF NOT EXISTS app_requests (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, action TEXT NOT NULL,
  digest TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('pending','done','uncertain')),
  record_id TEXT, created_at INTEGER NOT NULL
);
