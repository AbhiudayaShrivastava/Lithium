import React, { useState, useEffect } from 'react';

export default function OperationsDesk() {
  const [data, setData] = useState(null);
  const [killSwitch, setKillSwitch] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  // Fetch initial dashboard state
  const fetchDashboard = async () => {
    const res = await fetch('http://localhost:8000/api/dashboard');
    const json = await res.json();
    setData(json);
    setKillSwitch(json.system_status.kill_switch_active);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Toggle Kill Switch
  const handleKillSwitchToggle = async () => {
    const newStatus = !killSwitch;
    const res = await fetch('http://localhost:8000/api/system/kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kill_switch_active: newStatus }),
    });
    const result = await res.json();
    setKillSwitch(result.kill_switch_active);
  };

  // Trigger Remediation Action
  const handleExecuteAction = async (incidentId, actionName, riskLevel, target) => {
    const res = await fetch('http://localhost:8000/api/remediation/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: incidentId,
        action_name: actionName,
        risk_level: riskLevel,
        target_resource: target,
        executed_by: "HUMAN_OPERATOR"
      }),
    });
    
    const result = await res.json();
    if (res.ok) {
      alert(`Success: ${result.message}`);
      setAuditLog(prev => [result.audit_record, ...prev]);
    } else {
      alert(`Blocked: ${result.detail}`);
    }
  };

  if (!data) return <div className="p-8 text-slate-600">Loading Intelligence Engine...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      
      {/* HEADER & UNIQUE FEATURE: KILL SWITCH */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Autonomous Operations Intelligence Desk</h1>
          <p className="text-sm text-slate-500">Correlated Event Management & Action Verification</p>
        </div>

        {/* KILL-SWITCH CONTROLLER */}
        <div className="flex items-center space-x-4 bg-slate-100 p-3 rounded-lg border border-slate-200">
          <span className="text-sm font-semibold text-slate-700">
            Mode: {killSwitch ? <span className="text-red-600">MANUAL OVERRIDE</span> : <span className="text-emerald-600">HYBRID AUTONOMOUS</span>}
          </span>
          <button
            onClick={handleKillSwitchToggle}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              killSwitch ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {killSwitch ? 'Deactivate Kill-Switch' : 'Activate Kill-Switch'}
          </button>
        </div>
      </div>

      {/* TOP KPI METRICS CARDS */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-4xl font-extrabold text-emerald-600">{data.kpis.system_health_pct}%</div>
          <div className="text-sm font-medium text-slate-500 mt-1">System Health</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-4xl font-extrabold text-rose-500">{data.kpis.critical_count}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">Critical</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-4xl font-extrabold text-amber-500">{data.kpis.high_count}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">High</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-4xl font-extrabold text-indigo-900">{data.kpis.avg_resolution}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">Avg. Resolution</div>
        </div>
      </div>

      {/* ACTIVE INCIDENTS LIST & APPROVAL GATES */}
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Active Incidents</h2>
      <div className="space-y-4 mb-8">
        {data.active_incidents.map((incident) => (
          <div key={incident.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                  incident.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 
                  incident.severity === 'HIGH' ? 'bg-amber-100 text-amber-600' : 'bg-yellow-100 text-yellow-600'
                }`}>
                  {incident.severity}
                </span>
                <span className="text-sm font-medium text-slate-400">{incident.incident_number}</span>
                <span className="text-base font-bold text-slate-800">{incident.title}</span>
              </div>
              <span className={`text-sm font-bold ${
                incident.risk_score >= 80 ? 'text-rose-500' : 'text-amber-500'
              }`}>
                Risk {incident.risk_score}
              </span>
            </div>

            {/* EXPANDED DETAILS: Root Cause & Action Approval Gate */}
            <div className="bg-slate-50 p-4 rounded-lg text-sm flex justify-between items-center mt-3 border border-slate-100">
              <div>
                <p className="text-slate-700"><strong>Probable Root Cause:</strong> {incident.probable_root_cause} ({incident.confidence * 100}% confidence)</p>
                <p className="text-slate-500 text-xs mt-1">Dependency: {incident.dependency_chain.join(" → ")}</p>
              </div>

              <div className="flex space-x-2">
                {/* Low Risk Action */}
                <button
                  onClick={() => handleExecuteAction(incident.id, "Clear Pool Cache", "LOW", "Payment DB")}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-md"
                >
                  Clear Cache (Low Risk)
                </button>
                {/* High Risk Action Requires Human Gate */}
                <button
                  onClick={() => handleExecuteAction(incident.id, "Restart DB Cluster", "HIGH", "Payment DB")}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md"
                >
                  Approve Restart (High Risk)
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AUDIT HISTORY FEED */}
      {auditLog.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Auditable Execution History</h3>
          <div className="space-y-2">
            {auditLog.map((log) => (
              <div key={log.event_id} className="text-xs p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 flex justify-between">
                <span><strong>[{log.event_id}]</strong> Action <i>{log.action}</i> executed by {log.operator}</span>
                <span className="font-bold">STATUS: {log.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}