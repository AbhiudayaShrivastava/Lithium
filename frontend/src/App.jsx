import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api';

export default function OperationsDesk() {
  const [dashboardData, setDashboardData] = useState(null);
  const [digitalTwin, setDigitalTwin] = useState(null);
  const [auditLedger, setAuditLedger] = useState([]);
  const [postMortem, setPostMortem] = useState(null);
  const [loadingPIR, setLoadingPIR] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Fetch Dashboard & Digital Twin Data
  const fetchData = async () => {
    try {
      const [dashRes, twinRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard`),
        fetch(`${API_BASE}/digital-twin/telemetry`),
        fetch(`${API_BASE}/audit-ledger`)
      ]);
      setDashboardData(await dashRes.json());
      setDigitalTwin(await twinRes.json());
      const auditData = await auditRes.json();
      setAuditLedger(auditData.ledger || []);
    } catch (err) {
      console.error('API Error:', err);
    }
  };

  // Poll Digital Twin metrics every 3 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Toggle Kill-Switch
  const handleKillSwitch = async () => {
    if (!dashboardData) return;
    const nextState = !dashboardData.system_status.kill_switch_active;
    try {
      const res = await fetch(`${API_BASE}/system/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kill_switch_active: nextState })
      });
      const data = await res.json();
      setMessage(data.message);
      fetchData();
    } catch (err) {
      setMessage('Failed to toggle kill switch.');
    }
  };

  // 3. Inject Chaos Fault into Digital Twin
  const handleInjectChaos = async (faultType) => {
    try {
      const res = await fetch(`${API_BASE}/digital-twin/chaos/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fault_type: faultType,
          target_service: 'Payment Service'
        })
      });
      const data = await res.json();
      setMessage(data.message);
      fetchData();
    } catch (err) {
      setMessage('Failed to inject chaos.');
    }
  };

  // 4. Execute Remediation Action
  const handleExecuteAction = async (incidentId, actionName, riskLevel) => {
    try {
      const res = await fetch(`${API_BASE}/remediation/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId,
          action_name: actionName,
          risk_level: riskLevel,
          target_resource: 'Payment Gateway Pool',
          executed_by: 'HUMAN_OPERATOR'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessage(`Error: ${errData.detail}`);
        return;
      }

      const data = await res.json();
      setMessage(data.message);
      fetchData();
    } catch (err) {
      setMessage('Action execution failed.');
    }
  };

  // 5. Generate Post-Mortem via Gemini API
  const handleGeneratePIR = async (incident) => {
    setLoadingPIR(true);
    try {
      const res = await fetch(`${API_BASE}/postmortem/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incident.id,
          title: incident.title,
          root_cause: incident.probable_root_cause,
          resolved_time: '2m 14s',
          actions_taken: ['Expanded Connection Pool', 'Recycled Idle Threads']
        })
      });
      const data = await res.json();
      setPostMortem(data.markdown);
    } catch (err) {
      setMessage('Failed to generate post-mortem report.');
    } finally {
      setLoadingPIR(false);
    }
  };

  if (!dashboardData || !digitalTwin) {
    return <div className="p-8 text-white bg-slate-900 min-h-screen">Loading Operational Intelligence Desk...</div>;
  }

  const { kpis, system_status, active_incidents } = dashboardData;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <header className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-cyan-400">
            AUTONOMOUS OPERATIONS INTELLIGENCE DESK
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time Telemetry &bull; Digital Twin Simulation Engine &bull; Automated Remediation
          </p>
        </div>

        {/* Kill-Switch Button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleKillSwitch}
            className={`px-4 py-2 font-bold rounded text-xs transition-all ${
              system_status.kill_switch_active
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {system_status.kill_switch_active ? '🛑 MANUAL OVERRIDE (ACTIVE)' : '⚡ AUTONOMOUS MODE'}
          </button>
        </div>
      </header>

      {/* Action Message Banner */}
      {message && (
        <div className="mt-4 p-3 bg-slate-800 border-l-4 border-cyan-500 text-xs text-slate-200 flex justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-slate-900 p-4 rounded border border-slate-800">
          <div className="text-xs text-slate-400">System Health Score</div>
          <div className={`text-2xl font-black mt-1 ${kpis.system_health_pct > 80 ? 'text-emerald-400' : 'text-red-400'}`}>
            {kpis.system_health_pct}%
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded border border-slate-800">
          <div className="text-xs text-slate-400">Critical Incidents</div>
          <div className="text-2xl font-black text-red-500 mt-1">{kpis.critical_count}</div>
        </div>
        <div className="bg-slate-900 p-4 rounded border border-slate-800">
          <div className="text-xs text-slate-400">Digital Twin Status</div>
          <div className={`text-2xl font-black mt-1 ${digitalTwin.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {digitalTwin.status}
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded border border-slate-800">
          <div className="text-xs text-slate-400">Avg Resolution Time</div>
          <div className="text-2xl font-black text-cyan-400 mt-1">{kpis.avg_resolution}</div>
        </div>
      </div>

      {/* Main Grid: Digital Twin Telemetry & Active Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Digital Twin Simulation Panel */}
        <div className="bg-slate-900 p-5 rounded border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              Digital Twin Telemetry
            </h2>
            <span className="text-xs text-slate-500">Live Polling</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>CPU Utilization</span>
                <span className="font-mono text-cyan-400">{digitalTwin.cpu_utilization_pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                <div 
                  className={`h-full ${digitalTwin.cpu_utilization_pct > 80 ? 'bg-red-500' : 'bg-cyan-500'}`} 
                  style={{ width: `${Math.min(100, digitalTwin.cpu_utilization_pct)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Memory Usage</span>
                <span className="font-mono text-cyan-400">{digitalTwin.memory_usage_pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${digitalTwin.memory_usage_pct}%` }}></div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400">Network Latency:</span>
              <span className="font-mono text-slate-200">{digitalTwin.network_latency_ms.toFixed(1)} ms</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Error Rate:</span>
              <span className="font-mono text-slate-200">{digitalTwin.error_rate_pct.toFixed(2)}%</span>
            </div>
          </div>

          {/* Chaos Injection Sandbox */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 mb-2">Chaos Simulation Controls</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleInjectChaos('CPU_SPIKE')}
                className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-600/50 py-1.5 px-2 rounded text-xs transition"
              >
                Inject CPU Spike
              </button>
              <button
                onClick={() => handleInjectChaos('LATENCY_SURGE')}
                className="flex-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-600/50 py-1.5 px-2 rounded text-xs transition"
              >
                Inject Latency
              </button>
            </div>
          </div>
        </div>

        {/* Active Incidents & Action Approval Gates */}
        <div className="lg:col-span-2 bg-slate-900 p-5 rounded border border-slate-800">
          <h2 className="text-sm font-bold text-slate-200 mb-4">Active Correlated Incidents</h2>
          
          <div className="space-y-3">
            {active_incidents.map((inc) => (
              <div key={inc.id} className="p-4 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      inc.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {inc.severity}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{inc.incident_number}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 mt-1">{inc.title}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Root Cause: <span className="text-slate-300">{inc.probable_root_cause}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleExecuteAction(inc.id, 'Approve Connection Reset', 'HIGH')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded transition"
                  >
                    Execute Remediation
                  </button>
                  <button
                    onClick={() => handleGeneratePIR(inc)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded transition"
                  >
                    Generate Post-Mortem
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* AI Post-Mortem Report Modal / Drawer */}
      {loadingPIR && (
        <div className="mt-6 p-4 bg-slate-900 border border-cyan-500/50 rounded text-xs text-cyan-400 animate-pulse">
          Generating executive-ready post-mortem report via Gemini 2.5 Flash...
        </div>
      )}

      {postMortem && (
        <div className="mt-6 bg-slate-900 p-6 rounded border border-slate-800 relative">
          <button 
            onClick={() => setPostMortem(null)} 
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            ✕ Close
          </button>
          <h2 className="text-sm font-bold text-cyan-400 mb-3">AI Incident Post-Mortem Report</h2>
          <pre className="whitespace-pre-wrap text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded border border-slate-800 max-h-96 overflow-y-auto">
            {postMortem}
          </pre>
        </div>
      )}

      {/* Audit Ledger Feed */}
      <div className="mt-6 bg-slate-900 p-5 rounded border border-slate-800">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Immutable Audit Ledger</h2>
        {auditLedger.length === 0 ? (
          <div className="text-xs text-slate-500">No actions executed in ledger yet.</div>
        ) : (
          <div className="space-y-2">
            {auditLedger.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-mono text-slate-400">{item.event_id}</span>
                <span className="text-slate-200">{item.action}</span>
                <span className="text-cyan-400 font-mono">{item.operator}</span>
                <span className="text-emerald-400 font-bold">{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}