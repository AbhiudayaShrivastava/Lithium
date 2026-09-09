# db.py
# ---------------------------------------------------------------
# This is your entire database layer, now talking to a real
# PostgreSQL server instead of a single SQLite file. It uses
# `psycopg2`, which is NOT part of the standard library — that's
# why there's a requirements.txt this time. Function names and
# signatures are identical to the SQLite version, so your
# teammate's main.py wiring (integration_snippet.py) barely changes.
#
# Your job: give the backend teammate these functions to import
# and call from their FastAPI endpoints. You don't need to touch
# their main.py at all — they just do:
#
#     from db import create_incident, log_audit_event, ...
#
# ---------------------------------------------------------------

import os
from dotenv import load_dotenv
load_dotenv()
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

# ---------------------------------------------------------------
# CONNECTION SETTINGS
# ---------------------------------------------------------------
# Reads from environment variables so nobody has to hardcode a
# password into this file. If a variable isn't set, it falls back
# to sensible local-development defaults.
#
# The easiest way to set these on your friend's laptop is a `.env`
# file — see the README for exact steps.

DB_HOST = os.environ.get("PGHOST", "localhost")
DB_PORT = os.environ.get("PGPORT", "5432")
DB_NAME = os.environ.get("PGDATABASE", "ops_desk")
DB_USER = os.environ.get("PGUSER", "postgres")
DB_PASSWORD = "Nirvana@1208"


def get_connection():
    """
    Opens a connection to the PostgreSQL server. `cursor_factory`
    makes query results behave like dictionaries (row["title"])
    instead of plain tuples (row[0]) — much easier to read.
    """
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
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
    cur = conn.cursor()
    cur.execute(schema)
    conn.commit()
    cur.close()
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
        "VALUES (%s, %s, 'OPEN', %s) RETURNING id",
        (title, root_cause, _now()),
    )
    incident_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (%s, 'DETECTED', %s, 'system', %s)",
        (incident_id, f"Incident created: {title}", _now()),
    )
    conn.commit()
    cur.close()
    conn.close()
    return incident_id


def resolve_incident(incident_id: int, resolution_summary: str):
    """
    Marks an incident as RESOLVED and records the resolution time.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE incidents SET status = 'RESOLVED', resolved_at = %s WHERE id = %s",
        (_now(), incident_id),
    )
    cur.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (%s, 'RESOLVED', %s, 'system', %s)",
        (incident_id, resolution_summary, _now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_all_incidents():
    """Returns every incident, most recent first."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(row) for row in rows]


def get_incident(incident_id: int):
    """Returns one incident by id, or None if it doesn't exist."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE id = %s", (incident_id,))
    row = cur.fetchone()
    cur.close()
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
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
        "VALUES (%s, %s, %s, %s, %s)",
        (incident_id, event_type, description, actor, _now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_audit_trail(incident_id: int):
    """Returns the full, timestamped history for one incident, in order."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM audit_log WHERE incident_id = %s ORDER BY timestamp ASC",
        (incident_id,),
    )
    rows = cur.fetchall()
    cur.close()
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
        "INSERT INTO postmortems (incident_id, markdown, generated_at) "
        "VALUES (%s, %s, %s) RETURNING id",
        (incident_id, markdown, _now()),
    )
    postmortem_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return postmortem_id


def get_postmortem(incident_id: int):
    """Returns the most recent postmortem for an incident, or None."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM postmortems WHERE incident_id = %s ORDER BY generated_at DESC LIMIT 1",
        (incident_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------
# Run this file directly to sanity-check everything works:
#     python db.py
# ---------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("Database initialized on", DB_HOST, "/", DB_NAME)

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
