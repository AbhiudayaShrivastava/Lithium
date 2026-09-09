/**
 * Lithium — Autonomous Operations Platform
 * Clean, lightweight reactive frontend engine connected to FastAPI & SQLite
 */

// ============================================================================
// Backend API Configuration & Integration Layer
// ============================================================================
const API_BASE = 'http://localhost:8000';
let isBackendConnected = false;
let sseSource = null;

async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    setBackendConnected(true);
    return await res.json();
  } catch (err) {
    console.warn(`[API] Fetch to ${endpoint} failed:`, err);
    setBackendConnected(false);
    return null;
  }
}

function setBackendConnected(connected, data = null) {
  isBackendConnected = connected;
  const dot = document.getElementById('backendStatusDot');
  const text = document.getElementById('backendStatusText');
  const dbText = document.getElementById('dbEngineText');

  const fleetDot = document.getElementById('fleetStatusDot');
  const fleetText = document.getElementById('fleetStatusText');

  if (dot && text) {
    if (connected) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
      text.className = 'text-emerald-400';
      text.textContent = 'API: Connected (Port 8000)';
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse';
      text.className = 'text-amber-400';
      text.textContent = 'API: Connecting...';
    }
  }

  if (data && data.database_engine && dbText) {
    dbText.textContent = `DB: ${data.database_engine.split(' ')[0]}`;
    dbText.title = data.database_engine;
  }

  if (data && fleetDot && fleetText) {
    if (data.fleet_live) {
      fleetDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
      fleetText.className = 'text-emerald-300 font-bold';
      fleetText.textContent = 'Fleet: 3 Live Servers (5001-5003)';
    } else {
      fleetDot.className = 'w-1.5 h-1.5 rounded-full bg-sky-400';
      fleetText.className = 'text-sky-300';
      fleetText.textContent = 'Fleet: Standby / Ready';
    }
  }
}

function initBackendConnection() {
  // 1. Initial health ping & autonomy mode check
  apiFetch('/api/health').then(data => {
    if (data) {
      setBackendConnected(true, data);
      if (data.autonomy_mode) {
        setAutonomyMode(data.autonomy_mode, false);
      }
    }
  });

  // 2. Fetch persistent audit ledger
  renderAuditTable();

  // 3. Connect to SSE Real-Time Telemetry Stream
  try {
    if (sseSource) sseSource.close();
    sseSource = new EventSource(`${API_BASE}/api/v1/telemetry/stream`);
    sseSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setBackendConnected(true, payload);
        if (payload.latency !== undefined) {
          if (!state.activeIncident) {
            state.latencyMs = Math.round(payload.latency);
            state.healthScore = payload.health_score !== undefined ? payload.health_score : Math.max(90, Math.round((100 - payload.cpu * 0.05) * 10) / 10);
            updateMetrics();
          }
        }
      } catch (e) {}
    };
    sseSource.onerror = () => {
      setBackendConnected(false);
    };
  } catch (err) {
    console.warn('[SSE] EventSource unavailable:', err);
  }

  // Periodic heartbeat sync
  setInterval(async () => {
    const data = await apiFetch('/api/dashboard');
    if (data && data.system_status) {
      setBackendConnected(true);
      if (data.kpis) {
        if (!state.activeIncident) {
          state.healthScore = data.kpis.system_health_pct;
        }
        state.avgMttr = data.kpis.avg_resolution;
        updateMetrics();
      }
    }
  }, 3000);
}

// Global State
const state = {
  autonomyMode: 'COPILOT',       // 'COPILOT' or 'AUTONOMOUS'
  clusterHealth: 'NOMINAL',      // 'NOMINAL', 'CRITICAL', 'RECOVERING'
  currentTab: 'dashboard',

  // Metrics
  healthScore: 99.8,
  activeServices: 5,
  totalServices: 5,
  latencyMs: 32,
  rawEventsCount: 1248,
  correlatedIncidentsCount: 0,

  // Active Incident
  activeIncident: null,
  incidentDurationSec: 0,
  incidentTimerInterval: null,
  autoHealInterval: null,

  // Logs & Filters
  logs: [],
  logFilter: 'ALL',

  // Digital Twin
  twinOffsetMins: 15,
  twinHistoryHours: 1,
  twinFixApplied: false,

  // Audit History
  auditHistory: [
    {
      time: '02:50:12',
      id: 'SYS-INIT',
      source: 'CLOUD',
      actor: 'Lithium Engine',
      action: 'Cluster baseline health verified',
      status: 'HEALTHY'
    },
    {
      time: '02:55:40',
      id: 'TWIN-SYNC',
      source: 'METRICS',
      actor: 'Digital Twin',
      action: 'Predictive shadow thread calibrated (+15m)',
      status: 'SYNCED'
    }
  ],

  // PIR Reports
  reports: []
};

// ============================================================================
// Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  startClock();
  initCanvas();
  initBackendConnection();
  startLogStream();
  generateInitialPIR();
});

// Live Clock
function startClock() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + ' UTC';
    
    const liveClock = document.getElementById('liveClock');
    if (liveClock) liveClock.textContent = timeStr;

    const twinNow = document.getElementById('twinNowTime');
    if (twinNow) twinNow.textContent = timeStr;

    const twinForecast = document.getElementById('twinForecastTime');
    if (twinForecast) {
      const forecast = new Date(now.getTime() + state.twinOffsetMins * 60000);
      twinForecast.textContent = `${forecast.toTimeString().split(' ')[0]} (+${state.twinOffsetMins}m)`;
    }
  }, 1000);
}

// Tab Switching
function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('viewDashboard').classList.add('hidden');
  document.getElementById('viewDigitalTwin').classList.add('hidden');
  document.getElementById('viewReports').classList.add('hidden');

  if (tabId === 'dashboard') {
    document.getElementById('tabDashboard').classList.add('active');
    document.getElementById('viewDashboard').classList.remove('hidden');
  } else if (tabId === 'digital-twin') {
    document.getElementById('tabDigitalTwin').classList.add('active');
    document.getElementById('viewDigitalTwin').classList.remove('hidden');
    setTimeout(() => initTwinTrafficChart(), 40);
  } else if (tabId === 'reports') {
    document.getElementById('tabReports').classList.add('active');
    document.getElementById('viewReports').classList.remove('hidden');
    renderReports();
  }
}

// ============================================================================
// Autonomy Mode Switcher (Co-Pilot vs Auto-Pilot)
// ============================================================================
function setAutonomyMode(mode, syncBackend = true) {
  state.autonomyMode = mode;
  const copilotBtn = document.getElementById('modeCopilotBtn');
  const autonomousBtn = document.getElementById('modeAutonomousBtn');

  if (mode === 'COPILOT') {
    copilotBtn.classList.add('active');
    autonomousBtn.classList.remove('active');
    addLog('SECURITY', 'MODE', 'Switched to [Hybrid Autonomous] mode. Manual approval required.');
  } else {
    autonomousBtn.classList.add('active');
    copilotBtn.classList.remove('active');
    addLog('SECURITY', 'MODE', 'Switched to [Full Autonomous] mode. Self-healing armed.');
  }

  if (syncBackend) {
    apiFetch('/api/system/mode', {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  }

  if (state.activeIncident) {
    updateAutonomyActionUI();
  }
}

function updateAutonomyActionUI() {
  const copilotWrap = document.getElementById('copilotActionWrap');
  const autoWrap = document.getElementById('autonomousActionWrap');

  if (state.autonomyMode === 'COPILOT') {
    copilotWrap.classList.remove('hidden');
    autoWrap.classList.add('hidden');
    clearInterval(state.autoHealInterval);
  } else {
    copilotWrap.classList.add('hidden');
    autoWrap.classList.remove('hidden');
    startAutoPilotCountdown();
  }
}

function startAutoPilotCountdown() {
  clearInterval(state.autoHealInterval);
  let timer = 2.0;
  const countEl = document.getElementById('autoCountdown');

  state.autoHealInterval = setInterval(() => {
    timer -= 0.1;
    if (countEl) countEl.textContent = Math.max(0, timer).toFixed(1) + 's';
    if (timer <= 0) {
      clearInterval(state.autoHealInterval);
      executeRemediation('AUTONOMOUS');
    }
  }, 100);
}

// ============================================================================
// Outage Scenarios & Chaos Injector
// ============================================================================
const OUTAGES = {
  DB_LOCK: {
    id: 'INC-8492',
    title: 'Database Connection Pool Exhaustion',
    severity: 'P1 CRITICAL',
    riskRate: 94,
    riskLevelTag: 'EXTREME',
    blastRadiusText: 'Impact: 3 / 5 Services Affected',
    epicenter: 'SQLite Database (WAL)',
    diagnosis: 'Commit #8f3a in Auth Service introduced an unclosed database transaction lock, saturating the connection pool limit (100/100).',
    action: 'Rollback commit #8f3a & flush DB connection pool',
    rootNode: 'db',
    affectedNodes: ['db', 'auth', 'payments'],
    health: 44.5,
    latency: 1420
  },
  MEMORY_LEAK: {
    id: 'INC-3921',
    title: 'Auth Pod Memory Leak (OOM Kill)',
    severity: 'P2 HIGH',
    riskRate: 78,
    riskLevelTag: 'HIGH RISK',
    blastRadiusText: 'Impact: 2 / 5 Services Affected',
    epicenter: 'Auth Service',
    diagnosis: 'Token validation buffer leak exceeded container cgroup memory limits, triggering automatic pod evictions.',
    action: 'Restart Auth pods & scale deployment replicas to 4',
    rootNode: 'auth',
    affectedNodes: ['auth', 'gateway'],
    health: 58.2,
    latency: 840
  },
  DDOS_SURGE: {
    id: 'INC-7104',
    title: 'Order Checkout Traffic Spike',
    severity: 'P1 CRITICAL',
    riskRate: 91,
    riskLevelTag: 'CRITICAL',
    blastRadiusText: 'Impact: 2 / 5 Services Affected',
    epicenter: 'Order Service (Port 5003)',
    diagnosis: 'Volumetric 45,000 req/sec flash-sale checkout surge throttled worker pool to 96% CPU, inducing downstream rate-limiting on Payment Gateway.',
    action: 'Enable adaptive queue rate-limiting & autoscale Order worker pods',
    rootNode: 'order',
    affectedNodes: ['order', 'payments'],
    health: 65.0,
    latency: 1650
  }
};

async function triggerOutage(type) {
  const scenario = OUTAGES[type];
  if (!scenario) return;

  // 1. Send real chaos injection to FastAPI backend & SQLite
  const backendRes = await apiFetch('/api/digital-twin/chaos/inject', {
    method: 'POST',
    body: JSON.stringify({
      fault_type: type,
      target_service: scenario.epicenter,
      incident_id: scenario.id,
      title: scenario.title,
      severity: scenario.severity,
      risk_rate: scenario.riskRate,
      risk_level_tag: scenario.riskLevelTag,
      epicenter: scenario.epicenter,
      diagnosis: scenario.diagnosis,
      recommended_action: scenario.action,
      root_node: scenario.rootNode,
      affected_nodes: scenario.affectedNodes,
      latency_ms: scenario.latency,
      health_score: scenario.health
    })
  });

  if (backendRes && backendRes.incident) {
    state.activeIncident = {
      ...scenario,
      ...backendRes.incident,
      action: backendRes.incident.recommended_action || scenario.action,
      riskRate: backendRes.incident.risk_rate || scenario.riskRate,
      riskLevelTag: backendRes.incident.risk_level_tag || scenario.riskLevelTag,
      blastRadiusText: scenario.blastRadiusText
    };
  } else {
    state.activeIncident = scenario;
  }

  state.clusterHealth = 'CRITICAL';
  state.correlatedIncidentsCount = 1;
  state.healthScore = state.activeIncident.health_score || scenario.health;
  state.latencyMs = state.activeIncident.latency_ms || scenario.latency;
  state.activeServices = 3;
  state.incidentDurationSec = 0;

  updateMetrics();

  // Header status
  const statusText = document.getElementById('clusterStatusText');
  statusText.className = 'text-rose-400 font-bold flex items-center gap-1.5';
  statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Critical Outage';

  // Banner details & Critical Risk Rate (1-100)
  document.getElementById('incidentActiveBanner').classList.remove('hidden');
  document.getElementById('postIncidentResolvedCard').classList.add('hidden');
  document.getElementById('incidentTitle').textContent = state.activeIncident.title;
  document.getElementById('rcaEpicenter').textContent = state.activeIncident.epicenter;
  document.getElementById('rcaDiagnosis').textContent = state.activeIncident.diagnosis;
  document.getElementById('actionName').textContent = state.activeIncident.action || state.activeIncident.recommended_action;

  // Update Critical Level & 1-100 Risk Rate Indicators
  const sevBadge = document.getElementById('incidentSeverityBadge');
  if (sevBadge) {
    sevBadge.textContent = state.activeIncident.severity;
    sevBadge.className = state.activeIncident.riskRate >= 90 
      ? 'px-3 py-1 rounded bg-rose-500 text-black text-xs font-black font-mono'
      : 'px-3 py-1 rounded bg-amber-500 text-black text-xs font-black font-mono';
  }

  const blastEl = document.getElementById('incidentBlastRadius');
  if (blastEl) blastEl.textContent = scenario.blastRadiusText;

  const riskNumEl = document.getElementById('riskRateNum');
  if (riskNumEl) riskNumEl.textContent = state.activeIncident.riskRate;

  const riskTagEl = document.getElementById('riskLevelTag');
  if (riskTagEl) {
    riskTagEl.textContent = state.activeIncident.riskLevelTag;
    riskTagEl.className = state.activeIncident.riskRate >= 90
      ? 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 ml-1.5'
      : 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 ml-1.5';
  }

  const riskBarEl = document.getElementById('riskRateBar');
  if (riskBarEl) {
    riskBarEl.style.width = `${state.activeIncident.riskRate}%`;
    riskBarEl.className = state.activeIncident.riskRate >= 90 ? 'bg-rose-500 h-full' : 'bg-amber-500 h-full';
  }

  // Incident Duration Timer
  clearInterval(state.incidentTimerInterval);
  state.incidentTimerInterval = setInterval(() => {
    state.incidentDurationSec++;
    const mins = String(Math.floor(state.incidentDurationSec / 60)).padStart(2, '0');
    const secs = String(state.incidentDurationSec % 60).padStart(2, '0');
    const durEl = document.getElementById('incidentDuration');
    if (durEl) durEl.textContent = `${mins}:${secs}`;
  }, 1000);

  // Set Canvas Node States
  setNodeFailure(scenario.rootNode, scenario.affectedNodes);

  // Logs
  addLog('LOGS', 'CRITICAL', `[${state.activeIncident.severity}] ${state.activeIncident.title} detected! Risk Rate: ${state.activeIncident.riskRate}/100`, 'log-fatal');
  addLog('METRICS', 'RCA', `Identified root culprit: ${state.activeIncident.epicenter}`, 'log-warn');
  addLog('CLOUD', 'ACTION', `Proposed remediation: ${state.activeIncident.action}`, 'log-info');

  // Reload SQLite audit ledger
  renderAuditTable();

  updateAutonomyActionUI();
}

async function executeRemediation(actor) {
  if (!state.activeIncident) return;
  const inc = state.activeIncident;
  const actionName = inc.action || inc.recommended_action || 'Automated Remediation';

  setNodesHealing();
  addLog('CLOUD', 'EXECUTE', `Applying fix: ${actionName}`, 'log-warn');

  // Call real FastAPI backend endpoint
  await apiFetch('/api/remediation/execute', {
    method: 'POST',
    body: JSON.stringify({
      incident_id: inc.id,
      action_name: actionName,
      risk_level: inc.riskLevelTag || 'MEDIUM',
      target_resource: inc.epicenter || 'Cluster',
      executed_by: actor, // 'AUTONOMOUS' or 'HYBRID' / 'MANUAL'
      duration_sec: state.incidentDurationSec
    })
  });

  setTimeout(() => {
    const actorLabel = actor === 'AUTONOMOUS' ? 'Full Autonomous (AI)' : 'Hybrid Autonomous (Mantavya)';
    addLog('METRICS', 'RESTORED', `Remediation successful! System restored in ${state.incidentDurationSec}s.`, 'log-success');

    savePIR(inc, actorLabel, state.incidentDurationSec);

    resetSystemToHealthy(true);
    document.getElementById('postIncidentResolvedCard').classList.remove('hidden');

    // Reload persistent SQLite audit ledger
    renderAuditTable();
  }, 1200);
}

function resetSystemToHealthy(justResolved = false) {
  clearInterval(state.incidentTimerInterval);
  clearInterval(state.autoHealInterval);

  state.activeIncident = null;
  state.clusterHealth = 'NOMINAL';
  state.correlatedIncidentsCount = 0;
  state.healthScore = 99.8;
  state.latencyMs = 32;
  state.activeServices = 5;
  updateMetrics();

  const statusText = document.getElementById('clusterStatusText');
  statusText.className = 'text-emerald-400 font-semibold flex items-center gap-1.5';
  statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> System Healthy';

  document.getElementById('incidentActiveBanner').classList.add('hidden');
  if (!justResolved) {
    document.getElementById('postIncidentResolvedCard').classList.add('hidden');
  }

  resetNodes();
  if (!justResolved) {
    state.twinFixApplied = false;
    const preemptBtn = document.getElementById('preemptiveFixBtn');
    if (preemptBtn) {
      preemptBtn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i> <span>⚡ Apply Preemptive Fix Now</span>';
      preemptBtn.className = 'w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5';
    }
    const metricProj = document.getElementById('metricProjectedPeak');
    if (metricProj) {
      metricProj.textContent = '38,900 req/s ⚠️';
      metricProj.className = 'font-mono text-sm text-rose-400';
    }
    const legendTag = document.getElementById('legendForecastTag');
    if (legendTag) {
      legendTag.className = 'flex items-center gap-1 text-rose-400';
      legendTag.innerHTML = '<span class="w-2.5 h-0.5 bg-rose-400 rounded"></span> Projected (+30m)';
    }
    const twinSliderEl = document.getElementById('twinSlider');
    if (twinSliderEl) {
      updateTwinSlider(twinSliderEl.value);
    }
    addLog('METRICS', 'SYSTEM', 'Cluster reset to baseline operating metrics.', 'log-info');
  }
}

function updateMetrics() {
  const hEl = document.getElementById('healthScoreVal');
  const lEl = document.getElementById('latencyVal');
  const sEl = document.getElementById('servicesCountVal');
  const cEl = document.getElementById('correlatedIncidentsCount');
  const mEl = document.getElementById('avgMttrVal');

  if (hEl) hEl.textContent = `${state.healthScore}%`;
  if (lEl) lEl.textContent = `${state.latencyMs} ms`;
  if (sEl) sEl.textContent = `${state.activeServices} / 5`;
  if (cEl) cEl.textContent = state.correlatedIncidentsCount;
  if (mEl && state.avgMttr) mEl.textContent = state.avgMttr;
}

// ============================================================================
// Clean Dependency Canvas (Interactive Node Map)
// ============================================================================
let canvas, ctx;
let serviceNodes = [
  { id: 'clients', label: 'Clients', x: 0.10, y: 0.5, status: 'healthy' },
  { id: 'gateway', label: 'API Gateway', x: 0.28, y: 0.5, status: 'healthy' },
  { id: 'auth', label: 'Auth Service (5002)', x: 0.50, y: 0.24, status: 'healthy' },
  { id: 'order', label: 'Order Service (5003)', x: 0.50, y: 0.50, status: 'healthy' },
  { id: 'payments', label: 'Payments (5001)', x: 0.50, y: 0.76, status: 'healthy' },
  { id: 'db', label: 'Database (ops_desk)', x: 0.82, y: 0.5, status: 'healthy' }
];
let serviceEdges = [
  { from: 'clients', to: 'gateway' },
  { from: 'gateway', to: 'auth' },
  { from: 'gateway', to: 'order' },
  { from: 'gateway', to: 'payments' },
  { from: 'order', to: 'payments' },
  { from: 'auth', to: 'db' },
  { from: 'payments', to: 'db' }
];

function initCanvas() {
  canvas = document.getElementById('topologyCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('mousemove', handleHover);
  canvas.addEventListener('mouseleave', () => {
    const tt = document.getElementById('canvasTooltip');
    if (tt) tt.classList.add('hidden');
  });

  // Click on node to open Node Inspector Drawer
  canvas.addEventListener('click', handleCanvasClick);

  requestAnimationFrame(drawCanvas);
}

function drawCanvas() {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Edges
  serviceEdges.forEach(e => {
    const from = serviceNodes.find(n => n.id === e.from);
    const to = serviceNodes.find(n => n.id === e.to);
    if (!from || !to) return;

    ctx.beginPath();
    ctx.moveTo(from.x * w, from.y * h);
    ctx.lineTo(to.x * w, to.y * h);

    if (from.status === 'root' || to.status === 'root') {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
    } else if (from.status === 'impacted' || to.status === 'impacted') {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
    } else {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
  });

  // Nodes
  serviceNodes.forEach(n => {
    const nx = n.x * w;
    const ny = n.y * h;
    const r = 20;

    ctx.beginPath();
    ctx.arc(nx, ny, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0c';
    ctx.fill();

    ctx.lineWidth = 2;
    if (n.status === 'root') {
      ctx.strokeStyle = '#f43f5e';
    } else if (n.status === 'impacted') {
      ctx.strokeStyle = '#f59e0b';
    } else if (n.status === 'healing') {
      ctx.strokeStyle = '#38bdf8';
    } else {
      ctx.strokeStyle = '#10b981';
    }
    ctx.stroke();

    // Inner Dot
    ctx.beginPath();
    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
    ctx.fillStyle = n.status === 'root' ? '#f43f5e' : (n.status === 'impacted' ? '#f59e0b' : (n.status === 'healing' ? '#38bdf8' : '#10b981'));
    ctx.fill();

    // Label
    ctx.font = '600 11px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, nx, ny + r + 14);
  });

  requestAnimationFrame(drawCanvas);
}

function handleHover(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const w = canvas.width;
  const h = canvas.height;

  let found = null;
  serviceNodes.forEach(n => {
    const dist = Math.hypot(mouseX - n.x * w, mouseY - n.y * h);
    if (dist <= 25) found = n;
  });

  const tt = document.getElementById('canvasTooltip');
  if (found) {
    tt.classList.remove('hidden');
    tt.style.left = `${mouseX + 12}px`;
    tt.style.top = `${mouseY - 10}px`;
    document.getElementById('tooltipTitle').textContent = found.label;
    document.getElementById('tooltipBody').innerHTML = `
      <div>Status: <span class="uppercase font-bold ${found.status === 'root' ? 'text-rose-400' : 'text-emerald-400'}">${found.status}</span></div>
      <div>Telemetry: CPU 24% | Memory 380MB</div>
    `;
  } else {
    tt.classList.add('hidden');
  }
}

function setNodeFailure(rootId, affectedIds) {
  serviceNodes.forEach(n => {
    if (n.id === rootId) n.status = 'root';
    else if (affectedIds.includes(n.id)) n.status = 'impacted';
    else n.status = 'healthy';
  });
}

function setNodesHealing() {
  serviceNodes.forEach(n => {
    if (n.status === 'root' || n.status === 'impacted') n.status = 'healing';
  });
}

function resetNodes() {
  serviceNodes.forEach(n => (n.status = 'healthy'));
}

// ============================================================================
// Interactive Node Inspector Drawer (Feature)
// ============================================================================
function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const w = canvas.width;
  const h = canvas.height;

  let clickedNode = null;
  serviceNodes.forEach(n => {
    const dist = Math.hypot(mouseX - n.x * w, mouseY - n.y * h);
    if (dist <= 26) clickedNode = n;
  });

  if (clickedNode) {
    openNodeInspector(clickedNode.id);
  }
}

const SERVICE_DETAILS = {
  db: {
    name: 'SQLite Database Store',
    meta: 'Runtime: SQLite 3.42 (WAL Mode) • Local Process',
    metric3Label: 'Active Locks & Tx:',
    healthy: {
      cpu: 24,
      ram: '410 MB / 2.0 GB',
      ramPercent: 20,
      metric3: '14 / 100 [NORMAL]',
      metric3Percent: 14,
      logs: [
        '[INFO] SQLite WAL checkpoint completed (0 pages pending)',
        '[INFO] Transaction committed: order #8492 persisted',
        '[INFO] Vacuum threshold verified: journal size 4.2 MB',
        '[INFO] Average query latency: 1.2ms on user_credentials'
      ]
    },
    failing: {
      cpu: 92,
      ram: '1.82 GB / 2.0 GB',
      ramPercent: 91,
      metric3: '100 / 100 [LOCK DEADLOCK]',
      metric3Percent: 100,
      logs: [
        '[FATAL] sqlite3.OperationalError: database is locked (busy_timeout > 5000ms)',
        '[ERROR] WAL checkpoint blocked by active reader deadlock in Auth pod',
        '[WARN] 48 queries queued awaiting exclusive transaction release',
        '[FATAL] Upstream checkout service received HTTP 500 on db write'
      ]
    }
  },
  auth: {
    name: 'Auth Service (Go Pod)',
    meta: 'Container: auth-pod-89a • Port: 8081',
    metric3Label: 'Token Validations:',
    healthy: {
      cpu: 28,
      ram: '480 MB / 2.0 GB',
      ramPercent: 24,
      metric3: '240 req / sec',
      metric3Percent: 32,
      logs: [
        '[INFO] JWT signature verified for session tk-9102',
        '[INFO] OAuth2 token refreshed successfully',
        '[INFO] GC pause duration: 1.8ms (within threshold)',
        '[INFO] Health probe /live returned 200 OK'
      ]
    },
    failing: {
      cpu: 96,
      ram: '1.98 GB / 2.0 GB',
      ramPercent: 99,
      metric3: '42 req / sec [THROTTLED]',
      metric3Percent: 95,
      logs: [
        '[FATAL] OOMKilled: container exceeded 2GB cgroup memory limit',
        '[ERROR] Memory buffer leak in session cache validation routine',
        '[WARN] Pod restart backoff triggered: 3 retries in 60s',
        '[ERROR] Unclosed database connection pool leak detected'
      ]
    }
  },
  gateway: {
    name: 'API Gateway (Envoy Proxy)',
    meta: 'Host: envoy-gateway-prod • Port: 443',
    metric3Label: 'Ingress Throughput:',
    healthy: {
      cpu: 22,
      ram: '340 MB / 1.0 GB',
      ramPercent: 34,
      metric3: '1,420 rps',
      metric3Percent: 28,
      logs: [
        '[INFO] Route matched: /api/v1/checkout -> payment-service',
        '[INFO] TLS session resumed with client 104.28.14.2',
        '[INFO] Upstream cluster healthy: all circuit breakers closed',
        '[INFO] Access log: 200 OK across 99.8% of requests'
      ]
    },
    failing: {
      cpu: 88,
      ram: '890 MB / 1.0 GB',
      ramPercent: 89,
      metric3: '45,200 rps [DDoS SURGE]',
      metric3Percent: 95,
      logs: [
        '[FATAL] Rate limit exceeded on route /api/v1/auth/login',
        '[WARN] IP cluster 185.220.0.0/16 triggering 429 Too Many Requests',
        '[ERROR] Downstream connection queue near capacity (9,800 sockets)',
        '[WARN] Upstream response latency exceeding 1,200ms'
      ]
    }
  },
  payments: {
    name: 'Payment Service (FastAPI)',
    meta: 'Container: pay-api-v2 • Port: 8082',
    metric3Label: 'Transactions Rate:',
    healthy: {
      cpu: 19,
      ram: '510 MB / 2.0 GB',
      ramPercent: 25,
      metric3: '42 tx / min',
      metric3Percent: 22,
      logs: [
        '[INFO] Payment intent #pi_9042 created with Stripe gateway',
        '[INFO] Webhook delivered: status charge.succeeded',
        '[INFO] SQLite balance query executed in 1.4ms',
        '[INFO] Zero failed transactions in last 15 minutes'
      ]
    },
    failing: {
      cpu: 65,
      ram: '980 MB / 2.0 GB',
      ramPercent: 49,
      metric3: '3 tx / min [STALLED]',
      metric3Percent: 85,
      logs: [
        '[ERROR] Timeout waiting for SQLite DB response (threshold 3000ms exceeded)',
        '[WARN] 38 payment intents queued awaiting database lock release',
        '[ERROR] HTTP 500 returned to checkout client: Internal Gateway Timeout',
        '[WARN] Circuit breaker tripped: state shifted to OPEN'
      ]
    }
  },
  clients: {
    name: 'Web & Mobile Clients',
    meta: 'CDN: Cloudflare Edge Network',
    metric3Label: 'Concurrent Users:',
    healthy: {
      cpu: 14,
      ram: '120 MB / 1.0 GB',
      ramPercent: 12,
      metric3: '650 Active Users',
      metric3Percent: 25,
      logs: [
        '[INFO] Edge cache hit ratio: 94.2%',
        '[INFO] WebSocket persistent connection established',
        '[INFO] Client page load time: 180ms P50',
        '[INFO] Zero reported client crash telemetry'
      ]
    },
    failing: {
      cpu: 45,
      ram: '280 MB / 1.0 GB',
      ramPercent: 28,
      metric3: '890 Retrying Users',
      metric3Percent: 75,
      logs: [
        '[WARN] Client received 500 Internal Server Error on /api/checkout',
        '[ERROR] Exponential backoff retry triggered on mobile app',
        '[WARN] User drop-off rate spiked to 34% in last 2 minutes',
        '[INFO] Client error beacon dispatched to telemetry collector'
      ]
    }
  }
};

let currentInspectedNode = null;

function openNodeInspector(nodeId) {
  currentInspectedNode = nodeId;
  const drawer = document.getElementById('nodeInspectorDrawer');
  const node = serviceNodes.find(n => n.id === nodeId);
  const data = SERVICE_DETAILS[nodeId] || SERVICE_DETAILS.db;
  if (!drawer || !node) return;

  const isFailing = node.status === 'root' || node.status === 'impacted';
  const vitals = isFailing ? data.failing : data.healthy;

  // Header
  document.getElementById('drawerServiceName').textContent = data.name;
  document.getElementById('drawerServiceMeta').textContent = data.meta;

  const statusBadge = document.getElementById('drawerServiceStatus');
  if (isFailing) {
    statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 uppercase';
    statusBadge.textContent = node.status === 'root' ? 'FAILING (EPICENTER)' : 'IMPACTED CASCADE';
  } else {
    statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase';
    statusBadge.textContent = 'HEALTHY';
  }

  // CPU
  document.getElementById('drawerCpuVal').textContent = `${vitals.cpu}%`;
  const cpuBar = document.getElementById('drawerCpuBar');
  cpuBar.style.width = `${vitals.cpu}%`;
  cpuBar.className = vitals.cpu > 80 ? 'bg-rose-500 h-full' : 'bg-sky-400 h-full';

  // RAM
  document.getElementById('drawerRamVal').textContent = vitals.ram;
  const ramBar = document.getElementById('drawerRamBar');
  ramBar.style.width = `${vitals.ramPercent}%`;
  ramBar.className = vitals.ramPercent > 80 ? 'bg-rose-500 h-full' : 'bg-emerald-400 h-full';

  // Metric 3
  document.getElementById('drawerMetric3Label').textContent = data.metric3Label;
  document.getElementById('drawerMetric3Val').textContent = vitals.metric3;
  const m3Bar = document.getElementById('drawerMetric3Bar');
  m3Bar.style.width = `${vitals.metric3Percent}%`;
  m3Bar.className = vitals.metric3Percent > 80 ? 'bg-rose-500 h-full' : 'bg-sky-400 h-full';

  // Logs
  const logsList = document.getElementById('drawerLogsList');
  logsList.innerHTML = vitals.logs.map(l => {
    const isErr = l.includes('[ERROR]') || l.includes('[FATAL]');
    const isWarn = l.includes('[WARN]');
    const color = isErr ? 'text-rose-400 font-semibold' : (isWarn ? 'text-amber-300' : 'text-slate-300');
    return `<div class="${color} py-0.5">${l}</div>`;
  }).join('');

  drawer.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeNodeInspector() {
  const drawer = document.getElementById('nodeInspectorDrawer');
  if (drawer) drawer.classList.add('hidden');
  currentInspectedNode = null;
}

function drawerActionRestart() {
  if (!currentInspectedNode) return;
  const node = serviceNodes.find(n => n.id === currentInspectedNode);
  addLog('CLOUD', 'POD_RESTART', `Initiated container pod restart for [${node.label}]`, 'log-warn');
  
  setTimeout(() => {
    addLog('CLOUD', 'POD_READY', `Container [${node.label}] restarted successfully. Vitals normalized.`, 'log-success');
    node.status = 'healthy';
    openNodeInspector(currentInspectedNode);
  }, 1000);
}

function drawerActionFlush() {
  if (!currentInspectedNode) return;
  const node = serviceNodes.find(n => n.id === currentInspectedNode);
  addLog('CLOUD', 'BUFFER_FLUSH', `Flushed memory cache & WAL journal for [${node.label}]`, 'log-info');
  
  setTimeout(() => {
    addLog('METRICS', 'FLUSH_DONE', `Buffer flushed for [${node.label}]. Locks released.`, 'log-success');
    node.status = 'healthy';
    openNodeInspector(currentInspectedNode);
  }, 800);
}

// ============================================================================
// Telemetry Logs & Activity Stream
// ============================================================================
const LOG_MESSAGES = [
  { source: 'METRICS', type: 'APM', msg: 'Database connection pool usage at 41%' },
  { source: 'LOGS', type: 'HTTP', msg: 'GET /api/v1/auth/session - 200 OK (22ms)' },
  { source: 'CLOUD', type: 'K8S', msg: 'Auth deployment pods: 3/3 ready' },
  { source: 'SECURITY', type: 'WAF', msg: 'Zero malicious requests in last 60s' },
  { source: 'METRICS', type: 'CPU', msg: 'Average node utilization: 31.4%' }
];

function addLog(source, type, msg, level = 'log-info') {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  state.logs.unshift({ time, source, type, msg, level });
  if (state.logs.length > 50) state.logs.pop();

  state.rawEventsCount++;
  const rawEl = document.getElementById('rawEventsCount');
  if (rawEl) rawEl.textContent = state.rawEventsCount.toLocaleString();

  renderLogs();
}

function renderLogs() {
  const feed = document.getElementById('telemetryFeed');
  if (!feed) return;

  const filtered = state.logFilter === 'ALL'
    ? state.logs
    : state.logs.filter(l => l.source === state.logFilter);

  feed.innerHTML = filtered.map(l => `
    <div class="flex items-start space-x-2 py-0.5 text-[11px]">
      <span class="text-slate-500 font-mono">${l.time}</span>
      <span class="px-1 rounded bg-[#182234] text-slate-300 font-bold text-[9px] uppercase">${l.source}</span>
      <span class="${l.level}">${l.msg}</span>
    </div>
  `).join('');
}

function filterLogs(cat) {
  state.logFilter = cat;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`filter${cat.charAt(0) + cat.slice(1).toLowerCase()}`);
  if (btn) btn.classList.add('active');
  renderLogs();
}

function clearLogs() {
  state.logs = [];
  renderLogs();
}

function startLogStream() {
  setInterval(() => {
    if (state.clusterHealth === 'NOMINAL') {
      const item = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      addLog(item.source, item.type, item.msg);
    }
  }, 2500);
}

// ============================================================================
// Digital Twin (Historical Traffic vs 30m Forecast Canvas Chart) [USP #1]
// ============================================================================
let twinCanvas, twinCtx;
let twinCanvasInitialized = false;
let twinHoverInfo = null;

function setTwinHistoryRange(hours) {
  state.twinHistoryHours = hours;
  const btn1 = document.getElementById('btnHist1h');
  const btn2 = document.getElementById('btnHist2h');
  const badge = document.getElementById('chartRangeBadge');
  const metricAvg = document.getElementById('metricPastAvg');
  const metricPeak = document.getElementById('metricPastPeak');

  if (hours === 1) {
    if (btn1) btn1.className = 'px-2.5 py-1 rounded text-[11px] font-bold transition bg-sky-500 text-black';
    if (btn2) btn2.className = 'px-2.5 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-white transition';
    if (badge) badge.textContent = 'Past 1h ➔ Future +30m';
    if (metricAvg) metricAvg.textContent = '14,250 req/s';
    if (metricPeak) metricPeak.textContent = '22,400 req/s';
  } else {
    if (btn2) btn2.className = 'px-2.5 py-1 rounded text-[11px] font-bold transition bg-sky-500 text-black';
    if (btn1) btn1.className = 'px-2.5 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-white transition';
    if (badge) badge.textContent = 'Past 2h ➔ Future +30m';
    if (metricAvg) metricAvg.textContent = '13,420 req/s';
    if (metricPeak) metricPeak.textContent = '24,100 req/s';
  }
  drawTwinTrafficChart();
}

function initTwinTrafficChart() {
  twinCanvas = document.getElementById('twinTrafficCanvas');
  if (!twinCanvas) return;
  twinCtx = twinCanvas.getContext('2d');

  function resizeTwin() {
    if (!twinCanvas || !twinCanvas.parentElement) return;
    twinCanvas.width = twinCanvas.parentElement.clientWidth;
    twinCanvas.height = twinCanvas.parentElement.clientHeight;
    drawTwinTrafficChart();
  }

  resizeTwin();

  if (!twinCanvasInitialized) {
    window.addEventListener('resize', resizeTwin);

    twinCanvas.addEventListener('mousemove', handleTwinChartHover);
    twinCanvas.addEventListener('mouseleave', () => {
      const tt = document.getElementById('twinChartTooltip');
      if (tt) tt.classList.add('hidden');
      twinHoverInfo = null;
      drawTwinTrafficChart();
    });

    twinCanvasInitialized = true;
  } else {
    drawTwinTrafficChart();
  }
}

function handleTwinChartHover(e) {
  if (!twinCanvas) return;
  const rect = twinCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const w = twinCanvas.width;
  const padLeft = 50;
  const padRight = 40;
  const chartW = w - padLeft - padRight;

  const hours = state.twinHistoryHours || 1;
  const histMins = hours * 60;
  const futureMins = 30;
  const totalMins = histMins + futureMins;

  const relX = mouseX - padLeft;
  if (relX < 0 || relX > chartW) {
    const tt = document.getElementById('twinChartTooltip');
    if (tt) tt.classList.add('hidden');
    twinHoverInfo = null;
    drawTwinTrafficChart();
    return;
  }

  const minute = -histMins + (relX / chartW) * totalMins;
  const roundedMin = Math.round(minute);
  const val = getTrafficValueAtMinute(roundedMin, histMins);

  twinHoverInfo = { x: mouseX, y: mouseY, min: roundedMin, val };

  const tt = document.getElementById('twinChartTooltip');
  if (tt) {
    tt.classList.remove('hidden');
    const tipX = Math.min(w - 150, Math.max(10, mouseX - 60));
    const tipY = Math.max(10, mouseY - 50);
    tt.style.left = `${tipX}px`;
    tt.style.top = `${tipY}px`;
    const label = roundedMin < 0 ? `${roundedMin}m (Past Recorded)` : (roundedMin === 0 ? 'NOW (Real-Time)' : `+${roundedMin}m (Projected)`);
    const statusTag = val >= 35000 ? '<span class="text-rose-400 font-bold">⚠️ BREACH</span>' : '<span class="text-emerald-400 font-bold">SAFE</span>';
    tt.innerHTML = `
      <div class="text-[10px] text-slate-400">${label}</div>
      <div class="font-bold text-white text-xs">${Math.round(val).toLocaleString()} req/s ${statusTag}</div>
    `;
  }
  drawTwinTrafficChart();
}

function getTrafficValueAtMinute(m, histMins) {
  if (m <= 0) {
    // Past recorded traffic
    const progress = (m + histMins) / histMins; // 0 at -histMins, 1 at 0
    const base = 13500 + Math.sin(m * 0.12) * 2600 + Math.cos(m * 0.25) * 1100 + progress * 6000;
    return Math.max(8000, base);
  } else {
    // Future forecast (0 to +30m)
    if (state.twinFixApplied) {
      // Stabilized after preemptive fix
      return 22000 - (m / 30) * 2800 + Math.sin(m * 0.2) * 400;
    } else {
      // Impending failure surge
      if (m <= 15) {
        return 22000 + (m / 15) * 16900 + Math.sin(m * 0.4) * 500;
      } else {
        return 38900 + ((m - 15) / 15) * 3500;
      }
    }
  }
}

function drawTwinTrafficChart() {
  if (!twinCtx || !twinCanvas) return;
  const ctx = twinCtx;
  const w = twinCanvas.width;
  const h = twinCanvas.height;

  ctx.clearRect(0, 0, w, h);

  const padLeft = 50;
  const padRight = 40;
  const padTop = 25;
  const padBottom = 30;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const hours = state.twinHistoryHours || 1;
  const histMins = hours * 60;
  const futureMins = 30;
  const totalMins = histMins + futureMins;

  const minVal = 0;
  const maxVal = 45000;
  const thresholdVal = 35000;

  function xForMin(m) {
    return padLeft + ((m + histMins) / totalMins) * chartW;
  }

  function yForVal(v) {
    return padTop + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  }

  // 1. Draw Grid Lines & Y-Axis Labels
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#181822';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';

  [10000, 20000, 30000, 40000].forEach(lvl => {
    const y = yForVal(lvl);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
    ctx.fillText(`${lvl / 1000}k`, padLeft - 8, y + 3.5);
  });

  // 2. Draw 35k Danger Threshold Line
  const threshY = yForVal(thresholdVal);
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padLeft, threshY);
  ctx.lineTo(padLeft + chartW, threshY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.fillText('POOL CAPACITY (35k)', padLeft + chartW, threshY - 5);

  // 3. Draw Vertical NOW (0m) Line
  const nowX = xForMin(0);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(nowX, padTop);
  ctx.lineTo(nowX, padTop + chartH);
  ctx.stroke();
  ctx.restore();

  // NOW Badge at top
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NOW', nowX, padTop - 8);

  // 4. Draw Historical Curve Area & Path (-histMins to 0)
  ctx.beginPath();
  ctx.moveTo(xForMin(-histMins), yForVal(0));
  for (let m = -histMins; m <= 0; m += 1) {
    const v = getTrafficValueAtMinute(m, histMins);
    ctx.lineTo(xForMin(m), yForVal(v));
  }
  ctx.lineTo(nowX, yForVal(0));
  ctx.closePath();

  const histGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  histGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  histGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = histGrad;
  ctx.fill();

  // Stroke Historical Line
  ctx.beginPath();
  for (let m = -histMins; m <= 0; m += 1) {
    const v = getTrafficValueAtMinute(m, histMins);
    if (m === -histMins) ctx.moveTo(xForMin(m), yForVal(v));
    else ctx.lineTo(xForMin(m), yForVal(v));
  }
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 5. Draw Future Forecast Curve Area & Path (0 to +30m)
  ctx.beginPath();
  ctx.moveTo(nowX, yForVal(0));
  for (let m = 0; m <= 30; m += 1) {
    const v = getTrafficValueAtMinute(m, histMins);
    ctx.lineTo(xForMin(m), yForVal(v));
  }
  ctx.lineTo(xForMin(30), yForVal(0));
  ctx.closePath();

  const futureGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  if (state.twinFixApplied) {
    futureGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    futureGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
  } else {
    futureGrad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
    futureGrad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
  }
  ctx.fillStyle = futureGrad;
  ctx.fill();

  // Stroke Future Forecast Line
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 2.5;
  if (state.twinFixApplied) {
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    for (let m = 0; m <= 30; m += 1) {
      const v = getTrafficValueAtMinute(m, histMins);
      if (m === 0) ctx.moveTo(xForMin(m), yForVal(v));
      else ctx.lineTo(xForMin(m), yForVal(v));
    }
    ctx.stroke();
  } else {
    for (let m = 0; m < 30; m += 1) {
      const v1 = getTrafficValueAtMinute(m, histMins);
      const v2 = getTrafficValueAtMinute(m + 1, histMins);
      ctx.beginPath();
      ctx.moveTo(xForMin(m), yForVal(v1));
      ctx.lineTo(xForMin(m + 1), yForVal(v2));
      ctx.strokeStyle = v2 >= 35000 ? '#f43f5e' : '#f59e0b';
      ctx.stroke();
    }
  }
  ctx.restore();

  // 6. Draw Breach Flag Marker if not fixed
  if (!state.twinFixApplied) {
    const breachM = 12;
    const breachX = xForMin(breachM);
    const breachY = yForVal(35200);

    ctx.beginPath();
    ctx.arc(breachX, breachY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚠️ Saturation Cliff (+12m)', breachX + 8, breachY - 8);
  }

  // 7. Time Slider Indicator Cursor (Active Offset)
  const sliderM = state.twinOffsetMins || 15;
  const sliderX = xForMin(sliderM);
  const sliderVal = getTrafficValueAtMinute(sliderM, histMins);
  const sliderY = yForVal(sliderVal);

  ctx.save();
  ctx.strokeStyle = state.twinFixApplied ? '#10b981' : (sliderVal >= 35000 ? '#f43f5e' : '#38bdf8');
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(sliderX, padTop);
  ctx.lineTo(sliderX, padTop + chartH);
  ctx.stroke();

  // Glow ring
  ctx.beginPath();
  ctx.arc(sliderX, sliderY, 6, 0, Math.PI * 2);
  ctx.fillStyle = state.twinFixApplied ? '#10b981' : (sliderVal >= 35000 ? '#f43f5e' : '#38bdf8');
  ctx.fill();
  ctx.restore();

  // Value Pill above cursor
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`+${sliderM}m: ${Math.round(sliderVal / 1000 * 10) / 10}k req/s`, sliderX, padTop + chartH - 8);

  // 8. X-Axis Time Tick Labels
  ctx.fillStyle = '#64748b';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';

  if (hours === 1) {
    [-60, -45, -30, -15, 0, 10, 20, 30].forEach(tick => {
      const tx = xForMin(tick);
      const label = tick === 0 ? '0m' : (tick > 0 ? `+${tick}m` : `${tick}m`);
      ctx.fillText(label, tx, padTop + chartH + 18);
    });
  } else {
    [-120, -90, -60, -30, 0, 10, 20, 30].forEach(tick => {
      const tx = xForMin(tick);
      const label = tick === 0 ? '0m' : (tick > 0 ? `+${tick}m` : `${tick}m`);
      ctx.fillText(label, tx, padTop + chartH + 18);
    });
  }

  // 9. If user is hovering, draw subtle vertical cursor
  if (twinHoverInfo) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(twinHoverInfo.x, padTop);
    ctx.lineTo(twinHoverInfo.x, padTop + chartH);
    ctx.stroke();
    ctx.restore();
  }
}

function updateTwinSlider(val) {
  state.twinOffsetMins = parseInt(val);
  document.getElementById('sliderOffsetVal').textContent = `+${val} Mins Ahead`;

  const box = document.getElementById('twinPredictionBox');
  const title = document.getElementById('twinAlertTitle');
  const desc = document.getElementById('twinAlertDesc');
  const risk = document.getElementById('twinRiskScore');

  if (val >= 10 && !state.twinFixApplied) {
    box.className = 'p-5 rounded-xl bg-gradient-to-br from-rose-950/20 to-[#182234] border border-rose-500/40 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
    title.textContent = `Database Pool Saturation Projected at +${val} Minutes`;
    desc.textContent = `Traffic extrapolation indicates checkout volume will exceed database pool limit in approximately ${val} minutes, triggering cascading HTTP 500 errors.`;
    risk.textContent = `${(80 + val * 0.8).toFixed(1)}%`;
  } else {
    box.className = 'p-5 rounded-xl bg-gradient-to-br from-emerald-950/20 to-[#182234] border border-emerald-500/30 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
    title.textContent = state.twinFixApplied 
      ? 'Projected Incident Successfully Neutralized!' 
      : `No Critical Outage Projected Within +${val} Minutes`;
    desc.textContent = state.twinFixApplied
      ? 'Database connection pool pre-scaled. Future forecast curve remains at 100% nominal health.'
      : `System capacity buffer is sufficient for currently anticipated traffic in this time window.`;
    risk.textContent = state.twinFixApplied ? '1.8%' : '8.5%';
  }

  // Redraw chart to update the slider position
  drawTwinTrafficChart();
}

async function applyPreemptiveFix() {
  state.twinFixApplied = true;

  const btn = document.getElementById('preemptiveFixBtn');
  btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Fix Applied Successfully!';
  btn.className = 'w-full py-2.5 rounded-lg bg-sky-500 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5';

  await apiFetch('/api/remediation/execute', {
    method: 'POST',
    body: JSON.stringify({
      incident_id: 'PREEMPT-01',
      action_name: 'Preemptively scaled DB pool +40 connections & warmed replicas',
      risk_level: 'LOW',
      target_resource: 'Database Pool',
      executed_by: 'Digital Twin (AI)',
      duration_sec: 1
    })
  });

  addLog('METRICS', 'PREEMPT', 'Preemptive mitigation applied! Predicted outage neutralized in advance.', 'log-success');

  const box = document.getElementById('twinPredictionBox');
  box.className = 'p-5 rounded-xl bg-gradient-to-br from-emerald-950/20 to-[#182234] border border-emerald-500/30 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
  document.getElementById('twinAlertTitle').textContent = 'Projected Incident Successfully Neutralized!';
  document.getElementById('twinAlertDesc').textContent = 'Database connection pool pre-scaled. Future forecast curve remains at 100% nominal health.';
  document.getElementById('twinRiskScore').textContent = '1.8%';

  const metricProj = document.getElementById('metricProjectedPeak');
  if (metricProj) {
    metricProj.textContent = '21,200 req/s [SAFE]';
    metricProj.className = 'font-mono text-sm text-emerald-400';
  }

  const legendTag = document.getElementById('legendForecastTag');
  if (legendTag) {
    legendTag.className = 'flex items-center gap-1 text-emerald-400';
    legendTag.innerHTML = '<span class="w-2.5 h-0.5 bg-emerald-400 rounded"></span> Projected (Safe)';
  }

  renderAuditTable();
  drawTwinTrafficChart();
}

// ============================================================================
// Auditable History Table
// ============================================================================
function recordAudit(id, source, actor, action, status) {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  state.auditHistory.unshift({ time, id, source, actor, action, status });
  renderAuditTable();
}

async function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  const backendData = await apiFetch('/api/audit-ledger');
  if (backendData && backendData.ledger && backendData.ledger.length > 0) {
    state.auditHistory = backendData.ledger.map(row => ({
      time: row.timestamp,
      id: row.event_id || `EVT-${row.id}`,
      source: row.source,
      actor: row.actor,
      action: row.action,
      status: row.status
    }));
  }

  tbody.innerHTML = state.auditHistory.map(r => `
    <tr class="hover:bg-[#182234]/40 transition">
      <td class="py-2.5 px-4 text-slate-400 font-mono">${r.time}</td>
      <td class="py-2.5 px-4 font-bold text-white">${r.id}</td>
      <td class="py-2.5 px-4"><span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">${r.source}</span></td>
      <td class="py-2.5 px-4 text-sky-400 font-medium">${r.actor}</td>
      <td class="py-2.5 px-4 text-slate-200">${r.action}</td>
      <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'RESOLVED' || r.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : (r.status === 'FLAGGED' || r.status === 'WARNING' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-sky-500/10 text-sky-400')}">${r.status}</span></td>
    </tr>
  `).join('');
}

function exportAuditJSON() {
  const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.auditHistory, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", str);
  a.setAttribute("download", `lithium_audit_${Date.now()}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ============================================================================
// PIR Reports & PDF Export [USP #2]
// ============================================================================
function generateInitialPIR() {
  state.reports.push({
    id: 'INC-8492',
    title: 'Database Connection Pool Exhaustion',
    mttd: '3.2s',
    mttr: '18.4s',
    slaProtection: '99.99%',
    actor: 'Lithium Engine'
  });
}

function savePIR(inc, actor, duration) {
  state.reports.unshift({
    id: inc.id,
    title: inc.title,
    severity: inc.severity || 'P1 CRITICAL',
    riskRate: inc.riskRate || 94,
    mttd: '3.2s',
    mttr: `${duration}s`,
    slaProtection: '99.99%',
    actor
  });
}

async function renderReports() {
  const el = document.getElementById('pirReportsList');
  if (!el) return;

  const backendPIRs = await apiFetch('/api/postmortem/reports');
  if (backendPIRs && backendPIRs.reports && backendPIRs.reports.length > 0) {
    state.reports = backendPIRs.reports.map(r => ({
      id: r.incident_id,
      title: r.title || `Incident ${r.incident_id} Report`,
      severity: 'P1 CRITICAL',
      riskRate: 94,
      mttd: '3.2s',
      mttr: r.resolved_time || '18.4s',
      slaProtection: '99.99%',
      actor: 'Lithium Engine',
      markdown: r.content_md
    }));
  }

  el.innerHTML = state.reports.map((r, idx) => `
    <div class="bg-[#182234] border border-slate-800 p-5 rounded-xl space-y-3">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded ${r.riskRate >= 90 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'} font-bold">${r.severity} • Risk: ${r.riskRate || 94}/100</span>
          <h3 class="font-bold text-white text-sm mt-1">${r.title}</h3>
          <div class="text-[11px] text-slate-400 font-mono mt-0.5">ID: ${r.id} • Resolved by ${r.actor}</div>
        </div>
        <button onclick="openPostMortemModal(${idx})" class="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition">
          View Report
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-center font-mono text-xs">
        <div><span class="text-[10px] text-slate-400 block">MTTD</span><strong class="text-sky-400">${r.mttd}</strong></div>
        <div><span class="text-[10px] text-slate-400 block">MTTR</span><strong class="text-emerald-400">${r.mttr}</strong></div>
      </div>
    </div>
  `).join('');
}

function openPostMortemModal(reportIdx = 0) {
  const modal = document.getElementById('postMortemModal');
  const report = state.reports[reportIdx] || state.reports[0];
  if (report) {
    document.getElementById('pirTitle').textContent = report.title;
  }
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closePostMortemModal() {
  document.getElementById('postMortemModal').classList.add('hidden');
}

function downloadPIRAsPDF() {
  const area = document.getElementById('pirPrintArea');
  if (!area || !window.jspdf) {
    window.print();
    return;
  }

  const { jsPDF } = window.jspdf;
  html2canvas(area, { scale: 2, backgroundColor: '#0b0f19' }).then(canvas => {
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('Lithium_PIR_INC-8492.pdf');
  }).catch(() => {
    window.print();
  });
}

// ============================================================================
// Live Server Telemetry Input Controller (Direct Screen Input)
// ============================================================================
function openDataInputModal() {
  const modal = document.getElementById('dataInputModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDataInputModal() {
  const modal = document.getElementById('dataInputModal');
  if (modal) modal.classList.add('hidden');
}

function syncRiskFromNum(val) {
  let num = parseInt(val);
  if (isNaN(num)) num = 1;
  num = Math.max(1, Math.min(100, num));
  
  const slider = document.getElementById('inputRiskSlider');
  if (slider) slider.value = num;

  const numInput = document.getElementById('inputRiskNum');
  if (numInput && parseInt(numInput.value) !== num) {
    numInput.value = num;
  }
}

function syncRiskFromSlider(val) {
  const numInput = document.getElementById('inputRiskNum');
  if (numInput) numInput.value = val;
}

function onFailingServiceChange(serviceId) {
  const riskNum = document.getElementById('inputRiskNum');
  const riskSlider = document.getElementById('inputRiskSlider');
  const latency = document.getElementById('inputLatency');
  const title = document.getElementById('inputIncidentTitle');
  const rootCause = document.getElementById('inputRootCause');
  const fix = document.getElementById('inputRecommendedFix');

  if (serviceId === 'db') {
    if (riskNum) riskNum.value = 94;
    if (riskSlider) riskSlider.value = 94;
    if (latency) latency.value = 1420;
    if (title) title.value = 'SQLite Database Transaction Lock';
    if (rootCause) rootCause.value = 'Commit #8f3a in Auth Service introduced an unclosed database transaction lock, causing SQLite busy timeout (> 5000ms).';
    if (fix) fix.value = 'Rollback commit #8f3a & clear SQLite WAL journal lock';
  } else if (serviceId === 'auth') {
    if (riskNum) riskNum.value = 78;
    if (riskSlider) riskSlider.value = 78;
    if (latency) latency.value = 840;
    if (title) title.value = 'Auth Pod Memory Leak (OOM Kill)';
    if (rootCause) rootCause.value = 'Token validation buffer leak exceeded container cgroup memory limits, triggering automatic pod evictions.';
    if (fix) fix.value = 'Restart Auth pods & scale deployment replicas to 4';
  } else if (serviceId === 'gateway') {
    if (riskNum) riskNum.value = 91;
    if (riskSlider) riskSlider.value = 91;
    if (latency) latency.value = 1650;
    if (title) title.value = 'API Gateway Volumetric Traffic Surge';
    if (rootCause) rootCause.value = 'Rate limit ceiling breached by 45,000 req/sec credential stuffing attack originating from suspicious IP cluster.';
    if (fix) fix.value = 'Apply WAF IP block rule & enable adaptive rate limiting';
  } else if (serviceId === 'payments') {
    if (riskNum) riskNum.value = 85;
    if (riskSlider) riskSlider.value = 85;
    if (latency) latency.value = 1120;
    if (title) title.value = 'Payment Service Circuit Breaker Tripped';
    if (rootCause) rootCause.value = 'Third-party payment gateway timeout cascade led to internal thread pool exhaustion.';
    if (fix) fix.value = 'Enable fallback queue & restart payment worker threads';
  } else if (serviceId === 'none') {
    if (riskNum) riskNum.value = 4;
    if (riskSlider) riskSlider.value = 4;
    if (latency) latency.value = 32;
    if (title) title.value = 'All Systems Nominal';
    if (rootCause) rootCause.value = 'None. System operating within baseline nominal parameters.';
    if (fix) fix.value = 'None required. Continuous automated monitoring active.';
  }
}

function loadNominalPreset() {
  const svcSelect = document.getElementById('inputFailingService');
  if (svcSelect) svcSelect.value = 'none';
  onFailingServiceChange('none');
}

async function applyCustomServerData() {
  const svcSelect = document.getElementById('inputFailingService');
  const serviceId = svcSelect ? svcSelect.value : 'db';

  let riskRate = parseInt(document.getElementById('inputRiskNum')?.value) || 50;
  riskRate = Math.max(1, Math.min(100, riskRate));

  const latency = parseInt(document.getElementById('inputLatency')?.value) || 60;
  const title = document.getElementById('inputIncidentTitle')?.value.trim() || 'Custom Telemetry Incident';
  const diagnosis = document.getElementById('inputRootCause')?.value.trim() || 'Custom anomaly injected from telemetry desk.';
  const action = document.getElementById('inputRecommendedFix')?.value.trim() || 'Execute automated remediation routine';

  // Close modal
  closeDataInputModal();

  // If set to nominal/healthy or risk is very low (< 25)
  if (serviceId === 'none' || riskRate <= 25) {
    if (state.activeIncident) {
      await apiFetch('/api/remediation/execute', {
        method: 'POST',
        body: JSON.stringify({
          incident_id: state.activeIncident.id,
          action_name: 'Reset to nominal telemetry baseline',
          executed_by: 'OPERATOR',
          duration_sec: state.incidentDurationSec
        })
      });
    }
    resetSystemToHealthy();
    addLog('METRICS', 'CUSTOM_SYNC', `Server data applied: Systems nominal (Risk: ${riskRate}/100, Latency: ${latency}ms)`, 'log-success');
    renderAuditTable();
    switchTab('dashboard');
    return;
  }

  // Determine Severity and Risk Label
  let severity = 'P1 CRITICAL';
  let riskLevelTag = 'EXTREME';
  if (riskRate >= 90) {
    severity = 'P1 CRITICAL';
    riskLevelTag = 'EXTREME';
  } else if (riskRate >= 75) {
    severity = 'P2 HIGH';
    riskLevelTag = 'HIGH RISK';
  } else {
    severity = 'P3 MEDIUM';
    riskLevelTag = 'ELEVATED';
  }

  // Map Service to Canvas Nodes & Epicenter Name
  let epicenter = 'SQLite Database (WAL)';
  let rootNode = 'db';
  let affectedNodes = ['db', 'auth', 'payments'];

  if (serviceId === 'db') {
    epicenter = 'SQLite Database (WAL)';
    rootNode = 'db';
    affectedNodes = ['db', 'auth', 'payments'];
  } else if (serviceId === 'auth') {
    epicenter = 'Auth Service';
    rootNode = 'auth';
    affectedNodes = ['auth', 'gateway'];
  } else if (serviceId === 'gateway') {
    epicenter = 'API Gateway';
    rootNode = 'gateway';
    affectedNodes = ['gateway', 'auth', 'payments'];
  } else if (serviceId === 'payments') {
    epicenter = 'Payment Service';
    rootNode = 'payments';
    affectedNodes = ['payments', 'db'];
  }

  const blastRadiusText = `Impact: ${affectedNodes.length} / 5 Services Affected`;
  const healthScore = Math.max(12, Math.round((100 - riskRate * 0.6) * 10) / 10);
  const incId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;

  const customIncident = {
    id: incId,
    title,
    severity,
    riskRate,
    riskLevelTag,
    blastRadiusText,
    epicenter,
    diagnosis,
    action,
    rootNode,
    affectedNodes,
    health: healthScore,
    latency
  };

  // 1. Send to real FastAPI Backend & SQLite
  await apiFetch('/api/digital-twin/chaos/inject', {
    method: 'POST',
    body: JSON.stringify({
      fault_type: 'CUSTOM',
      incident_id: incId,
      title: title,
      severity: severity,
      risk_rate: riskRate,
      risk_level_tag: riskLevelTag,
      epicenter: epicenter,
      diagnosis: diagnosis,
      recommended_action: action,
      root_node: rootNode,
      affected_nodes: affectedNodes,
      latency_ms: latency,
      health_score: healthScore
    })
  });

  // 2. Apply to State
  state.activeIncident = customIncident;
  state.clusterHealth = 'CRITICAL';
  state.correlatedIncidentsCount = 1;
  state.healthScore = healthScore;
  state.latencyMs = latency;
  state.activeServices = 5 - Math.max(1, affectedNodes.length - 1);
  state.incidentDurationSec = 0;

  updateMetrics();

  // Update Header Status
  const statusText = document.getElementById('clusterStatusText');
  if (statusText) {
    statusText.className = riskRate >= 90 ? 'text-rose-400 font-bold flex items-center gap-1.5' : 'text-amber-400 font-bold flex items-center gap-1.5';
    statusText.innerHTML = `<span class="w-2 h-2 rounded-full ${riskRate >= 90 ? 'bg-rose-500' : 'bg-amber-500'} animate-ping"></span> Critical Outage`;
  }

  // Update Banner UI
  const banner = document.getElementById('incidentActiveBanner');
  if (banner) banner.classList.remove('hidden');

  const resolvedCard = document.getElementById('postIncidentResolvedCard');
  if (resolvedCard) resolvedCard.classList.add('hidden');

  const titleEl = document.getElementById('incidentTitle');
  if (titleEl) titleEl.textContent = customIncident.title;

  const epicenterEl = document.getElementById('rcaEpicenter');
  if (epicenterEl) epicenterEl.textContent = customIncident.epicenter;

  const diagEl = document.getElementById('rcaDiagnosis');
  if (diagEl) diagEl.textContent = customIncident.diagnosis;

  const actionEl = document.getElementById('actionName');
  if (actionEl) actionEl.textContent = customIncident.action;

  // Badges & Risk Rate UI
  const sevBadge = document.getElementById('incidentSeverityBadge');
  if (sevBadge) {
    sevBadge.textContent = customIncident.severity;
    sevBadge.className = riskRate >= 90 
      ? 'px-3 py-1 rounded bg-rose-500 text-black text-xs font-black font-mono'
      : 'px-3 py-1 rounded bg-amber-500 text-black text-xs font-black font-mono';
  }

  const blastEl = document.getElementById('incidentBlastRadius');
  if (blastEl) blastEl.textContent = customIncident.blastRadiusText;

  const riskNumEl = document.getElementById('riskRateNum');
  if (riskNumEl) riskNumEl.textContent = customIncident.riskRate;

  const riskTagEl = document.getElementById('riskLevelTag');
  if (riskTagEl) {
    riskTagEl.textContent = customIncident.riskLevelTag;
    riskTagEl.className = riskRate >= 90
      ? 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 ml-1.5'
      : 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 ml-1.5';
  }

  const riskBarEl = document.getElementById('riskRateBar');
  if (riskBarEl) {
    riskBarEl.style.width = `${customIncident.riskRate}%`;
    riskBarEl.className = riskRate >= 90 ? 'bg-rose-500 h-full' : 'bg-amber-500 h-full';
  }

  // Duration Timer
  clearInterval(state.incidentTimerInterval);
  state.incidentTimerInterval = setInterval(() => {
    state.incidentDurationSec++;
    const mins = String(Math.floor(state.incidentDurationSec / 60)).padStart(2, '0');
    const secs = String(state.incidentDurationSec % 60).padStart(2, '0');
    const durEl = document.getElementById('incidentDuration');
    if (durEl) durEl.textContent = `${mins}:${secs}`;
  }, 1000);

  // Set Canvas Topology Node Failures
  setNodeFailure(customIncident.rootNode, customIncident.affectedNodes);

  // Stream Live Telemetry Logs
  addLog('LOGS', 'CRITICAL', `[${customIncident.severity}] ${customIncident.title} injected! Risk: ${customIncident.riskRate}/100`, riskRate >= 90 ? 'log-fatal' : 'log-warn');
  addLog('METRICS', 'RCA', `Culprit Node: ${customIncident.epicenter}`, 'log-warn');
  addLog('CLOUD', 'ACTION', `Auto-playbook generated: ${customIncident.action}`, 'log-info');

  // Reload SQLite audit ledger
  renderAuditTable();

  // Autonomy action flow (Countdown for Full Autonomous, or Manual Button for Hybrid)
  updateAutonomyActionUI();

  // Make sure we are on dashboard tab to see map and banner
  switchTab('dashboard');
}

// Close modal on Escape key press
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDataInputModal();
    closePostMortemModal();
  }
});

