CREATE TABLE wallet_nonces (nonce TEXT PRIMARY KEY,address TEXT NOT NULL,message TEXT NOT NULL,origin TEXT NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE wallet_sessions (token_hash TEXT PRIMARY KEY,address TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX wallet_sessions_expiry ON wallet_sessions(expires_at);
ALTER TABLE attempts ADD COLUMN wallet_address TEXT;
ALTER TABLE entries ADD COLUMN wallet_address TEXT;
CREATE INDEX wallet_progress ON entries(wallet_address,challenge_id,score DESC);
