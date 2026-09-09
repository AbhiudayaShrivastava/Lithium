"""
Lithium Autonomous Operations Platform — PostgreSQL / SQLite Dual-Engine Adapter
Integrates your teammate's PostgreSQL schema (db.py / schema.sql) with seamless fallback to SQLite WAL.
"""

import os
import datetime
from typing import Dict, List, Any, Optional

# Check if psycopg2 is available
PSYCOPG2_AVAILABLE = False
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    pass

try:
    from backend import db as sqlite_db
except ImportError:
    import db as sqlite_db

# PostgreSQL Configuration from teammate's db.py
PG_HOST = os.environ.get("PGHOST", "localhost")
PG_PORT = os.environ.get("PGPORT", "5432")
PG_DATABASE = os.environ.get("PGDATABASE", "ops_desk")
PG_USER = os.environ.get("PGUSER", "postgres")
PG_PASSWORD = os.environ.get("PGPASSWORD", "Nirvana@1208")

IS_POSTGRES_ACTIVE = False
ACTIVE_ENGINE_NAME = "SQLite 3 WAL"


def test_postgres_connection() -> bool:
    """Tests if the teammate's PostgreSQL server is reachable."""
    if not PSYCOPG2_AVAILABLE:
        return False
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            dbname=PG_DATABASE,
            user=PG_USER,
            password=PG_PASSWORD,
            connect_timeout=2
        )
        conn.close()
        return True
    except Exception:
        return False


def get_pg_connection():
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DATABASE,
        user=PG_USER,
        password=PG_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor
    )


def init_unified_db():
    """Initializes PostgreSQL if available, otherwise initializes SQLite WAL."""
    global IS_POSTGRES_ACTIVE, ACTIVE_ENGINE_NAME
    if test_postgres_connection():
        try:
            # Read teammate's schema.sql
            schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql")
            if not os.path.exists(schema_path):
                schema_path = "schema.sql"
            if os.path.exists(schema_path):
                with open(schema_path, "r") as f:
                    schema_sql = f.read()
                conn = get_pg_connection()
                cur = conn.cursor()
                cur.execute(schema_sql)
                conn.commit()
                cur.close()
                conn.close()
            IS_POSTGRES_ACTIVE = True
            ACTIVE_ENGINE_NAME = f"PostgreSQL ({PG_HOST}:{PG_PORT}/{PG_DATABASE})"
            print(f"[DB] Connected successfully to {ACTIVE_ENGINE_NAME}!")
            return
        except Exception as e:
            print(f"[WARN] PostgreSQL schema init failed: {e}. Falling back to SQLite WAL.")

    # Fallback to durable SQLite WAL
    sqlite_db.init_db()
    IS_POSTGRES_ACTIVE = False
    ACTIVE_ENGINE_NAME = "SQLite 3 WAL (High-Concurrency Fallback)"
    print(f"[DB] Using {ACTIVE_ENGINE_NAME}.")


def get_db_status() -> Dict[str, Any]:
    return {
        "engine": ACTIVE_ENGINE_NAME,
        "is_postgres": IS_POSTGRES_ACTIVE,
        "postgres_host": PG_HOST,
        "postgres_port": PG_PORT,
        "postgres_db": PG_DATABASE
    }


# =============================================================================
# Incident Operations (Dual-Engine)
# =============================================================================

def create_or_update_incident(incident_data: Dict[str, Any]) -> Dict[str, Any]:
    # Always persist to SQLite for rich metadata
    res = sqlite_db.create_or_update_incident(incident_data)

    # If PostgreSQL is active, also sync to teammate's PostgreSQL table
    if IS_POSTGRES_ACTIVE:
        try:
            conn = get_pg_connection()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cur.execute(
                "INSERT INTO incidents (title, root_cause, status, created_at) "
                "VALUES (%s, %s, 'OPEN', %s) RETURNING id;",
                (incident_data.get("title", "Outage Incident"), incident_data.get("diagnosis", ""), now_iso)
            )
            pg_id = cur.fetchone()["id"]
            cur.execute(
                "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
                "VALUES (%s, 'DETECTED', %s, 'Lithium SRE', %s);",
                (pg_id, f"Incident detected: {incident_data.get('title')}", now_iso)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[WARN] PostgreSQL sync error: {e}")

    return res


def resolve_incident(incident_id: str, resolved_by: str, duration_sec: int = 0) -> Optional[Dict[str, Any]]:
    res = sqlite_db.resolve_incident(incident_id, resolved_by, duration_sec)

    if IS_POSTGRES_ACTIVE:
        try:
            conn = get_pg_connection()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cur.execute(
                "UPDATE incidents SET status = 'RESOLVED', resolved_at = %s WHERE status = 'OPEN';",
                (now_iso,)
            )
            cur.execute(
                "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
                "SELECT id, 'RESOLVED', %s, %s, %s FROM incidents WHERE status = 'RESOLVED' ORDER BY id DESC LIMIT 1;",
                (f"Remediation executed by {resolved_by}", resolved_by, now_iso)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[WARN] PostgreSQL resolve sync error: {e}")

    return res


def get_active_incident() -> Optional[Dict[str, Any]]:
    return sqlite_db.get_active_incident()


def get_all_incidents(limit: int = 20) -> List[Dict[str, Any]]:
    return sqlite_db.get_all_incidents(limit)


def add_audit_entry(event_id: str, incident_id: str, source: str, actor: str, action: str, status: str) -> Dict[str, Any]:
    res = sqlite_db.add_audit_entry(event_id, incident_id, source, actor, action, status)

    if IS_POSTGRES_ACTIVE:
        try:
            conn = get_pg_connection()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cur.execute(
                "INSERT INTO audit_log (incident_id, event_type, description, actor, timestamp) "
                "VALUES (1, %s, %s, %s, %s);",
                (status, f"[{source}] {action}", actor, now_iso)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass

    return res


def get_audit_ledger(limit: int = 50) -> List[Dict[str, Any]]:
    return sqlite_db.get_audit_ledger(limit)


def save_pir_record(incident_id: str, title: str, root_cause: str, resolved_time: str, content_md: str) -> Dict[str, Any]:
    res = sqlite_db.save_pir_record(incident_id, title, root_cause, resolved_time, content_md)

    if IS_POSTGRES_ACTIVE:
        try:
            conn = get_pg_connection()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cur.execute(
                "INSERT INTO postmortems (incident_id, markdown, generated_at) "
                "VALUES (1, %s, %s);",
                (content_md, now_iso)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass

    return res


def get_all_pir_records(limit: int = 20) -> List[Dict[str, Any]]:
    return sqlite_db.get_all_pir_records(limit)


def get_avg_resolution_seconds() -> float:
    return sqlite_db.get_avg_resolution_seconds()
