import os
import random
import time
import datetime
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import numpy as np
from sklearn.ensemble import IsolationForest

load_dotenv()

app = FastAPI(title="Lithium Autonomous Operations Intelligence Desk")

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


SYSTEM_STATE = {
    "kill_switch_active": False,
    "automation_mode": "HYBRID",
    "audit_ledger": [],
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

ml_detector = IsolationForest(contamination=0.1, random_state=42)
baseline_data = np.array([
    [30.0, 45.0, 20.0, 0.01],
    [35.0, 48.0, 25.0, 0.02],
    [28.0, 42.0, 18.0, 0.01],
    [40.0, 50.0, 30.0, 0.03],
    [32.0, 46.0, 22.0, 0.01],
])
ml_detector.fit(baseline_data)


def predict_ml_anomaly(cpu: float, mem: float, latency: float, error_rate: float) -> dict:
    features = np.array([[cpu, mem, latency, error_rate]])
    prediction = ml_detector.predict(features)[0]
    anomaly_score = float(ml_detector.decision_function(features)[0])
    return {
        "is_anomaly": bool(prediction == -1),
        "anomaly_score": round(anomaly_score, 4),
        "confidence": round(min(1.0, max(0.5, abs(anomaly_score) + 0.5)), 2),
    }


class KPIMetrics(BaseModel):
    system_health_pct: int
    critical_count: int
    high_count: int
    avg_resolution: str


class IncidentItem(BaseModel):
    id: str
    severity: str
    incident_number: str
    title: str
    risk_score: int
    probable_root_cause: str
    confidence: float
    dependency_chain: List[str]


class ActionPayload(BaseModel):
    incident_id: str
    action_name: str
    risk_level: str
    target_resource: str
    executed_by: str


class ModeTogglePayload(BaseModel):
    kill_switch_active: bool


class ChaosInjectPayload(BaseModel):
    fault_type: str
    target_service: Optional[str] = "api-gateway"


class PIRRequest(BaseModel):
    incident_id: str
    title: str
    root_cause: str
    resolved_time: str
    actions_taken: List[str]


class PIRResponse(BaseModel):
    incident_id: str
    markdown: str


def apply_remediation_effects(action_name: str, operator: str, risk_level: str, incident_id: str):
    dt = SYSTEM_STATE["digital_twin"]
    faults = list(dt["active_simulated_faults"])

    dt["active_simulated_faults"].clear()
    dt["cpu_utilization_pct"] = random.uniform(30.0, 38.0)
    dt["network_latency_ms"] = random.uniform(20.0, 28.0)
    dt["memory_usage_pct"] = random.uniform(40.0, 50.0)
    dt["error_rate_pct"] = 0.01
    dt["status"] = "HEALTHY"

    for n in SYSTEM_STATE["nodes"]:
        n["status"] = "healthy"

    audit_entry = {
        "event_id": f"AUDIT-{random.randint(10000, 99999)}",
        "incident_id": incident_id,
        "action": action_name,
        "risk_level": risk_level,
        "target": "Payment Gateway Pool",
        "operator": operator,
        "status": "VERIFIED_SUCCESSFUL",
        "verified_recovery": True,
    }
    SYSTEM_STATE["audit_ledger"].append(audit_entry)

    auto_report = f"""===================================================================
POST-INCIDENT REVIEW (PIR) - AUTOMATED GENERATION
===================================================================
Incident ID:     {incident_id}
Executed By:     {operator}
Risk Level:      {risk_level}
Action Executed: {action_name}
Fault Cleared:   {', '.join(faults) if faults else 'General Telemetry Anomaly'}
Timestamp:       {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

1. SYSTEM STATUS
-------------------------------------------------------------------
Status: FULLY RECOVERED
Health Check: Passed
===================================================================
"""
    save_post_mortem_to_file(incident_id, auto_report)
    return audit_entry


def update_digital_twin_telemetry():
    dt = SYSTEM_STATE["digital_twin"]
    faults = dt["active_simulated_faults"]

    cpu_noise = random.uniform(-1.5, 1.5)
    mem_noise = random.uniform(-0.5, 0.5)
    lat_noise = random.uniform(-2.0, 2.0)

    if "CPU_SPIKE" in faults or "DB_LOCK" in faults:
        dt["cpu_utilization_pct"] = min(98.5, max(85.0, dt["cpu_utilization_pct"] + cpu_noise))
        dt["error_rate_pct"] = random.uniform(4.5, 8.2)
    else:
        dt["cpu_utilization_pct"] = min(65.0, max(20.0, dt["cpu_utilization_pct"] + cpu_noise))

    if "LATENCY_SURGE" in faults or "DDOS_SURGE" in faults:
        dt["network_latency_ms"] = min(450.0, max(280.0, dt["network_latency_ms"] + lat_noise))
        dt["error_rate_pct"] = random.uniform(2.1, 5.0)
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


@app.get("/api/v1/nodes")
def get_nodes():
    return SYSTEM_STATE["nodes"]


@app.get("/api/v1/telemetry/stream")
async def telemetry_stream():
    async def event_generator():
        while True:
            update_digital_twin_telemetry()
            dt = SYSTEM_STATE["digital_twin"]
            data = f"data: {{\"cpu\": {dt['cpu_utilization_pct']:.1f}, \"mem\": {dt['memory_usage_pct']:.1f}, \"latency\": {dt['network_latency_ms']:.1f}, \"status\": \"{dt['status']}\"}}\n\n"
            yield data
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/dashboard")
def get_dashboard_data():
    update_digital_twin_telemetry()
    dt = SYSTEM_STATE["digital_twin"]
    health_score = 100 - int((dt["cpu_utilization_pct"] * 0.3) + (dt["error_rate_pct"] * 5))

    return {
        "system_status": {
            "kill_switch_active": SYSTEM_STATE["kill_switch_active"],
            "automation_mode": "MANUAL_OVERRIDE" if SYSTEM_STATE["kill_switch_active"] else SYSTEM_STATE["automation_mode"],
        },
        "kpis": KPIMetrics(
            system_health_pct=max(10, min(100, health_score)),
            critical_count=1 if dt["status"] == "CRITICAL" else 0,
            high_count=1 if dt["status"] == "DEGRADED" else 0,
            avg_resolution="1m 12s",
        ),
        "active_incidents": [] if dt["status"] == "HEALTHY" else [
            IncidentItem(
                id="inc-1042",
                severity=dt["status"],
                incident_number="#1042",
                title="Telemetry Anomaly Detected" if dt["status"] == "DEGRADED" else "Critical System Degradation",
                risk_score=96 if dt["status"] == "CRITICAL" else 55,
                probable_root_cause=f"Simulated Fault: {', '.join(dt['active_simulated_faults'])}",
                confidence=0.91,
                dependency_chain=["Payment DB", "Payment Service", "Order Service"],
            )
        ]
    }


@app.get("/api/digital-twin/telemetry")
def get_digital_twin_telemetry():
    update_digital_twin_telemetry()
    dt = SYSTEM_STATE["digital_twin"]
    ml_results = predict_ml_anomaly(dt["cpu_utilization_pct"], dt["memory_usage_pct"], dt["network_latency_ms"], dt["error_rate_pct"])
    return {**dt, "ml_analytics": ml_results}


@app.post("/api/digital-twin/chaos/inject")
def inject_chaos_fault(payload: ChaosInjectPayload):
    if payload.fault_type not in SYSTEM_STATE["digital_twin"]["active_simulated_faults"]:
        SYSTEM_STATE["digital_twin"]["active_simulated_faults"].append(payload.fault_type)

    root_map = {"DB_LOCK": "db", "MEMORY_LEAK": "auth", "DDOS_SURGE": "gateway"}
    root_id = root_map.get(payload.fault_type, "gateway")

    for n in SYSTEM_STATE["nodes"]:
        if n["id"] == root_id:
            n["status"] = "root"
        else:
            n["status"] = "impacted" if n["id"] in ["payments", "auth"] else "healthy"

    update_digital_twin_telemetry()
    return {
        "success": True,
        "message": f"Fault '{payload.fault_type}' injected into {payload.target_service}.",
        "digital_twin_state": SYSTEM_STATE["digital_twin"],
    }


@app.post("/api/system/kill-switch")
def toggle_kill_switch(payload: ModeTogglePayload):
    SYSTEM_STATE["kill_switch_active"] = payload.kill_switch_active
    status_msg = "MANUAL OVERRIDE ACTIVATED" if payload.kill_switch_active else "AUTONOMOUS MODE RESUMED"
    return {"success": True, "kill_switch_active": SYSTEM_STATE["kill_switch_active"], "message": status_msg}


@app.post("/api/remediation/execute")
def execute_remediation_action(payload: ActionPayload):
    if SYSTEM_STATE["kill_switch_active"] and payload.executed_by == "AI_AUTONOMOUS":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action rejected. System in Manual Override mode.")

    audit_entry = apply_remediation_effects(
        action_name=payload.action_name,
        operator=payload.executed_by,
        risk_level=payload.risk_level,
        incident_id=payload.incident_id,
    )
    return {"success": True, "message": f"Action '{payload.action_name}' executed.", "audit_record": audit_entry}


@app.get("/api/audit-ledger")
def get_audit_ledger():
    return {"total_events": len(SYSTEM_STATE["audit_ledger"]), "ledger": SYSTEM_STATE["audit_ledger"]}


@app.post("/api/postmortem/generate", response_model=PIRResponse, status_code=status.HTTP_200_OK)
def generate_postmortem(payload: PIRRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    report_content = ""

    if api_key and api_key != "your_google_ai_studio_api_key_here":
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"Senior SRE PIR report for Incident: {payload.incident_id}, Root Cause: {payload.root_cause}"
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            report_content = response.text
        except Exception as err:
            print(f"[WARN] Gemini API call failed: {err}")

    if not report_content:
        report_content = f"PIR REPORT FOR {payload.incident_id}\nRoot Cause: {payload.root_cause}\nResolved: {payload.resolved_time}"

    save_post_mortem_to_file(payload.incident_id, report_content)
    return PIRResponse(incident_id=payload.incident_id, markdown=report_content)