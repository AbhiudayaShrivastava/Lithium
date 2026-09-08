# ⚡ Lithium — Autonomous Operations Platform

**Hackathon Track:** Problem Statement 5 (PS 5) — Autonomous Operations Intelligence Desk  
**Event:** Resonance 1.0 | SCOPE, VIT Chennai (MG Auditorium)  
**Frontend Architect:** Mantavya  

---

## 🚀 How to Open the Dashboard

Simply **double-click `index.html`** in File Explorer. It opens instantly in your browser (Chrome, Edge, or Brave) with zero setup required!

Alternatively, you can run:
```bash
python server.py
```
and open `http://localhost:3000/index.html`.

---

## 🌟 The 8 Core Features (Simple & Clean Layout)

1. **System Health Dashboard:** Clean top bar displaying Overall Health (`99.8%`), Microservices (`5/5`), P99 Latency (`32ms`), and Resolution MTTR (`16.2s`).
2. **System Dependency Map:** Clean, interactive canvas map of services (`Clients ➔ Gateway ➔ Auth ➔ Payments ➔ PostgreSQL DB`). Shows real-time node health (Green = Healthy, Red = Failing, Amber = Impacted). Hover on any node to view CPU/RAM stats.
3. **Digital Twin Time Slider *(USP #1)*:** Go to the **Digital Twin (+15m)** tab and drag the horizontal scrubber from `Now (0m)` to `+20m` to inspect future projected infrastructure health.
4. **Predicted Failure Alert:** Warns 12 minutes in advance before a crash reaches production users.
5. **AI Recommendation & RCA:** Dissects root cause ("Why?") and recommends the remediation action ("What fix?").
6. **One-Click Preemptive Fix:** Click **`[⚡ Apply Preemptive Fix Now]`** in the Digital Twin view to scale resources and neutralize the threat before it hits real users!
7. **Autonomy Mode Switcher:**
   * **🛡️ Hybrid Autonomous Mode:** AI diagnoses the outage and recommends the playbook, but requires the human operator to click **`[Approve & Execute Fix]`** (Human-in-the-loop safety).
   * **⚡ Full Autonomous Mode:** AI detects the incident, runs a live 2.0s countdown, and self-heals the cluster automatically with zero human clicks!
8. **Auto-Postmortem (PIR) with PDF Export *(USP #2)*:** Clean incident report with a **Causal Flow Diagram** (`Root Cause ➔ Failure ➔ Remediation ➔ Recovery`) and a **`[Download PDF]`** button that generates an official PDF report directly in the browser!
