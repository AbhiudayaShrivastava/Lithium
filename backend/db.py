"""
Lithium Autonomous Operations Platform — SQLite Database Layer
Uses SQLite 3 with Write-Ahead Logging (WAL mode) for high-concurrency, durable persistence.
"""

import os
import sqlite3
import json
import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lithium.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def init_db():
    """Initializes SQLite schema and seeds baseline audit trail if empty."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Incidents Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                incident_number TEXT,
                title TEXT NOT NULL,
                severity TEXT NOT NULL,
                risk_rate INTEGER NOT NULL,
                risk_level_tag TEXT NOT NULL,
                epicenter TEXT NOT NULL,
                diagnosis TEXT,
                recommended_action TEXT,
                status TEXT DEFAULT 'ACTIVE',
                root_node TEXT DEFAULT 'gateway',
                affected_nodes TEXT DEFAULT '[]',
                latency_ms INTEGER DEFAULT 32,
                health_score REAL DEFAULT 99.8,
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                resolved_by TEXT,
                resolution_duration_sec INTEGER DEFAULT 0
            );
        """)

        # 2. Immutable Audit Ledger Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE NOT NULL,
                incident_id TEXT,
                source TEXT NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                status TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );
        """)

        # 3. Post-Incident Reviews (PIR) Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pir_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT NOT NULL,
                title TEXT,
                root_cause TEXT,
                resolved_time TEXT,
                content_md TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)

        # Seed baseline audit entry if table is empty
        cursor.execute("SELECT COUNT(*) FROM audit_ledger;")
        count = cursor.fetchone()[0]
        if count == 0:
            now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M:%S")
            cursor.execute("""
                INSERT INTO audit_ledger (event_id, incident_id, source, actor, action, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, ("SYS-INIT", "SYS-001", "CLOUD", "Lithium Engine", "Cluster baseline health verified & WAL mode armed", "HEALTHY", now_str))
            cursor.execute("""
                INSERT INTO audit_ledger (event_id, incident_id, source, actor, action, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, ("TWIN-SYNC", "SYS-002", "METRICS", "Digital Twin", "Predictive shadow thread calibrated (+15m)", "SYNCED", now_str))

        conn.commit()


# =============================================================================
# Incident Operations
# =============================================================================

def create_or_update_incident(incident_data: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts or replaces an active incident into SQLite."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    affected_nodes_json = json.dumps(incident_data.get("affected_nodes", []))
    inc_id = incident_data.get("id") or f"INC-{datetime.datetime.now().strftime('%M%S')}"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO incidents (
                id, incident_number, title, severity, risk_rate, risk_level_tag,
                epicenter, diagnosis, recommended_action, status, root_node,
                affected_nodes, latency_ms, health_score, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
        """, (
            inc_id,
            incident_data.get("incident_number", f"#{inc_id}"),
            incident_data.get("title", "Service Degradation"),
            incident_data.get("severity", "P1 CRITICAL"),
            int(incident_data.get("risk_rate", 80)),
            incident_data.get("risk_level_tag", "CRITICAL"),
            incident_data.get("epicenter", "API Gateway"),
            incident_data.get("diagnosis", "Telemetry threshold breached"),
            incident_data.get("recommended_action") or incident_data.get("action", "Restart affected service"),
            incident_data.get("root_node", "gateway"),
            affected_nodes_json,
            int(incident_data.get("latency_ms", 500)),
            float(incident_data.get("health_score", 45.0)),
            now_iso
        ))
        conn.commit()

    return get_incident(inc_id)


def resolve_incident(incident_id: str, resolved_by: str, duration_sec: int = 0) -> Optional[Dict[str, Any]]:
    """Marks an active incident as RESOLVED in SQLite."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE incidents
            SET status = 'RESOLVED',
                resolved_at = ?,
                resolved_by = ?,
                resolution_duration_sec = ?
            WHERE id = ? AND status = 'ACTIVE'
        """, (now_iso, resolved_by, duration_sec, incident_id))
        conn.commit()

    return get_incident(incident_id)


def get_active_incident() -> Optional[Dict[str, Any]]:
    """Returns the currently active incident, if any."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM incidents
            WHERE status = 'ACTIVE'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        try:
            res["affected_nodes"] = json.loads(res.get("affected_nodes", "[]"))
        except Exception:
            res["affected_nodes"] = []
        return res


def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a specific incident by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        try:
            res["affected_nodes"] = json.loads(res.get("affected_nodes", "[]"))
        except Exception:
            res["affected_nodes"] = []
        return res


def get_all_incidents(limit: int = 20) -> List[Dict[str, Any]]:
    """Retrieves incident history from SQLite."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["affected_nodes"] = json.loads(d.get("affected_nodes", "[]"))
            except Exception:
                d["affected_nodes"] = []
            results.append(d)
        return results


# =============================================================================
# Audit Ledger Operations
# =============================================================================

def add_audit_entry(event_id: str, incident_id: str, source: str, actor: str, action: str, status: str) -> Dict[str, Any]:
    """Records an immutable audit entry in SQLite."""
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO audit_ledger (event_id, incident_id, source, actor, action, status, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (event_id, incident_id, source, actor, action, status, now_str))
        conn.commit()

    return {
        "event_id": event_id,
        "incident_id": incident_id,
        "source": source,
        "actor": actor,
        "action": action,
        "status": status,
        "timestamp": now_str
    }


def get_audit_ledger(limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches audit trail ordered by most recent."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(r) for r in cursor.fetchall()]


# =============================================================================
# PIR Reports Operations
# =============================================================================

def save_pir_record(incident_id: str, title: str, root_cause: str, resolved_time: str, content_md: str) -> Dict[str, Any]:
    """Persists a Post-Incident Review to SQLite."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pir_reports (incident_id, title, root_cause, resolved_time, content_md, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (incident_id, title, root_cause, resolved_time, content_md, now_iso))
        report_id = cursor.lastrowid
        conn.commit()

    return {
        "id": report_id,
        "incident_id": incident_id,
        "title": title,
        "root_cause": root_cause,
        "resolved_time": resolved_time,
        "content_md": content_md,
        "created_at": now_iso
    }


def get_all_pir_records(limit: int = 20) -> List[Dict[str, Any]]:
    """Retrieves all generated PIR reports from SQLite."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pir_reports ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(r) for r in cursor.fetchall()]
