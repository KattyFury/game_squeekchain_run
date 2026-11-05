CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id), started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, submitted_at INTEGER, replay_hash TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS entries (attempt_id TEXT PRIMARY KEY REFERENCES attempts(id), challenge_id TEXT NOT NULL, rules TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, ticks INTEGER NOT NULL, completed INTEGER NOT NULL, replay TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS leaderboard_rank ON entries(challenge_id, rules, score DESC, ticks ASC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
