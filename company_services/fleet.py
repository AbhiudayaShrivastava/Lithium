import time
import os
import threading
import random
import uvicorn
from fastapi import FastAPI, Response, status
from fastapi.responses import HTMLResponse

# ==============================================================================
# REAL COMPANY MICROSERVICES FLEET (PORTS 5001, 5002, 5003)
# Microservices reflect both ROOT CAUSE and CASCADING IMPACT based on topology!
# ==============================================================================

class ServiceFaultState:
    def __init__(self, name: str, port: int, role: str):
        self.name = name
        self.port = port
        self.role = role
        self.is_healthy = True
        self.fault_mode = "HEALTHY" # 'HEALTHY', 'ROOT_CAUSE', 'CASCADING_IMPACT'
        self.fault_title = ""
        self.fault_details = ""
        self.latency_penalty_ms = 0
        self.memory_leak_mb = 0
        self.leaked_buffers = []
        self.request_count = 142
        self.error_count = 0
        self.start_time = time.time()

    def reset(self):
        self.is_healthy = True
        self.fault_mode = "HEALTHY"
        self.fault_title = ""
        self.fault_details = ""
        self.latency_penalty_ms = 0
        self.memory_leak_mb = 0
        self.leaked_buffers.clear()
        self.error_count = 0

    def set_root_fault(self, title: str, details: str, latency_ms: int = 0, leak_mb: int = 0):
        self.is_healthy = False
        self.fault_mode = "ROOT_CAUSE"
        self.fault_title = title
        self.fault_details = details
        self.latency_penalty_ms = latency_ms
        self.memory_leak_mb = leak_mb
        if leak_mb > 0:
            self.leaked_buffers.append(bytearray(leak_mb * 1024 * 1024))

    def set_cascading_impact(self, upstream_service: str, reason: str, latency_ms: int = 600):
        self.is_healthy = False
        self.fault_mode = "CASCADING_IMPACT"
        self.fault_title = f"Upstream Dependency Degraded ({upstream_service})"
        self.fault_details = reason
        self.latency_penalty_ms = latency_ms

payment_state = ServiceFaultState("Payment Gateway", 5001, "Visa / Mastercard / Stripe Gateway Engine")
auth_state = ServiceFaultState("Authentication & Session Service", 5002, "OAuth2 / JWT Token Authority & User Sessions")
order_state = ServiceFaultState("Order Processing Service", 5003, "Cart Checkout & Inventory Dispatch Pipeline")

def get_html_dashboard(state_obj: ServiceFaultState, extra_cards_html: str) -> str:
    uptime = int(time.time() - state_obj.start_time)
    mins = uptime // 60
    secs = uptime % 60

    if state_obj.fault_mode == "ROOT_CAUSE":
        status_badge = '<span style="background:#dc2626;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;animation:pulse 1s infinite;">💥 ROOT CAUSE (EPICENTER)</span>'
        error_banner = f'''
        <div style="background:#450a0a;border:2px solid #ef4444;color:#fecaca;padding:16px;border-radius:12px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;">🛑</span>
                <div>
                    <strong style="font-size:15px;color:#f87171;display:block;">PRIMARY OUTAGE ROOT CAUSE: {state_obj.fault_title}</strong>
                    <span style="font-size:13px;color:#fca5a5;">{state_obj.fault_details}</span>
                </div>
            </div>
        </div>'''
    elif state_obj.fault_mode == "CASCADING_IMPACT":
        status_badge = '<span style="background:#d97706;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;">⚠️ CASCADING IMPACT (BLAST RADIUS)</span>'
        error_banner = f'''
        <div style="background:#451a03;border:2px solid #f59e0b;color:#fef3c7;padding:16px;border-radius:12px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;">⚡</span>
                <div>
                    <strong style="font-size:15px;color:#fbbf24;display:block;">SECONDARY DOWNSTREAM IMPACT: {state_obj.fault_title}</strong>
                    <span style="font-size:13px;color:#fde68a;">{state_obj.fault_details}</span>
                </div>
            </div>
        </div>'''
    else:
        status_badge = '<span style="background:#059669;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;">✅ HEALTHY (200 OK)</span>'
        error_banner = ''

    return f"""<!DOCTYPE html>
<html>
<head>
    <title>{state_obj.name} - Enterprise Microservice</title>
    <meta http-equiv="refresh" content="3">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; margin: 0; padding: 30px; }}
        .container {{ max-width: 880px; margin: 0 auto; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 20px; margin-bottom: 25px; }}
        .title {{ font-size: 24px; font-weight: 800; color: #fff; margin: 0; }}
        .sub {{ font-size: 13px; color: #9ca3af; margin-top: 4px; }}
        .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }}
        .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; }}
        .label {{ font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.05em; }}
        .val {{ font-size: 24px; font-weight: 700; color: #38bdf8; font-family: monospace; margin-top: 6px; }}
        .table {{ width: 100%; border-collapse: collapse; background: #111827; border-radius: 12px; overflow: hidden; border: 1px solid #1f2937; }}
        .table th, .table td {{ padding: 12px 16px; text-align: left; font-size: 13px; border-bottom: 1px solid #1f2937; }}
        .table th {{ background: #161e2e; color: #9ca3af; font-weight: 600; }}
        .badge {{ font-family: monospace; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; }}
        .tag-monitored {{ display: inline-block; background: #1e1b4b; color: #818cf8; border: 1px solid #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }}
    </style>
</head>
<body>
    <div class="container">
        {error_banner}
        <div class="header">
            <div>
                <h1 class="title">{state_obj.name} <span style="font-size:14px;color:#9ca3af;font-weight:400;">(Port {state_obj.port})</span></h1>
                <div class="sub">{state_obj.role}</div>
            </div>
            <div>{status_badge}</div>
        </div>

        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <span class="tag-monitored">📡 Monitored Live by Lithium Autonomous Operations Platform</span>
            <span style="font-size:12px;color:#9ca3af;">Auto-refreshes every 3 seconds</span>
        </div>

        <div class="grid">
            <div class="card">
                <div class="label">Total Requests Handled</div>
                <div class="val">{state_obj.request_count}</div>
            </div>
            <div class="card">
                <div class="label">Fault & Error Count</div>
                <div class="val" style="color:{'#ef4444' if not state_obj.is_healthy else '#10b981'}">{state_obj.error_count}</div>
            </div>
            <div class="card">
                <div class="label">Service Uptime</div>
                <div class="val" style="color:#e2e8f0">{mins}m {secs}s</div>
            </div>
        </div>

        {extra_cards_html}

        <div style="margin-top: 25px; padding: 15px; background: #111827; border-radius: 12px; border: 1px solid #1f2937; font-size: 12px; color: #9ca3af;">
            <strong>Machine Health Probe:</strong> <a href="/health" style="color: #38bdf8; text-decoration: none;">http://localhost:{state_obj.port}/health</a> (Streams live telemetry directly into Apache Kafka)
        </div>
    </div>
</body>
</html>"""

# ==============================================================================
# 1. PAYMENT GATEWAY (PORT 5001)
# ==============================================================================
payment_app = FastAPI(title="Payment Gateway")

@payment_app.get("/", response_class=HTMLResponse)
def payment_ui():
    payment_state.request_count += 1
    is_failing = not payment_state.is_healthy
    extra = f"""
    <div class="grid">
        <div class="card"><div class="label">Active Transactions</div><div class="val">{random.randint(14, 25)} / min</div></div>
        <div class="card"><div class="label">DB Pool Threads</div><div class="val" style="color:{'#ef4444' if is_failing else '#10b981'}">{'0 / 20 (EXHAUSTED)' if is_failing else '18 / 20'}</div></div>
        <div class="card"><div class="label">P99 Gateway Latency</div><div class="val" style="color:{'#ef4444' if payment_state.latency_penalty_ms > 0 else '#38bdf8'}">{24 + payment_state.latency_penalty_ms} ms</div></div>
    </div>
    <table class="table">
        <tr><th>Transaction ID</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th></tr>
        <tr><td>TXN-9021</td><td>Aakash Verma</td><td>₹4,250.00</td><td>HDFC NetBanking</td><td><span class="badge" style="background:#064e3b;color:#34d399">CAPTURED</span></td></tr>
        <tr><td>TXN-9022</td><td>Priya Sharma</td><td>₹1,120.00</td><td>UPI (Google Pay)</td><td><span class="badge" style="background:#064e3b;color:#34d399">CAPTURED</span></td></tr>
        <tr><td>TXN-9023</td><td>Rohan Mehta</td><td>₹8,900.00</td><td>Visa ending in 4102</td><td>{'<span class="badge" style="background:#7f1d1d;color:#fca5a5">DEADLOCKED (503)</span>' if is_failing else '<span class="badge" style="background:#064e3b;color:#34d399">CAPTURED</span>'}</td></tr>
    </table>
    """
    return get_html_dashboard(payment_state, extra)

@payment_app.get("/health")
def payment_health(response: Response):
    payment_state.request_count += 1
    if payment_state.latency_penalty_ms > 0:
        time.sleep(min(0.8, payment_state.latency_penalty_ms / 1000.0))
    
    if not payment_state.is_healthy:
        payment_state.error_count += 1
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "service": "payment-gateway",
            "port": 5001,
            "status": "CRITICAL" if payment_state.fault_mode == "ROOT_CAUSE" else "DEGRADED",
            "fault_mode": payment_state.fault_mode,
            "title": payment_state.fault_title,
            "error": payment_state.fault_details
        }
    
    return {
        "service": "payment-gateway",
        "port": 5001,
        "status": "HEALTHY",
        "uptime_sec": round(time.time() - payment_state.start_time, 1),
        "requests_processed": payment_state.request_count
    }

# ==============================================================================
# 2. AUTHENTICATION SERVICE (PORT 5002)
# ==============================================================================
auth_app = FastAPI(title="Auth & Session Service")

@auth_app.get("/", response_class=HTMLResponse)
def auth_ui():
    auth_state.request_count += 1
    is_failing = not auth_state.is_healthy
    extra = f"""
    <div class="grid">
        <div class="card"><div class="label">Active Sessions (JWT)</div><div class="val">842 tokens</div></div>
        <div class="card"><div class="label">Token Verification Time</div><div class="val" style="color:{'#ef4444' if is_failing else '#38bdf8'}">{4.1 + (auth_state.latency_penalty_ms / 10.0):.1f} ms</div></div>
        <div class="card"><div class="label">Heap Allocation</div><div class="val" style="color:{'#ef4444' if auth_state.memory_leak_mb > 150 else '#10b981'}">{48 + auth_state.memory_leak_mb} MB</div></div>
    </div>
    <table class="table">
        <tr><th>User ID</th><th>Client IP</th><th>Role</th><th>Issued At</th><th>Status</th></tr>
        <tr><td>usr_981</td><td>192.168.1.12</td><td>ENGINEER</td><td>1 min ago</td><td>{'<span class="badge" style="background:#7f1d1d;color:#fca5a5">BLOCKED (CASCADE)</span>' if is_failing else '<span class="badge" style="background:#064e3b;color:#34d399">ACTIVE</span>'}</td></tr>
        <tr><td>usr_982</td><td>10.0.4.88</td><td>DEVELOPER</td><td>3 mins ago</td><td><span class="badge" style="background:#064e3b;color:#34d399">ACTIVE</span></td></tr>
        <tr><td>usr_983</td><td>172.16.0.4</td><td>ADMIN</td><td>Just now</td><td>{'<span class="badge" style="background:#7f1d1d;color:#fca5a5">SESSION EVICTED</span>' if is_failing else '<span class="badge" style="background:#064e3b;color:#34d399">ACTIVE</span>'}</td></tr>
    </table>
    """
    return get_html_dashboard(auth_state, extra)

@auth_app.get("/health")
def auth_health(response: Response):
    auth_state.request_count += 1
    if auth_state.latency_penalty_ms > 0:
        time.sleep(min(0.8, auth_state.latency_penalty_ms / 1000.0))

    if not auth_state.is_healthy:
        auth_state.error_count += 1
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR if auth_state.fault_mode == "ROOT_CAUSE" else status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "service": "auth-service",
            "port": 5002,
            "status": "CRITICAL" if auth_state.fault_mode == "ROOT_CAUSE" else "DEGRADED",
            "fault_mode": auth_state.fault_mode,
            "title": auth_state.fault_title,
            "error": auth_state.fault_details
        }

    return {
        "service": "auth-service",
        "port": 5002,
        "status": "HEALTHY",
        "uptime_sec": round(time.time() - auth_state.start_time, 1),
        "allocated_memory_mb": auth_state.memory_leak_mb,
        "requests_processed": auth_state.request_count
    }

# ==============================================================================
# 3. ORDER PROCESSING SERVICE (PORT 5003)
# ==============================================================================
order_app = FastAPI(title="Order Processing Service")

@order_app.get("/", response_class=HTMLResponse)
def order_ui():
    order_state.request_count += 1
    is_failing = not order_state.is_healthy
    extra = f"""
    <div class="grid">
        <div class="card"><div class="label">Queued Orders</div><div class="val">{random.randint(18, 32) if is_failing else random.randint(6, 12)} pending</div></div>
        <div class="card"><div class="label">Worker Threads</div><div class="val" style="color:{'#ef4444' if is_failing else '#10b981'}">{'THROTTLED (1/8)' if is_failing else '8 / 8 Active'}</div></div>
        <div class="card"><div class="label">Checkout Success Rate</div><div class="val" style="color:{'#ef4444' if is_failing else '#38bdf8'}">{'31.2% (FAILING)' if is_failing else '99.8%'}</div></div>
    </div>
    <table class="table">
        <tr><th>Order #</th><th>SKU Items</th><th>Warehouse</th><th>Dispatch Priority</th><th>Pipeline State</th></tr>
        <tr><td>ORD-4491</td><td>Lithium Battery Cell (x4)</td><td>WH-North</td><td>EXPRESS</td><td><span class="badge" style="background:#064e3b;color:#34d399">PACKED</span></td></tr>
        <tr><td>ORD-4492</td><td>Microcontroller PCB (x10)</td><td>WH-East</td><td>STANDARD</td><td>{'<span class="badge" style="background:#7f1d1d;color:#fca5a5">PAYMENT TIMEOUT</span>' if is_failing else '<span class="badge" style="background:#064e3b;color:#34d399">DISPATCHED</span>'}</td></tr>
        <tr><td>ORD-4493</td><td>High-Current Cable Kit</td><td>WH-Central</td><td>SAME_DAY</td><td>{'<span class="badge" style="background:#7f1d1d;color:#fca5a5">STALLED (CASCADE)</span>' if is_failing else '<span class="badge" style="background:#064e3b;color:#34d399">PROCESSING</span>'}</td></tr>
    </table>
    """
    return get_html_dashboard(order_state, extra)

@order_app.get("/health")
def order_health(response: Response):
    order_state.request_count += 1
    if order_state.latency_penalty_ms > 0:
        time.sleep(min(0.8, order_state.latency_penalty_ms / 1000.0))

    if not order_state.is_healthy:
        order_state.error_count += 1
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "service": "order-service",
            "port": 5003,
            "status": "CRITICAL" if order_state.fault_mode == "ROOT_CAUSE" else "DEGRADED",
            "fault_mode": order_state.fault_mode,
            "title": order_state.fault_title,
            "error": order_state.fault_details
        }

    return {
        "service": "order-service",
        "port": 5003,
        "status": "HEALTHY",
        "uptime_sec": round(time.time() - order_state.start_time, 1),
        "requests_processed": order_state.request_count
    }

# ------------------------------------------------------------------------------
# MULTI-SERVICE CONTROLLER ENDPOINTS (CALLED BY CHAOS BRIDGE & REMEDIATION)
# ------------------------------------------------------------------------------
@payment_app.post("/fleet/scenario/{scenario_type}")
@auth_app.post("/fleet/scenario/{scenario_type}")
@order_app.post("/fleet/scenario/{scenario_type}")
def apply_fleet_scenario(scenario_type: str):
    """
    Sets both the ROOT CAUSE service and the CASCADING IMPACT services to match the topology!
    """
    if scenario_type == "DB_LOCK":
        # ROOT CAUSE: Payment Gateway (Database deadlock on transaction ledger)
        payment_state.set_root_fault("PostgreSQL Connection Pool Deadlock", "Transaction #8492 held exclusive lock on txn_ledger, exhausting pool limit 100/100.", latency_ms=1200)
        # CASCADING IMPACT: Auth Service (Unable to write session audit rows)
        auth_state.set_cascading_impact("Payment DB", "Session audit write blocked by downstream database connection timeout.", latency_ms=500)
        # CASCADING IMPACT: Order Processing (Orders failing payment authorization)
        order_state.set_cascading_impact("Payment Gateway", "Checkout pipeline blocked waiting for payment gateway response.", latency_ms=700)

    elif scenario_type == "MEMORY_LEAK":
        # ROOT CAUSE: Auth Service (Token validation buffer leak)
        auth_state.set_root_fault("Auth Pod Memory Leak (OOM)", "Token validation buffer leak exceeded container limits (+250 MB RAM).", latency_ms=800, leak_mb=250)
        # CASCADING IMPACT: Order Processing (Cannot verify buyer JWT token)
        order_state.set_cascading_impact("Auth Service", "Unable to verify buyer JWT bearer tokens. Orders queued in fallback buffer.", latency_ms=600)
        # Payment is unaffected
        payment_state.reset()

    elif scenario_type == "DDOS_SURGE" or scenario_type == "CPU_SPIKE":
        # ROOT CAUSE: Order Processing / Gateway (High volumetric CPU spike)
        order_state.set_root_fault("High-Concurrency CPU Spike", "45,000 req/sec checkout storm throttled worker pool to 96% CPU utilization.", latency_ms=1500)
        # CASCADING IMPACT: Payment Gateway (High-frequency rate-limiting)
        payment_state.set_cascading_impact("Order Pipeline", "Rate limiter activated due to burst traffic from upstream order service.", latency_ms=450)
        # Auth unaffected
        auth_state.reset()

    return {"status": "success", "applied_scenario": scenario_type}

@payment_app.post("/fleet/remediate")
@auth_app.post("/fleet/remediate")
@order_app.post("/fleet/remediate")
def remediate_entire_fleet():
    payment_state.reset()
    auth_state.reset()
    order_state.reset()
    return {"status": "remediated", "all_services": "HEALTHY"}

def run_service(app, port):
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

def start_all():
    t1 = threading.Thread(target=run_service, args=(payment_app, 5001), daemon=True)
    t2 = threading.Thread(target=run_service, args=(auth_app, 5002), daemon=True)
    t3 = threading.Thread(target=run_service, args=(order_app, 5003), daemon=True)
    t1.start()
    t2.start()
    t3.start()
    print("===================================================================")
    print(" [COMPANY INFRASTRUCTURE] Topology-Aware Microservices Running:")
    print("  -> Payment Gateway:   http://localhost:5001  (UI Dashboard)")
    print("  -> Auth & Session:    http://localhost:5002  (UI Dashboard)")
    print("  -> Order Processing:  http://localhost:5003  (UI Dashboard)")
    print("===================================================================")

if __name__ == "__main__":
    start_all()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("[SHUTDOWN] Microservices stopped.")
