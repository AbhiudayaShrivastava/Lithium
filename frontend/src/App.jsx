/**
 * Lithium — Autonomous Operations Platform
 * FastAPI Live Integrated Engine
 */

const API_BASE = "http://localhost:8000";

const state = {
  autonomyMode: 'COPILOT',
  clusterHealth: 'NOMINAL',
  currentTab: 'dashboard',

  healthScore: 99.8,
  activeServices: 5,
  totalServices: 5,
  latencyMs: 32,
  rawEventsCount: 1248,
  correlatedIncidentsCount: 0,

  activeIncident: null,
  incidentDurationSec: 0,
  incidentTimerInterval: null,
  autoHealInterval: null,

  logs: [],
  logFilter: 'ALL',
  twinOffsetMins: 15,

  auditHistory: [],
  reports: []
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  startClock();
  initCanvas();
  fetchInitialState();
  initTelemetrySSE();
});

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

async function fetchInitialState() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    state.healthScore = data.kpis.system_health_pct;
    updateMetrics();

    const nodesRes = await fetch(`${API_BASE}/api/v1/nodes`);
    const nodes = await nodesRes.json();
    if (nodes && nodes.length) {
      serviceNodes = nodes;
    }

    const auditRes = await fetch(`${API_BASE}/api/audit-ledger`);
    const auditData = await auditRes.json();
    state.auditHistory = auditData.ledger.map(a => ({
      time: new Date().toTimeString().split(' ')[0],
      id: a.incident_id,
      source: 'FASTAPI',
      actor: a.operator,
      action: a.action,
      status: a.status
    }));
    renderAuditTable();
  } catch (e) {
    console.warn("Backend offline, running fallback state.", e);
  }
}

function initTelemetrySSE() {
  const eventSource = new EventSource(`${API_BASE}/api/v1/telemetry/stream`);
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    state.latencyMs = Math.round(data.latency);
    if (state.clusterHealth === 'NOMINAL') {
      state.healthScore = Math.max(80, 100 - Math.round(data.cpu * 0.2));
      updateMetrics();
    }
    addLog('METRICS', 'CPU', `Live stream telemetry: CPU ${data.cpu}% | Latency ${data.latency}ms`);
  };
}

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
  } else if (tabId === 'reports') {
    document.getElementById('tabReports').classList.add('active');
    document.getElementById('viewReports').classList.remove('hidden');
    renderReports();
  }
}

async function setAutonomyMode(mode) {
  state.autonomyMode = mode;
  const copilotBtn = document.getElementById('modeCopilotBtn');
  const autonomousBtn = document.getElementById('modeAutonomousBtn');

  const killSwitchActive = (mode === 'COPILOT');
  await fetch(`${API_BASE}/api/system/kill-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kill_switch_active: killSwitchActive })
  });

  if (mode === 'COPILOT') {
    copilotBtn.classList.add('active');
    autonomousBtn.classList.remove('active');
    addLog('SECURITY', 'MODE', 'Switched to [Hybrid Autonomous] mode. Manual approval required.');
  } else {
    autonomousBtn.classList.add('active');
    copilotBtn.classList.remove('active');
    addLog('SECURITY', 'MODE', 'Switched to [Full Autonomous] mode. Self-healing armed.');
  }

  if (state.activeIncident) updateAutonomyActionUI();
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

const OUTAGES = {
  DB_LOCK: {
    id: 'INC-8492',
    title: 'Database Connection Pool Exhaustion',
    severity: 'P1 CRITICAL',
    riskRate: 94,
    riskLevelTag: 'EXTREME',
    blastRadiusText: 'Impact: 3 / 5 Services Affected',
    epicenter: 'PostgreSQL Database',
    diagnosis: 'Commit #8f3a in Auth Service introduced an unclosed database connection leak.',
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
    diagnosis: 'Token validation buffer leak exceeded container cgroup memory limits.',
    action: 'Restart Auth pods & scale deployment replicas to 4',
    rootNode: 'auth',
    affectedNodes: ['auth', 'gateway'],
    health: 58.2,
    latency: 840
  },
  DDOS_SURGE: {
    id: 'INC-7104',
    title: 'API Gateway Volumetric Traffic Surge',
    severity: 'P1 CRITICAL',
    riskRate: 91,
    riskLevelTag: 'CRITICAL',
    blastRadiusText: 'Impact: 2 / 5 Services Affected',
    epicenter: 'API Gateway',
    diagnosis: 'Rate limit ceiling breached by credential stuffing attack.',
    action: 'Apply WAF IP block rule & enable adaptive rate limiting',
    rootNode: 'gateway',
    affectedNodes: ['gateway', 'auth'],
    health: 65.0,
    latency: 1650
  }
};

async function triggerOutage(type) {
  const scenario = OUTAGES[type];
  if (!scenario) return;

  await fetch(`${API_BASE}/api/digital-twin/chaos/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault_type: type, target_service: scenario.epicenter })
  });

  state.activeIncident = scenario;
  state.clusterHealth = 'CRITICAL';
  state.correlatedIncidentsCount = 1;
  state.healthScore = scenario.health;
  state.latencyMs = scenario.latency;
  state.activeServices = 3;
  state.incidentDurationSec = 0;

  updateMetrics();

  const statusText = document.getElementById('clusterStatusText');
  statusText.className = 'text-rose-400 font-bold flex items-center gap-1.5';
  statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Critical Outage';

  document.getElementById('incidentActiveBanner').classList.remove('hidden');
  document.getElementById('postIncidentResolvedCard').classList.add('hidden');
  document.getElementById('incidentTitle').textContent = scenario.title;
  document.getElementById('rcaEpicenter').textContent = scenario.epicenter;
  document.getElementById('rcaDiagnosis').textContent = scenario.diagnosis;
  document.getElementById('actionName').textContent = scenario.action;

  const sevBadge = document.getElementById('incidentSeverityBadge');
  if (sevBadge) {
    sevBadge.textContent = scenario.severity;
    sevBadge.className = scenario.riskRate >= 90 
      ? 'px-3 py-1 rounded bg-rose-500 text-black text-xs font-black font-mono'
      : 'px-3 py-1 rounded bg-amber-500 text-black text-xs font-black font-mono';
  }

  const blastEl = document.getElementById('incidentBlastRadius');
  if (blastEl) blastEl.textContent = scenario.blastRadiusText;

  const riskNumEl = document.getElementById('riskRateNum');
  if (riskNumEl) riskNumEl.textContent = scenario.riskRate;

  clearInterval(state.incidentTimerInterval);
  state.incidentTimerInterval = setInterval(() => {
    state.incidentDurationSec++;
    const mins = String(Math.floor(state.incidentDurationSec / 60)).padStart(2, '0');
    const secs = String(state.incidentDurationSec % 60).padStart(2, '0');
    const durEl = document.getElementById('incidentDuration');
    if (durEl) durEl.textContent = `${mins}:${secs}`;
  }, 1000);

  setNodeFailure(scenario.rootNode, scenario.affectedNodes);

  addLog('LOGS', 'CRITICAL', `[${scenario.severity}] ${scenario.title} detected!`, 'log-fatal');
  addLog('METRICS', 'RCA', `Identified root culprit: ${scenario.epicenter}`, 'log-warn');

  updateAutonomyActionUI();
}

async function executeRemediation(actor) {
  if (!state.activeIncident) return;
  const inc = state.activeIncident;

  setNodesHealing();
  addLog('CLOUD', 'EXECUTE', `Applying fix: ${inc.action}`, 'log-warn');

  try {
    await fetch(`${API_BASE}/api/remediation/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: inc.id,
        action_name: inc.action,
        risk_level: inc.riskRate >= 90 ? 'HIGH' : 'LOW',
        target_resource: inc.epicenter,
        executed_by: actor === 'AUTONOMOUS' ? 'AI_AUTONOMOUS' : 'HUMAN_OPERATOR'
      })
    });
  } catch (e) {
    console.error("Failed to execute remediation on backend", e);
  }

  setTimeout(() => {
    const actorLabel = actor === 'AUTONOMOUS' ? 'Full Autonomous (AI)' : 'Hybrid Autonomous (Human)';
    addLog('METRICS', 'RESTORED', `Remediation successful! System restored in ${state.incidentDurationSec}s.`, 'log-success');

    recordAudit(inc.id, 'CLOUD', actorLabel, `Executed: ${inc.action}`, 'RESOLVED');
    savePIR(inc, actorLabel, state.incidentDurationSec);

    resetSystemToHealthy(true);
    document.getElementById('postIncidentResolvedCard').classList.remove('hidden');
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
}

function updateMetrics() {
  document.getElementById('healthScoreVal').textContent = `${state.healthScore}%`;
  document.getElementById('latencyVal').textContent = `${state.latencyMs} ms`;
  document.getElementById('servicesCountVal').textContent = `${state.activeServices} / 5`;
  document.getElementById('correlatedIncidentsCount').textContent = state.correlatedIncidentsCount;
}

let canvas, ctx;
let serviceNodes = [
  { id: 'clients', label: 'Clients', x: 0.12, y: 0.5, status: 'healthy' },
  { id: 'gateway', label: 'API Gateway', x: 0.32, y: 0.5, status: 'healthy' },
  { id: 'auth', label: 'Auth Service', x: 0.56, y: 0.3, status: 'healthy' },
  { id: 'payments', label: 'Payments', x: 0.56, y: 0.7, status: 'healthy' },
  { id: 'db', label: 'SQLite DB', x: 0.84, y: 0.5, status: 'healthy' }
];
let serviceEdges = [
  { from: 'clients', to: 'gateway' },
  { from: 'gateway', to: 'auth' },
  { from: 'gateway', to: 'payments' },
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
  requestAnimationFrame(drawCanvas);
}

function drawCanvas() {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  serviceEdges.forEach(e => {
    const from = serviceNodes.find(n => n.id === e.from);
    const to = serviceNodes.find(n => n.id === e.to);
    if (!from || !to) return;

    ctx.beginPath();
    ctx.moveTo(from.x * w, from.y * h);
    ctx.lineTo(to.x * w, to.y * h);
    ctx.strokeStyle = (from.status === 'root' || to.status === 'root') ? '#f43f5e' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  serviceNodes.forEach(n => {
    const nx = n.x * w;
    const ny = n.y * h;
    ctx.beginPath();
    ctx.arc(nx, ny, 18, 0, Math.PI * 2);
    ctx.fillStyle = n.status === 'root' ? '#f43f5e' : (n.status === 'impacted' ? '#f59e0b' : '#10b981');
    ctx.fill();

    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, nx, ny + 32);
  });

  requestAnimationFrame(drawCanvas);
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

function addLog(source, type, msg, level = 'log-info') {
  const time = new Date().toTimeString().split(' ')[0];
  state.logs.unshift({ time, source, type, msg, level });
  if (state.logs.length > 50) state.logs.pop();
  renderLogs();
}

function renderLogs() {
  const feed = document.getElementById('telemetryFeed');
  if (!feed) return;
  feed.innerHTML = state.logs.map(l => `
    <div class="flex items-start space-x-2 py-0.5 text-[11px]">
      <span class="text-slate-500 font-mono">${l.time}</span>
      <span class="px-1 rounded bg-[#182234] text-slate-300 font-bold uppercase">${l.source}</span>
      <span class="${l.level}">${l.msg}</span>
    </div>
  `).join('');
}

function recordAudit(id, source, actor, action, status) {
  const time = new Date().toTimeString().split(' ')[0];
  state.auditHistory.unshift({ time, id, source, actor, action, status });
  renderAuditTable();
}

function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;
  tbody.innerHTML = state.auditHistory.map(r => `
    <tr class="hover:bg-[#182234]/40 transition">
      <td class="py-2.5 px-4 text-slate-400 font-mono">${r.time}</td>
      <td class="py-2.5 px-4 font-bold text-white">${r.id}</td>
      <td class="py-2.5 px-4"><span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">${r.source}</span></td>
      <td class="py-2.5 px-4 text-sky-400 font-medium">${r.actor}</td>
      <td class="py-2.5 px-4 text-slate-200">${r.action}</td>
      <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}">${r.status}</span></td>
    </tr>
  `).join('');
}

function savePIR(inc, actor, duration) {
  state.reports.unshift({
    id: inc.id,
    title: inc.title,
    severity: inc.severity,
    riskRate: inc.riskRate,
    mttd: '3.2s',
    mttr: `${duration}s`,
    costSaved: '~$34,000',
    actor
  });
}

function renderReports() {
  const el = document.getElementById('pirReportsList');
  if (!el) return;
  el.innerHTML = state.reports.map((r) => `
    <div class="bg-[#182234] border border-slate-800 p-5 rounded-xl space-y-3">
      <h3 class="font-bold text-white text-sm">${r.title}</h3>
      <div class="text-[11px] text-slate-400 font-mono">ID: ${r.id} • Resolved by ${r.actor}</div>
    </div>
  `).join('');
}