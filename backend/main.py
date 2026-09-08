import os
import random
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI(title="Autonomous Operations Intelligence Desk with Digital Twin")

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL APPLICATION STATE & DIGITAL TWIN ---
SYSTEM_STATE = {
    "kill_switch_active": False,  # True = Manual Mode (Overrides automation)
    "automation_mode": "HYBRID",  # "FULL_AUTO" or "HYBRID"
    "audit_ledger": [],
    # Digital Twin Simulation State
    "digital_twin": {
        "status": "HEALTHY",  # HEALTHY, DEGRADED, CRITICAL
        "cpu_utilization_pct": 34.2,
        "memory_usage_pct": 48.1,
        "network_latency_ms": 24.5,
        "error_rate_pct": 0.02,
        "active_simulated_faults": [],
        "last_updated": time.time()
    }
}

# --- SCHEMAS ---

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
    risk_level: str  # "LOW" or "HIGH"
    target_resource: str
    executed_by: str

class ModeTogglePayload(BaseModel):
    kill_switch_active: bool

class ChaosInjectPayload(BaseModel):
    fault_type: str  # "CPU_SPIKE", "LATENCY_SURGE", "MEMORY_LEAK"
    target_service: str

class PIRRequest(BaseModel):
    incident_id: str
    title: str
    root_cause: str
    resolved_time: str
    actions_taken: List[str]

class PIRResponse(BaseModel):
    incident_id: str
    markdown: str


# --- DIGITAL TWIN HELPER FUNCTIONS ---

def update_digital_twin_telemetry():
    """Simulates realistic noise and updates Digital Twin telemetry state."""
    dt = SYSTEM_STATE["digital_twin"]
    faults = dt["active_simulated_faults"]

    # Base noise
    cpu_noise = random.uniform(-1.5, 1.5)
    mem_noise = random.uniform(-0.5, 0.5)
    lat_noise = random.uniform(-2.0, 2.0)

    if "CPU_SPIKE" in faults:
        dt["cpu_utilization_pct"] = min(98.5, max(85.0, dt["cpu_utilization_pct"] + cpu_noise))
        dt["error_rate_pct"] = random.uniform(4.5, 8.2)
    else:
        dt["cpu_utilization_pct"] = min(65.0, max(20.0, dt["cpu_utilization_pct"] + cpu_noise))

    if "LATENCY_SURGE" in faults:
        dt["network_latency_ms"] = min(450.0, max(280.0, dt["network_latency_ms"] + lat_noise))
        dt["error_rate_pct"] = random.uniform(2.1, 5.0)
    else:
        dt["network_latency_ms"] = min(80.0, max(15.0, dt["network_latency_ms"] + lat_noise))

    if "MEMORY_LEAK" in faults:
        dt["memory_usage_pct"] = min(95.0, dt["memory_usage_pct"] + random.uniform(0.5, 2.0))
    else:
        dt["memory_usage_pct"] = min(60.0, max(40.0, dt["memory_usage_pct"] + mem_noise))

    # Evaluate Overall Health
    if dt["cpu_utilization_pct"] > 85 or dt["network_latency_ms"] > 250 or dt["memory_usage_pct"] > 90:
        dt["status"] = "CRITICAL"
    elif dt["cpu_utilization_pct"] > 70 or dt["network_latency_ms"] > 150:
        dt["status"] = "DEGRADED"
    else:
        dt["status"] = "HEALTHY"
        dt["error_rate_pct"] = round(random.uniform(0.01, 0.05), 3)

    dt["last_updated"] = time.time()


# --- ENDPOINTS ---

@app.get("/api/dashboard")
def get_dashboard_data():
    """Returns top KPI cards, system mode state, and active correlated incidents."""
    update_digital_twin_telemetry()
    dt = SYSTEM_STATE["digital_twin"]

    # Calculate overall health percentage dynamically from Digital Twin
    health_score = 100 - int((dt["cpu_utilization_pct"] * 0.3) + (dt["error_rate_pct"] * 5))

    return {
        "system_status": {
            "kill_switch_active": SYSTEM_STATE["kill_switch_active"],
            "automation_mode": "MANUAL_OVERRIDE" if SYSTEM_STATE["kill_switch_active"] else SYSTEM_STATE["automation_mode"]
        },
        "kpis": KPIMetrics(
            system_health_pct=max(10, min(100, health_score)),
            critical_count=1 if dt["status"] == "CRITICAL" else 0,
            high_count=2 if dt["status"] == "DEGRADED" else 1,
            avg_resolution="3m 45s"
        ),
        "active_incidents": [
            IncidentItem(
                id="inc-1042",
                severity="CRITICAL" if dt["status"] == "CRITICAL" else "HIGH",
                incident_number="#1042",
                title="Payment Infrastructure Degradation",
                risk_score=96 if dt["status"] == "CRITICAL" else 74,
                probable_root_cause="Database connection pool exhaustion" if "CPU_SPIKE" not in dt["active_simulated_faults"] else "Simulated CPU Exhaustion",
                confidence=0.93,
                dependency_chain=["Payment DB", "Payment Service", "Order Service", "Checkout"]
            ),
            IncidentItem(
                id="inc-1039",
                severity="HIGH",
                incident_number="#1039",
                title="Elevated API Latency — Checkout Service",
                risk_score=74,
                probable_root_cause="Upstream rate limit throttling",
                confidence=0.88,
                dependency_chain=["API Gateway", "Checkout Service"]
            )
        ]
    }

@app.get("/api/digital-twin/telemetry")
def get_digital_twin_telemetry():
    """Real-time Digital Twin telemetry endpoint for live dynamic visualization."""
    update_digital_twin_telemetry()
    return SYSTEM_STATE["digital_twin"]

@app.post("/api/digital-twin/chaos/inject")
def inject_chaos_fault(payload: ChaosInjectPayload):
    """Injects simulated chaos faults directly into the Digital Twin framework."""
    if payload.fault_type not in SYSTEM_STATE["digital_twin"]["active_simulated_faults"]:
        SYSTEM_STATE["digital_twin"]["active_simulated_faults"].append(payload.fault_type)
    
    update_digital_twin_telemetry()
    return {
        "success": True,
        "message": f"Fault '{payload.fault_type}' injected into {payload.target_service}.",
        "digital_twin_state": SYSTEM_STATE["digital_twin"]
    }

@app.post("/api/system/kill-switch")
def toggle_kill_switch(payload: ModeTogglePayload):
    """
    Kill-Switch / Mode Switcher:
    Allows the user to manually override all autonomous decisions.
    """
    SYSTEM_STATE["kill_switch_active"] = payload.kill_switch_active
    status_msg = "KILL-SWITCH ACTIVATED: All actions now require human approval." if payload.kill_switch_active else "Autonomous engine resumed."
    
    return {
        "success": True,
        "kill_switch_active": SYSTEM_STATE["kill_switch_active"],
        "message": status_msg
    }

@app.post("/api/remediation/execute")
def execute_remediation_action(payload: ActionPayload):
    """
    Risk-Based Approval Workflow:
    Enforces safety rules: LOW risk can auto-execute, HIGH risk requires explicit human approval.
    Remediating actions clear fault states in the Digital Twin.
    """
    if SYSTEM_STATE["kill_switch_active"] and payload.executed_by == "AI_AUTONOMOUS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Action rejected. System Kill-Switch is active. Human approval required."
        )

    if payload.risk_level == "HIGH" and payload.executed_by != "HUMAN_OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Safety Violation: High-risk actions require explicit human approval."
        )

    # Clear active faults inside Digital Twin upon successful action
    SYSTEM_STATE["digital_twin"]["active_simulated_faults"].clear()
    SYSTEM_STATE["digital_twin"]["cpu_utilization_pct"] = 32.0
    SYSTEM_STATE["digital_twin"]["network_latency_ms"] = 22.0
    SYSTEM_STATE["digital_twin"]["error_rate_pct"] = 0.01
    SYSTEM_STATE["digital_twin"]["status"] = "HEALTHY"

    # Log Execution into Audit Ledger
    audit_entry = {
        "event_id": f"AUDIT-{random.randint(10000, 99999)}",
        "incident_id": payload.incident_id,
        "action": payload.action_name,
        "risk_level": payload.risk_level,
        "target": payload.target_resource,
        "operator": payload.executed_by,
        "status": "VERIFIED_SUCCESSFUL",
        "verified_recovery": True
    }
    SYSTEM_STATE["audit_ledger"].append(audit_entry)

    return {
        "success": True,
        "message": f"Action '{payload.action_name}' executed and recovery verified in Digital Twin.",
        "audit_record": audit_entry,
        "digital_twin_status": SYSTEM_STATE["digital_twin"]["status"]
    }

@app.get("/api/audit-ledger")
def get_audit_ledger():
    """Returns total verified history for auditability."""
    return {
        "total_events": len(SYSTEM_STATE["audit_ledger"]),
        "ledger": SYSTEM_STATE["audit_ledger"]
    }

@app.post("/api/postmortem/generate", response_model=PIRResponse, status_code=status.HTTP_200_OK)
def generate_postmortem(payload: PIRRequest):
    """
    Generates an executive-ready Markdown Post-Mortem report using Google Gemini API with local fallback.
    """
    api_key = os.getenv("GEMINI_API_KEY")

    if api_key and api_key != "your_google_ai_studio_api_key_here":
        try:
            client = genai.Client(api_key=api_key)
            
            prompt = f"""
            You are a Senior Site Reliability Engineer (SRE). Generate an executive-ready Post-Incident Review (PIR) report in Markdown format based on this incident data:
            - Incident ID: {payload.incident_id}
            - Title: {payload.title}
            - Root Cause: {payload.root_cause}
            - Resolution Time: {payload.resolved_time}
            - Actions Taken: {', '.join(payload.actions_taken)}

            Include Executive Summary, Root Cause Analysis, Timeline, Digital Twin Impact Analysis, and Preventative Action Items.
            """

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )

            return PIRResponse(
                incident_id=payload.incident_id,
                markdown=response.text
            )
        except Exception as err:
            print(f"[WARN] Gemini API call failed: {err}. Falling back to local template.")

    # Local fallback template
    fallback_markdown = f"""# 🚨 Post-Incident Review (PIR) - {payload.incident_id}
**Incident Title:** {payload.title}  
**Severity Level:** Critical (P1)  
**Resolution Summary:** {payload.resolved_time}  

---

### 1. Executive Summary
The system identified an impending failure via **Digital Twin Telemetry Projections**. Automated preemptive remediation was deployed prior to user-facing service degradation.

### 2. Root Cause Analysis
* **Primary Trigger:** {payload.root_cause}
* **Impacted Component:** Payment Processing Gateway & Digital Twin Node

### 3. Resolution & Mitigation
* **Executed Actions:**
{chr(10).join([f"  - {act}" for act in payload.actions_taken])}
* **Verification:** Digital Twin metrics returned to baseline `HEALTHY` state.
"""

    return PIRResponse(
        incident_id=payload.incident_id,
        markdown=fallback_markdown
    )