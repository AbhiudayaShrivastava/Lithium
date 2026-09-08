# db.py
# ---------------------------------------------------------------
# This is your entire database layer. It uses `sqlite3`, which is
# part of Python's standard library — nothing extra to install,
# nothing extra to run. The whole database lives in one file:
# ops_desk.db, created automatically the first time you run this.
#
# Your job: give the backend teammate these functions to import
# and call from their FastAPI endpoints. You don't need to touch
# their main.py at all — they just do:
#
#     from db import create_incident, log_audit_event, ...
#
# ---------------------------------------------------------------

import sqlite3
from datetime import datetime, timezone

DB_PATH = "ops_desk.db"


def get_connection():
    """
    Opens a connection to the database file. `row_factory` makes
    query results behave like dictionaries (row["title"]) instead
    of plain tuples (row[0]) — much easier to read.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Creates the tables if they don't already exist. Safe to call
    every time the app starts — it won't wipe existing data.
    Call this once, when your server starts up.
    """
    with open("schema.sql", "r") as f:
        schema = f.read()
    conn = get_connection()
    conn.executescript(schema)
    conn.commit()
    conn.close()


def _now():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------
# INCIDENTS
# ---------------------------------------------------------------

def create_incident(title: str, root_cause: str = "") -> int:
    """
    Inserts a new incident row and returns its new id.
    Also writes the first audit_log entry automatically, since
    "an incident was created" is itself an auditable event.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO incidents (title, root_cause, status, created_at) "
        "VALUES (?, ?, 'OPEN', ?)",
        (title, root_cause, _now()),
    )
    incident_id = cur.lastrowid
    cur.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (?, 'DETECTED', ?, 'system', ?)",
        (incident_id, f"Incident created: {title}", _now()),
    )
    conn.commit()
    conn.close()
    return incident_id


def resolve_incident(incident_id: int, resolution_summary: str):
    """
    Marks an incident as RESOLVED and records the resolution time.
    """
    conn = get_connection()
    conn.execute(
        "UPDATE incidents SET status = 'RESOLVED', resolved_at = ? WHERE id = ?",
        (_now(), incident_id),
    )
    conn.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (?, 'RESOLVED', ?, 'system', ?)",
        (incident_id, resolution_summary, _now()),
    )
    conn.commit()
    conn.close()


def get_all_incidents():
    """Returns every incident, most recent first."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM incidents ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_incident(incident_id: int):
    """Returns one incident by id, or None if it doesn't exist."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------
# AUDIT LOG
# ---------------------------------------------------------------

def log_audit_event(incident_id: int, event_type: str, description: str, actor: str = "system"):
    """
    Appends one row to the audit trail. Use this for every
    meaningful step: AI recommendation given, human approved,
    fix executed, etc.
    """
    conn = get_connection()
    conn.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (?, ?, ?, ?, ?)",
        (incident_id, event_type, description, actor, _now()),
    )
    conn.commit()
    conn.close()


def get_audit_trail(incident_id: int):
    """Returns the full, timestamped history for one incident, in order."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM audit_log WHERE incident_id = ? ORDER BY timestamp ASC",
        (incident_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------
# POSTMORTEMS
# ---------------------------------------------------------------

def save_postmortem(incident_id: int, markdown: str) -> int:
    """Stores a generated postmortem report and links it to its incident."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO postmortems (incident_id, markdown, generated_at) VALUES (?, ?, ?)",
        (incident_id, markdown, _now()),
    )
    postmortem_id = cur.lastrowid
    conn.commit()
    conn.close()
    return postmortem_id


def get_postmortem(incident_id: int):
    """Returns the most recent postmortem for an incident, or None."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM postmortems WHERE incident_id = ? ORDER BY generated_at DESC LIMIT 1",
        (incident_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------
# Run this file directly to sanity-check everything works:
#     python db.py
# ---------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)

    incident_id = create_incident("Auth DB Connection Exhaustion", "Memory leak in connection pool")
    print("Created incident id:", incident_id)

    log_audit_event(incident_id, "AI_RECOMMENDATION", "Scale connection pool by 200%", actor="system")
    log_audit_event(incident_id, "APPROVED", "Engineer approved the fix", actor="Priya")

    resolve_incident(incident_id, "Connection pool scaled, system stable")

    save_postmortem(incident_id, "# Postmortem\nEverything resolved.")

    print("\nAll incidents:")
    for i in get_all_incidents():
        print(" ", i)

    print("\nAudit trail for incident", incident_id, ":")
    for e in get_audit_trail(incident_id):
        print(" ", e)

    print("\nPostmortem:")
    print(get_postmortem(incident_id))
