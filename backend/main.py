import os
import random
import time
import datetime
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

try:
    from backend import db
except ImportError:
    import db

load_dotenv()

app = FastAPI(title="Lithium Autonomous Operations Intelligence Desk")

# Enable CORS for all origins (frontend on port 3000, 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

POST_MORTEM_DIR = os.path.join(os.path.dirname(__file__), "post-mortem-reports")
os.makedirs(POST_MORTEM_DIR, exist_ok=True)


def save_post_mortem_to_file(incident_id: str, content: str) -> str:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"PIR_{incident_id}_{timestamp}.txt"
    filepath = os.path.join(POST_MORTEM_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


# In-Memory Real-Time Runtime State (synced with SQLite)
SYSTEM_STATE = {
    "kill_switch_active": False,
    "automation_mode": "COPILOT",  # 'COPILOT' (Hybrid) or 'AUTONOMOUS' (Full)
    "digital_twin": {
        "status": "HEALTHY",
        "cpu_utilization_pct": 34.2,
        "memory_usage_pct": 48.1,
        "network_latency_ms": 24.5,
        "error_rate_pct": 0.02,
        "active_simulated_faults": [],
        "last_updated": time.time(),
    },
    "nodes": [
        {"id": "clients", "label": "Clients", "x": 0.12, "y": 0.5, "status": "healthy"},
        {"id": "gateway", "label": "API Gateway", "x": 0.32, "y": 0.5, "status": "healthy"},
        {"id": "auth", "label": "Auth Service", "x": 0.56, "y": 0.3, "status": "healthy"},
        {"id": "payments", "label": "Payments", "x": 0.56, "y": 0.7, "status": "healthy"},
        {"id": "db", "label": "SQLite DB", "x": 0.84, "y": 0.5, "status": "healthy"}
    ]
}

# Machine Learning Anomaly Detector (IsolationForest with Heuristic Fallback)
SKLEARN_AVAILABLE = False
try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
    ml_detector = IsolationForest(contamination=0.1, random_state=42)
    baseline_data = np.array([
        [30.0, 45.0, 20.0, 0.01],
        [35.0, 48.0, 25.0, 0.02],
        [28.0, 42.0, 18.0, 0.01],
        [40.0, 50.0, 30.0, 0.03],
        [32.0, 46.0, 22.0, 0.01],
    ])
    ml_detector.fit(baseline_data)
    SKLEARN_AVAILABLE = True
except Exception as e:
    print(f"[INFO] ML IsolationForest initialized with heuristic fallback: {e}")


def predict_ml_anomaly(cpu: float, mem: float, latency: float, error_rate: float) -> dict:
    if SKLEARN_AVAILABLE:
        try:
            import numpy as np
            features = np.array([[cpu, mem, latency, error_rate]])
            prediction = ml_detector.predict(features)[0]
            anomaly_score = float(ml_detector.decision_function(features)[0])
            return {
                "is_anomaly": bool(prediction == -1),
                "anomaly_score": round(anomaly_score, 4),
                "confidence": round(min(1.0, max(0.5, abs(anomaly_score) + 0.5)), 2),
            }
        except Exception:
            pass

    # Resilient heuristic anomaly prediction
    is_anomaly = cpu > 80.0 or latency > 250.0 or mem > 88.0 or error_rate > 2.0
    score = -0.42 if is_anomaly else 0.48
    return {
        "is_anomaly": is_anomaly,
        "anomaly_score": score,
        "confidence": 0.94 if is_anomaly else 0.88,
    }


# Preset Outage Catalogs
PRESET_OUTAGES = {
    "DB_LOCK": {
        "id": "INC-8492",
        "title": "Database Connection Pool Exhaustion",
        "severity": "P1 CRITICAL",
        "risk_rate": 94,
        "risk_level_tag": "EXTREME",
        "epicenter": "SQLite Database (WAL)",
        "diagnosis": "Commit #8f3a in Auth Service introduced an unclosed database transaction lock, saturating the connection pool limit (100/100).",
        "recommended_action": "Rollback commit #8f3a & flush DB connection pool",
        "root_node": "db",
        "affected_nodes": ["db", "auth", "payments"],
        "health_score": 44.5,
        "latency_ms": 1420
    },
    "MEMORY_LEAK": {
        "id": "INC-3921",
        "title": "Auth Pod Memory Leak (OOM Kill)",
        "severity": "P2 HIGH",
        "risk_rate": 78,
        "risk_level_tag": "HIGH RISK",
        "epicenter": "Auth Service",
        "diagnosis": "Token validation buffer leak exceeded container cgroup memory limits, triggering automatic pod evictions.",
        "recommended_action": "Restart Auth pods & scale deployment replicas to 4",
        "root_node": "auth",
        "affected_nodes": ["auth", "gateway"],
        "health_score": 58.2,
        "latency_ms": 840
    },
    "DDOS_SURGE": {
        "id": "INC-7104",
        "title": "API Gateway Volumetric Traffic Surge",
        "severity": "P1 CRITICAL",
        "risk_rate": 91,
        "risk_level_tag": "CRITICAL",
        "epicenter": "API Gateway",
        "diagnosis": "Rate limit ceiling breached by 45,000 req/sec credential stuffing attack originating from suspicious IP cluster.",
        "recommended_action": "Apply WAF IP block rule & enable adaptive rate limiting",
        "root_node": "gateway",
        "affected_nodes": ["gateway", "auth"],
        "health_score": 65.0,
        "latency_ms": 1650
    }
}


# =============================================================================
# Pydantic Schemas
# =============================================================================

class KPIMetrics(BaseModel):
    system_health_pct: float
    critical_count: int
    high_count: int
    avg_resolution: str
    active_services: int
    total_services: int


class ChaosInjectPayload(BaseModel):
    fault_type: str
    target_service: Optional[str] = "api-gateway"
    # Custom fields injected from [Input Server Data] modal
    incident_id: Optional[str] = None
    title: Optional[str] = None
    severity: Optional[str] = None
    risk_rate: Optional[int] = None
    risk_level_tag: Optional[str] = None
    epicenter: Optional[str] = None
    diagnosis: Optional[str] = None
    recommended_action: Optional[str] = None
    root_node: Optional[str] = None
    affected_nodes: Optional[List[str]] = None
    latency_ms: Optional[int] = None
    health_score: Optional[float] = None


class ActionPayload(BaseModel):
    incident_id: str
    action_name: str
    risk_level: Optional[str] = "MEDIUM"
    target_resource: Optional[str] = "Cluster"
    executed_by: str  # 'AUTONOMOUS' or 'HYBRID' / operator name
    duration_sec: Optional[int] = 0


class ModeTogglePayload(BaseModel):
    kill_switch_active: bool


class AutonomyModePayload(BaseModel):
    mode: str  # 'COPILOT' or 'AUTONOMOUS'


class PIRRequest(BaseModel):
    incident_id: str
    title: str
    root_cause: str
    resolved_time: str
    actions_taken: List[str]


class PIRResponse(BaseModel):
    incident_id: str
    markdown: str


# =============================================================================
# Startup Hook
# =============================================================================

@app.on_event("startup")
def on_startup():
    db.init_db()
    print("[INIT] Lithium SQLite Database initialized with WAL mode.")


# =============================================================================
# Telemetry Engine
# =============================================================================

def update_digital_twin_telemetry():
    dt = SYSTEM_STATE["digital_twin"]
    faults = dt["active_simulated_faults"]

    cpu_noise = random.uniform(-1.5, 1.5)
    mem_noise = random.uniform(-0.5, 0.5)
    lat_noise = random.uniform(-2.0, 2.0)

    if "CPU_SPIKE" in faults or "DB_LOCK" in faults:
        dt["cpu_utilization_pct"] = min(98.5, max(85.0, dt["cpu_utilization_pct"] + cpu_noise))
        dt["error_rate_pct"] = round(random.uniform(4.5, 8.2), 2)
    else:
        dt["cpu_utilization_pct"] = min(65.0, max(20.0, dt["cpu_utilization_pct"] + cpu_noise))

    if "LATENCY_SURGE" in faults or "DDOS_SURGE" in faults:
        dt["network_latency_ms"] = min(450.0, max(280.0, dt["network_latency_ms"] + lat_noise))
        dt["error_rate_pct"] = round(random.uniform(2.1, 5.0), 2)
    else:
        dt["network_latency_ms"] = min(80.0, max(15.0, dt["network_latency_ms"] + lat_noise))

    if "MEMORY_LEAK" in faults:
        dt["memory_usage_pct"] = min(95.0, dt["memory_usage_pct"] + random.uniform(0.5, 2.0))
    else:
        dt["memory_usage_pct"] = min(60.0, max(40.0, dt["memory_usage_pct"] + mem_noise))

    if dt["cpu_utilization_pct"] > 85 or dt["network_latency_ms"] > 250 or dt["memory_usage_pct"] > 90:
        dt["status"] = "CRITICAL"
    elif dt["cpu_utilization_pct"] > 70 or dt["network_latency_ms"] > 150:
        dt["status"] = "DEGRADED"
    else:
        dt["status"] = "HEALTHY"
        dt["error_rate_pct"] = round(random.uniform(0.01, 0.05), 3)

    dt["last_updated"] = time.time()


# =============================================================================
# REST Endpoints
# =============================================================================

@app.get("/")
def get_root():
    return {
        "status": "ONLINE",
        "system": "Lithium Autonomous Operations Platform",
        "storage": "SQLite 3 (WAL mode)",
        "docs": "/docs"
    }


@app.get("/api/health")
def get_health_status():
    return {
        "status": "OK",
        "cluster_status": SYSTEM_STATE["digital_twin"]["status"],
        "autonomy_mode": SYSTEM_STATE["automation_mode"],
        "kill_switch": SYSTEM_STATE["kill_switch_active"]
    }


@app.get("/api/v1/nodes")
def get_nodes():
    return SYSTEM_STATE["nodes"]


@app.get("/api/v1/telemetry/stream")
async def telemetry_stream():
    """SSE endpoint streaming live telemetry to the browser every 1.5s."""
    async def event_generator():
        while True:
            update_digital_twin_telemetry()
            dt = SYSTEM_STATE["digital_twin"]
            active_inc = db.get_active_incident()
            payload = {
                "cpu": round(dt["cpu_utilization_pct"], 1),
                "mem": round(dt["memory_usage_pct"], 1),
                "latency": round(dt["network_latency_ms"], 1),
                "error_rate": dt["error_rate_pct"],
                "status": dt["status"],
                "has_active_incident": active_inc is not None,
                "autonomy_mode": SYSTEM_STATE["automation_mode"]
            }
            import json
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(1.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/dashboard")
def get_dashboard_data():
    """Returns real-time dashboard state, synced with SQLite active incidents."""
    update_digital_twin_telemetry()
    dt = SYSTEM_STATE["digital_twin"]
    active_inc = db.get_active_incident()

    health_score = 99.8
    if active_inc:
        health_score = float(active_inc.get("health_score", 45.0))
        critical_count = 1 if active_inc.get("severity") == "P1 CRITICAL" else 0
        high_count = 1 if active_inc.get("severity") != "P1 CRITICAL" else 0
        active_services = 5 - max(1, len(active_inc.get("affected_nodes", [])) - 1)
    else:
        critical_count = 0
        high_count = 0
        active_services = 5

    return {
        "system_status": {
            "kill_switch_active": SYSTEM_STATE["kill_switch_active"],
            "automation_mode": SYSTEM_STATE["automation_mode"],
            "cluster_health": dt["status"]
        },
        "kpis": KPIMetrics(
            system_health_pct=round(health_score, 1),
            critical_count=critical_count,
            high_count=high_count,
            avg_resolution="16.2s",
            active_services=active_services,
            total_services=5
        ),
        "active_incidents": [active_inc] if active_inc else [],
        "nodes": SYSTEM_STATE["nodes"]
    }


@app.get("/api/digital-twin/telemetry")
def get_digital_twin_telemetry():
    update_digital_twin_telemetry()
    dt = SYSTEM_STATE["digital_twin"]
    ml_results = predict_ml_anomaly(
        dt["cpu_utilization_pct"],
        dt["memory_usage_pct"],
        dt["network_latency_ms"],
        dt["error_rate_pct"]
    )
    return {**dt, "ml_analytics": ml_results}


@app.post("/api/digital-twin/chaos/inject")
def inject_chaos_fault(payload: ChaosInjectPayload):
    """
    Injects an outage scenario into the digital twin & writes a durable row to SQLite.
    Supports both preset scenarios and custom modal inputs.
    """
    fault_type = payload.fault_type
    target_preset = PRESET_OUTAGES.get(fault_type, {})

    # Construct the incident record
    inc_id = payload.incident_id or target_preset.get("id") or f"INC-{random.randint(1000, 9999)}"
    title = payload.title or target_preset.get("title") or f"{fault_type} Telemetry Anomaly"
    severity = payload.severity or target_preset.get("severity") or "P1 CRITICAL"
    risk_rate = payload.risk_rate if payload.risk_rate is not None else target_preset.get("risk_rate", 90)
    risk_level_tag = payload.risk_level_tag or target_preset.get("risk_level_tag") or "EXTREME"
    epicenter = payload.epicenter or target_preset.get("epicenter") or "API Gateway"
    diagnosis = payload.diagnosis or target_preset.get("diagnosis") or "Dynamic telemetry threshold exceeded"
    recommended_action = payload.recommended_action or target_preset.get("recommended_action") or "Restart affected microservice"
    root_node = payload.root_node or target_preset.get("root_node") or "gateway"
    affected_nodes = payload.affected_nodes or target_preset.get("affected_nodes") or [root_node]
    latency_ms = payload.latency_ms if payload.latency_ms is not None else target_preset.get("latency_ms", 1200)
    health_score = payload.health_score if payload.health_score is not None else target_preset.get("health_score", 45.0)

    incident_data = {
        "id": inc_id,
        "incident_number": f"#{inc_id}",
        "title": title,
        "severity": severity,
        "risk_rate": risk_rate,
        "risk_level_tag": risk_level_tag,
        "epicenter": epicenter,
        "diagnosis": diagnosis,
        "recommended_action": recommended_action,
        "root_node": root_node,
        "affected_nodes": affected_nodes,
        "latency_ms": latency_ms,
        "health_score": health_score
    }

    # 1. Persist to SQLite
    saved_incident = db.create_or_update_incident(incident_data)

    # 2. Record in Immutable SQLite Audit Ledger
    audit_entry = db.add_audit_entry(
        event_id=f"AUDIT-{random.randint(10000, 99999)}",
        incident_id=inc_id,
        source="CHAOS_INJECTOR",
        actor="Operator (Lithium Desk)",
        action=f"Triggered {title} on {epicenter} (Risk: {risk_rate}/100)",
        status="FLAGGED"
    )

    # 3. Update Digital Twin runtime state & nodes
    dt = SYSTEM_STATE["digital_twin"]
    if fault_type not in dt["active_simulated_faults"]:
        dt["active_simulated_faults"].append(fault_type)

    dt["status"] = "CRITICAL" if risk_rate >= 80 else "DEGRADED"
    dt["network_latency_ms"] = float(latency_ms)
    dt["cpu_utilization_pct"] = random.uniform(88.0, 96.0) if risk_rate >= 80 else random.uniform(70.0, 82.0)
    dt["memory_usage_pct"] = random.uniform(82.0, 94.0)

    for n in SYSTEM_STATE["nodes"]:
        if n["id"] == root_node:
            n["status"] = "root"
        elif n["id"] in affected_nodes:
            n["status"] = "impacted"
        else:
            n["status"] = "healthy"

    return {
        "success": True,
        "message": f"Fault '{title}' successfully injected into {epicenter} & recorded in SQLite.",
        "incident": saved_incident,
        "audit_entry": audit_entry,
        "digital_twin": dt
    }


@app.post("/api/remediation/execute")
def execute_remediation(payload: ActionPayload):
    """
    Executes a remediation action (Human Hybrid or Full Autonomous), marks the incident as
    RESOLVED in SQLite, writes a resolution record to SQLite audit ledger, and generates a PIR report.
    """
    if SYSTEM_STATE["kill_switch_active"] and payload.executed_by == "AUTONOMOUS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action rejected by safety protocol. System in Manual Override mode."
        )

    # 1. Update SQLite Incident to RESOLVED
    resolved_incident = db.resolve_incident(
        incident_id=payload.incident_id,
        resolved_by=payload.executed_by,
        duration_sec=payload.duration_sec or 0
    )

    # 2. Add Resolution Entry to SQLite Audit Ledger
    operator_label = "Full Autonomous (AI)" if payload.executed_by == "AUTONOMOUS" else "Hybrid Autonomous (Mantavya)"
    audit_entry = db.add_audit_entry(
        event_id=f"AUDIT-{random.randint(10000, 99999)}",
        incident_id=payload.incident_id,
        source="REMEDIATION",
        actor=operator_label,
        action=f"Executed: {payload.action_name}",
        status="RESOLVED"
    )

    # 3. Restore Digital Twin & Nodes to Healthy Baseline
    dt = SYSTEM_STATE["digital_twin"]
    faults = list(dt["active_simulated_faults"])
    dt["active_simulated_faults"].clear()
    dt["cpu_utilization_pct"] = round(random.uniform(30.0, 36.0), 1)
    dt["network_latency_ms"] = round(random.uniform(22.0, 28.0), 1)
    dt["memory_usage_pct"] = round(random.uniform(42.0, 48.0), 1)
    dt["error_rate_pct"] = 0.01
    dt["status"] = "HEALTHY"

    for n in SYSTEM_STATE["nodes"]:
        n["status"] = "healthy"

    # 4. Generate Structured PIR Report & save to SQLite and file
    pir_text = f"""===================================================================
POST-INCIDENT REVIEW (PIR) — LITHIUM AUTONOMOUS OPERATIONS
===================================================================
Incident ID:       {payload.incident_id}
Resolved At:       {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
Resolution Actor:  {operator_label}
Remediation Fix:   {payload.action_name}
Duration:          {payload.duration_sec}s
Cleared Faults:    {', '.join(faults) if faults else 'General Telemetry Anomaly'}

1. EXECUTIVE SUMMARY
-------------------------------------------------------------------
An operational anomaly was identified and neutralized within SLA.
Cluster metrics have returned to nominal operating baselines.

2. ROOT CAUSE ANALYSIS & BLAST RADIUS
-------------------------------------------------------------------
Culprit:           {payload.target_resource}
Resolution Path:   {payload.action_name}
Downtime Avoided:  100% (Sub-minute automated remediation)

3. SYSTEM HEALTH CHECK
-------------------------------------------------------------------
P99 Latency:       {dt['network_latency_ms']} ms [NOMINAL]
Cluster Status:    {dt['status']} (All 5/5 Microservices Online)
Database:          SQLite 3 (WAL mode verified healthy)
===================================================================
"""
    save_post_mortem_to_file(payload.incident_id, pir_text)
    db.save_pir_record(
        incident_id=payload.incident_id,
        title=f"Incident {payload.incident_id} Remediation",
        root_cause=f"Simulated fault on {payload.target_resource}",
        resolved_time=f"{payload.duration_sec}s",
        content_md=pir_text
    )

    return {
        "success": True,
        "message": f"Remediation '{payload.action_name}' executed. System restored to HEALTHY.",
        "incident": resolved_incident,
        "audit_entry": audit_entry,
        "digital_twin": dt
    }


@app.post("/api/system/mode")
def set_autonomy_mode(payload: AutonomyModePayload):
    """Switches system autonomy mode ('COPILOT' or 'AUTONOMOUS')."""
    if payload.mode not in ["COPILOT", "AUTONOMOUS"]:
        raise HTTPException(status_code=400, detail="Mode must be 'COPILOT' or 'AUTONOMOUS'.")
    SYSTEM_STATE["automation_mode"] = payload.mode
    db.add_audit_entry(
        event_id=f"AUDIT-{random.randint(10000, 99999)}",
        incident_id="SYS-MODE",
        source="SYSTEM",
        actor="Operator",
        action=f"Switched autonomy mode to [{payload.mode}]",
        status="CONFIGURED"
    )
    return {"success": True, "mode": SYSTEM_STATE["automation_mode"]}


@app.post("/api/system/kill-switch")
def toggle_kill_switch(payload: ModeTogglePayload):
    """Toggles human safety kill switch."""
    SYSTEM_STATE["kill_switch_active"] = payload.kill_switch_active
    status_msg = "MANUAL OVERRIDE ACTIVATED" if payload.kill_switch_active else "AUTONOMOUS MODE RESUMED"
    db.add_audit_entry(
        event_id=f"AUDIT-{random.randint(10000, 99999)}",
        incident_id="SYS-KILL",
        source="SECURITY",
        actor="Safety Interlock",
        action=status_msg,
        status="WARNING" if payload.kill_switch_active else "NOMINAL"
    )
    return {"success": True, "kill_switch_active": SYSTEM_STATE["kill_switch_active"], "message": status_msg}


@app.get("/api/audit-ledger")
def get_audit_ledger():
    """Returns persistent audit entries from SQLite."""
    ledger = db.get_audit_ledger(limit=50)
    return {"total_events": len(ledger), "ledger": ledger}


@app.get("/api/incidents")
def get_incidents():
    """Returns past incidents from SQLite."""
    incidents = db.get_all_incidents(limit=20)
    return {"total_incidents": len(incidents), "incidents": incidents}


@app.post("/api/postmortem/generate", response_model=PIRResponse, status_code=status.HTTP_200_OK)
def generate_postmortem(payload: PIRRequest):
    """Generates PIR report using Gemini AI (if available) with structured fallback."""
    api_key = os.getenv("GEMINI_API_KEY")
    report_content = ""

    if api_key and api_key != "your_google_ai_studio_api_key_here":
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = (
                f"Generate a senior SRE Post-Incident Review (PIR) in clean Markdown for:\n"
                f"Incident ID: {payload.incident_id}\n"
                f"Title: {payload.title}\n"
                f"Root Cause: {payload.root_cause}\n"
                f"Resolution Time: {payload.resolved_time}\n"
                f"Actions Taken: {', '.join(payload.actions_taken)}"
            )
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            report_content = response.text
        except Exception as err:
            print(f"[WARN] Gemini API call failed: {err}")

    if not report_content:
        report_content = f"""# Post-Incident Review (PIR) — {payload.incident_id}

**Title:** {payload.title}  
**Status:** RESOLVED  
**Resolution MTTR:** {payload.resolved_time}  
**Storage Architecture:** SQLite 3 (WAL Journal Mode)

---

### 1. Root Cause Summary
{payload.root_cause}

### 2. Actions Executed
{chr(10).join([f"- {a}" for a in payload.actions_taken])}

### 3. Prevention & Follow-up Actions
- Validate transaction cleanup in database client connection pools.
- Deploy automated rate limiting and predictive telemetry guards.
- Retain audit ledger proof in persistent SQLite WAL store.
"""

    save_post_mortem_to_file(payload.incident_id, report_content)
    db.save_pir_record(
        incident_id=payload.incident_id,
        title=payload.title,
        root_cause=payload.root_cause,
        resolved_time=payload.resolved_time,
        content_md=report_content
    )
    return PIRResponse(incident_id=payload.incident_id, markdown=report_content)


@app.get("/api/postmortem/reports")
def get_postmortem_reports():
    """Returns saved PIR reports from SQLite."""
    reports = db.get_all_pir_records(limit=20)
    return {"total_reports": len(reports), "reports": reports}