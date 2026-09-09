-- schema.sql (PostgreSQL version)
-- This defines the "shape" of your database: 3 tables.
-- You don't have to run this file directly — db.py runs these
-- same statements automatically when the app starts. It's kept
-- here separately so you (and judges, if they ask) can see the
-- schema clearly in one place.

-- Table 1: One row per incident (an outage / predicted problem)
CREATE TABLE IF NOT EXISTS incidents (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    root_cause    TEXT,
    status        TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN | RESOLVED
    created_at    TEXT NOT NULL,                  -- ISO timestamp
    resolved_at   TEXT                            -- NULL until resolved
);

-- Table 2: The immutable audit trail. Every single thing that
-- happens (detection, AI recommendation, human approval, fix
-- executed) gets one row here. Rows are never edited or deleted —
-- that's what makes it "auditable".
CREATE TABLE IF NOT EXISTS audit_log (
    id            SERIAL PRIMARY KEY,
    incident_id   INTEGER NOT NULL REFERENCES incidents (id),
    event_type    TEXT NOT NULL,     -- e.g. DETECTED, AI_RECOMMENDATION, FIX_EXECUTED, APPROVED
    description   TEXT NOT NULL,
    actor         TEXT NOT NULL,     -- 'system' or a person's name
    timestamp     TEXT NOT NULL      -- ISO timestamp
);

-- Table 3: The generated postmortem report, one per incident.
CREATE TABLE IF NOT EXISTS postmortems (
    id            SERIAL PRIMARY KEY,
    incident_id   INTEGER NOT NULL REFERENCES incidents (id),
    markdown      TEXT NOT NULL,
    generated_at  TEXT NOT NULL
);
