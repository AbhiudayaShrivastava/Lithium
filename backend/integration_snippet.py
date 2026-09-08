# integration_snippet.py
# ---------------------------------------------------------------
# This is NOT a file you run. It's a copy-paste reference to show
# your backend teammate exactly how to hook your db.py into their
# existing main.py. Send them this file alongside db.py and
# schema.sql.
# ---------------------------------------------------------------

# 1. At the top of main.py, import your functions:
#
#    from db import (
#        init_db, create_incident, resolve_incident,
#        log_audit_event, get_all_incidents, get_audit_trail,
#        save_postmortem, get_postmortem,
#    )

# 2. Call init_db() once when the app starts, right after `app = FastAPI(...)`:
#
#    init_db()

# 3. In the digital-twin endpoint, when a CRITICAL_CASCADE_RISK is detected,
#    create an incident and log it instead of just returning JSON:
#
#    @app.get("/api/digital-twin/simulate")
#    def simulate_digital_twin(minutes_ahead: int = 0):
#        ...existing logic to compute status, critical_node, action...
#
#        if status == "CRITICAL_CASCADE_RISK":
#            incident_id = create_incident(
#                title=f"Predicted cascade risk at +{minutes_ahead}m",
#                root_cause=f"Load projection on {critical_node}",
#            )
#            log_audit_event(incident_id, "AI_RECOMMENDATION", action)
#            # include incident_id in the response so the frontend
#            # can reference it later:
#            return {..., "incident_id": incident_id}
#
#        return {...}

# 4. Add a new endpoint so the frontend's "Execute Fix" button can
#    resolve the incident and log it:
#
#    @app.post("/api/incidents/{incident_id}/resolve")
#    def resolve(incident_id: int):
#        resolve_incident(incident_id, "Preemptive fix executed successfully")
#        return {"status": "resolved"}

# 5. In the postmortem endpoint, save the generated report instead of
#    only returning it:
#
#    @app.post("/api/postmortem/generate")
#    def generate_postmortem(req: PIRRequest):
#        ...existing logic to build `fallback_markdown` or call OpenAI...
#        save_postmortem(incident_id=int(req.incident_id), markdown=result_markdown)
#        return {"markdown": result_markdown}

# 6. Add two read-only endpoints so the "Audit" tab in the UI has
#    something to display:
#
#    @app.get("/api/incidents")
#    def list_incidents():
#        return get_all_incidents()
#
#    @app.get("/api/incidents/{incident_id}/audit-trail")
#    def incident_audit_trail(incident_id: int):
#        return get_audit_trail(incident_id)
