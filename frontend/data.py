"""
Lithium — Autonomous Operations Intelligence Desk
Server Telemetry & Outage Data Model (Phase 1: SQLite)
"""

# Current Server Telemetry State
CURRENT_SERVER_STATE = {
    "cluster_status": "NOMINAL",            # NOMINAL | CRITICAL | RECOVERING
    "health_score": 99.8,                   # System health percentage (0.0 - 100.0)
    "risk_rate": 4,                         # Calculated Risk Rate (1 - 100)
    "p99_latency_ms": 32,                   # API P99 latency in milliseconds
    "active_services": 5,                   # Online services count
    "total_services": 5,
    "storage_engine": "SQLite 3 (WAL mode)" # Current local DB (PostgreSQL planned in Phase 2)
}

# Topology Nodes & Health Status
TOPOLOGY_NODES = {
    "clients": {"name": "Clients", "status": "healthy", "type": "traffic_source"},
    "gateway": {"name": "API Gateway (Envoy)", "status": "healthy", "type": "proxy"},
    "auth": {"name": "Auth Service (Go)", "status": "healthy", "type": "microservice"},
    "payments": {"name": "Payment Service (FastAPI)", "status": "healthy", "type": "microservice"},
    "db": {"name": "SQLite Database (WAL)", "status": "healthy", "type": "database"}
}

# Active Incident Schema (Dynamic injection via Web Dashboard [Input Server Data] modal)
ACTIVE_INCIDENT = {
    "incident_id": "INC-8492",
    "failing_component": "db",               # Target: 'db', 'auth', 'gateway', 'payments'
    "severity": "P1 CRITICAL",              # P1 CRITICAL | P2 HIGH | P3 MEDIUM
    "risk_rate": 94,                        # 1 to 100 Risk Score
    "risk_level_tag": "EXTREME",
    "latency_ms": 1420,
    "title": "SQLite Database Transaction Lock",
    "root_cause": (
        "Commit #8f3a in Auth Service introduced an unclosed database transaction lock, "
        "causing SQLite busy timeout (> 5000ms)."
    ),
    "recommended_fix": "Rollback commit #8f3a & clear SQLite WAL journal lock",
    "blast_radius": ["db", "auth", "payments"],
    "autonomy_resolution": {
        "hybrid_mode": "Requires human operator approval (Mantavya)",
        "autonomous_mode": "Auto-executes remediation in 2.0s zero-touch"
    }
}

# Pre-defined Simulation Scenarios
PRESET_SCENARIOS = {
    "DB_LOCK": {
        "title": "SQLite Database Transaction Lock",
        "epicenter": "db",
        "risk_rate": 94,
        "latency_ms": 1420,
        "remediation": "Rollback commit #8f3a & clear SQLite WAL journal lock"
    },
    "MEMORY_LEAK": {
        "title": "Auth Pod Memory Leak (OOM Kill)",
        "epicenter": "auth",
        "risk_rate": 78,
        "latency_ms": 840,
        "remediation": "Restart Auth pods & scale deployment replicas to 4"
    },
    "TRAFFIC_SPIKE": {
        "title": "API Gateway Volumetric Traffic Surge",
        "epicenter": "gateway",
        "risk_rate": 91,
        "latency_ms": 1650,
        "remediation": "Apply WAF IP block rule & enable adaptive rate limiting"
    }
}
