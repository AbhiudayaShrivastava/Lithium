import os
import random
from typing import List, Optional
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI(title="Autonomous Operations Intelligence Desk")

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL APPLICATION STATE (In-Memory) ---
SYSTEM_STATE = {
    "kill_switch_active": False,  # True = Manual Mode (Overrides automation)
    "automation_mode": "HYBRID",  # "FULL_AUTO" or "HYBRID"
    "audit_ledger": []
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

class PIRRequest(BaseModel):
    incident_id: str
    title: str
    root_cause: str
    resolved_time: str
    actions_taken: List[str]

class PIRResponse(BaseModel):
    incident_id: str
    markdown: str

# --- ENDPOINTS ---

@app.get("/api/dashboard")
def get_dashboard_data():
    """Returns top KPI cards, system mode state, and active correlated incidents."""
    return {
        "system_status": {
            "kill_switch_active": SYSTEM_STATE["kill_switch_active"],
            "automation_mode": "MANUAL_OVERRIDE" if SYSTEM_STATE["kill_switch_active"] else SYSTEM_STATE["automation_mode"]
        },
        "kpis": KPIMetrics(
            system_health_pct=96,
            critical_count=2,
            high_count=7,
            avg_resolution="4m 21s"
        ),
        "active_incidents": [
            IncidentItem(
                id="inc-1042",
                severity="CRITICAL",
                incident_number="#1042",
                title="Payment Infrastructure Degradation",
                risk_score=96,
                probable_root_cause="Database connection pool exhaustion",
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
            ),
            IncidentItem(
                id="inc-1031",
                severity="MEDIUM",
                incident_number="#1031",
                title="Auth Service Retry Storm",
                risk_score=48,
                probable_root_cause="Token validation cache miss surge",
                confidence=0.82,
                dependency_chain=["Auth DB", "Auth Service"]
            )
        ]
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
        "message": f"Action '{payload.action_name}' executed and recovery verified.",
        "audit_record": audit_entry
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
    Generates an executive-ready Markdown Post-Mortem report using Google Gemini API with fallback.
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

            Include Executive Summary, Root Cause Analysis, Timeline, and Preventative Action Items.
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
The system identified an impending failure via Telemetry Projections. Automated preemptive remediation was deployed prior to user-facing service degradation.

### 2. Root Cause Analysis
* **Primary Trigger:** {payload.root_cause}
* **Impacted Component:** Payment Processing Gateway

### 3. Resolution & Mitigation
* **Executed Actions:**
{chr(10).join([f"  - {act}" for act in payload.actions_taken])}
* **Verification:** Metrics returned to baseline HEALTHY within 30 seconds.
"""

    return PIRResponse(
        incident_id=payload.incident_id,
        markdown=fallback_markdown
    )