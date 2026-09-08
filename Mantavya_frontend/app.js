/**
 * Lithium — Autonomous Operations Platform
 * Clean, lightweight reactive frontend engine
 */

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
  renderAuditTable();
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
  } else if (tabId === 'reports') {
    document.getElementById('tabReports').classList.add('active');
    document.getElementById('viewReports').classList.remove('hidden');
    renderReports();
  }
}

// ============================================================================
// Autonomy Mode Switcher (Co-Pilot vs Auto-Pilot)
// ============================================================================
function setAutonomyMode(mode) {
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
    epicenter: 'PostgreSQL Database',
    diagnosis: 'Commit #8f3a in Auth Service introduced an unclosed database connection leak, saturating the connection pool limit (100/100).',
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
    title: 'API Gateway Volumetric Traffic Surge',
    severity: 'P1 CRITICAL',
    riskRate: 91,
    riskLevelTag: 'CRITICAL',
    blastRadiusText: 'Impact: 2 / 5 Services Affected',
    epicenter: 'API Gateway',
    diagnosis: 'Rate limit ceiling breached by 45,000 req/sec credential stuffing attack originating from suspicious IP cluster.',
    action: 'Apply WAF IP block rule & enable adaptive rate limiting',
    rootNode: 'gateway',
    affectedNodes: ['gateway', 'auth'],
    health: 65.0,
    latency: 1650
  }
};

function triggerOutage(type) {
  const scenario = OUTAGES[type];
  if (!scenario) return;

  state.activeIncident = scenario;
  state.clusterHealth = 'CRITICAL';
  state.correlatedIncidentsCount = 1;
  state.healthScore = scenario.health;
  state.latencyMs = scenario.latency;
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
  document.getElementById('incidentTitle').textContent = scenario.title;
  document.getElementById('rcaEpicenter').textContent = scenario.epicenter;
  document.getElementById('rcaDiagnosis').textContent = scenario.diagnosis;
  document.getElementById('actionName').textContent = scenario.action;

  // Update Critical Level & 1-100 Risk Rate Indicators
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

  const riskTagEl = document.getElementById('riskLevelTag');
  if (riskTagEl) {
    riskTagEl.textContent = scenario.riskLevelTag;
    riskTagEl.className = scenario.riskRate >= 90
      ? 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 ml-1.5'
      : 'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 ml-1.5';
  }

  const riskBarEl = document.getElementById('riskRateBar');
  if (riskBarEl) {
    riskBarEl.style.width = `${scenario.riskRate}%`;
    riskBarEl.className = scenario.riskRate >= 90 ? 'bg-rose-500 h-full' : 'bg-amber-500 h-full';
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
  addLog('LOGS', 'CRITICAL', `[${scenario.severity}] ${scenario.title} detected! Risk Rate: ${scenario.riskRate}/100`, 'log-fatal');
  addLog('METRICS', 'RCA', `Identified root culprit: ${scenario.epicenter}`, 'log-warn');
  addLog('CLOUD', 'ACTION', `Proposed remediation: ${scenario.action}`, 'log-info');

  // Record Audit
  recordAudit(scenario.id, 'LOGS', 'AI Correlator', `Identified failure in ${scenario.epicenter} (Risk: ${scenario.riskRate}/100)`, 'FLAGGED');

  updateAutonomyActionUI();
}

function executeRemediation(actor) {
  if (!state.activeIncident) return;
  const inc = state.activeIncident;

  setNodesHealing();
  addLog('CLOUD', 'EXECUTE', `Applying fix: ${inc.action}`, 'log-warn');

  setTimeout(() => {
    const actorLabel = actor === 'AUTONOMOUS' ? 'Full Autonomous (AI)' : 'Hybrid Autonomous (Mantavya)';
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
  if (!justResolved) {
    addLog('METRICS', 'SYSTEM', 'Cluster reset to baseline operating metrics.', 'log-info');
  }
}

function updateMetrics() {
  document.getElementById('healthScoreVal').textContent = `${state.healthScore}%`;
  document.getElementById('latencyVal').textContent = `${state.latencyMs} ms`;
  document.getElementById('servicesCountVal').textContent = `${state.activeServices} / 5`;
  document.getElementById('correlatedIncidentsCount').textContent = state.correlatedIncidentsCount;
}

// ============================================================================
// Clean Dependency Canvas (Interactive Node Map)
// ============================================================================
let canvas, ctx;
let serviceNodes = [
  { id: 'clients', label: 'Clients', x: 0.12, y: 0.5, status: 'healthy' },
  { id: 'gateway', label: 'API Gateway', x: 0.32, y: 0.5, status: 'healthy' },
  { id: 'auth', label: 'Auth Service', x: 0.56, y: 0.3, status: 'healthy' },
  { id: 'payments', label: 'Payments', x: 0.56, y: 0.7, status: 'healthy' },
  { id: 'db', label: 'PostgreSQL DB', x: 0.84, y: 0.5, status: 'healthy' }
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

  canvas.addEventListener('mousemove', handleHover);
  canvas.addEventListener('mouseleave', () => {
    const tt = document.getElementById('canvasTooltip');
    if (tt) tt.classList.add('hidden');
  });

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
// Digital Twin (Time Slider & Preemptive Fix) [USP #1]
// ============================================================================
function updateTwinSlider(val) {
  state.twinOffsetMins = parseInt(val);
  document.getElementById('sliderOffsetVal').textContent = `+${val} Mins Ahead`;

  const box = document.getElementById('twinPredictionBox');
  const title = document.getElementById('twinAlertTitle');
  const desc = document.getElementById('twinAlertDesc');
  const risk = document.getElementById('twinRiskScore');

  if (val >= 10) {
    box.className = 'p-5 rounded-xl bg-gradient-to-br from-rose-950/20 to-[#182234] border border-rose-500/40 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
    title.textContent = `Database Pool Saturation Projected at +${val} Minutes`;
    desc.textContent = `Traffic extrapolation indicates checkout volume will exceed database pool limit in approximately ${val} minutes, triggering cascading HTTP 500 errors.`;
    risk.textContent = `${(80 + val * 0.8).toFixed(1)}%`;
  } else {
    box.className = 'p-5 rounded-xl bg-gradient-to-br from-emerald-950/20 to-[#182234] border border-emerald-500/30 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
    title.textContent = `No Critical Outage Projected Within +${val} Minutes`;
    desc.textContent = `System capacity buffer is sufficient for currently anticipated traffic in this time window.`;
    risk.textContent = '8.5%';
  }
}

function applyPreemptiveFix() {
  const btn = document.getElementById('preemptiveFixBtn');
  btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Fix Applied Successfully!';
  btn.className = 'w-full py-2.5 rounded-lg bg-sky-500 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5';

  recordAudit('PREEMPT-1', 'METRICS', 'Digital Twin', 'Preemptively scaled DB pool +40 connections & warmed replicas', 'PREVENTED');
  addLog('METRICS', 'PREEMPT', 'Preemptive mitigation applied! Predicted outage neutralized in advance.', 'log-success');

  const box = document.getElementById('twinPredictionBox');
  box.className = 'p-5 rounded-xl bg-gradient-to-br from-emerald-950/20 to-[#182234] border border-emerald-500/30 grid grid-cols-1 md:grid-cols-12 gap-6 items-center';
  document.getElementById('twinAlertTitle').textContent = 'Projected Incident Successfully Neutralized!';
  document.getElementById('twinAlertDesc').textContent = 'Database connection pool pre-scaled. Future forecast curve remains at 100% nominal health.';
  document.getElementById('twinRiskScore').textContent = '1.8%';
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

function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.auditHistory.map(r => `
    <tr class="hover:bg-[#182234]/40 transition">
      <td class="py-2.5 px-4 text-slate-400 font-mono">${r.time}</td>
      <td class="py-2.5 px-4 font-bold text-white">${r.id}</td>
      <td class="py-2.5 px-4"><span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">${r.source}</span></td>
      <td class="py-2.5 px-4 text-sky-400 font-medium">${r.actor}</td>
      <td class="py-2.5 px-4 text-slate-200">${r.action}</td>
      <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'RESOLVED' || r.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/10 text-sky-400'}">${r.status}</span></td>
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
    costSaved: '~$34,000',
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
    costSaved: '~$34,000',
    actor
  });
}

function renderReports() {
  const el = document.getElementById('pirReportsList');
  if (!el) return;

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
      <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center font-mono text-xs">
        <div><span class="text-[10px] text-slate-400 block">MTTD</span><strong class="text-sky-400">${r.mttd}</strong></div>
        <div><span class="text-[10px] text-slate-400 block">MTTR</span><strong class="text-emerald-400">${r.mttr}</strong></div>
        <div><span class="text-[10px] text-slate-400 block">Cost Saved</span><strong class="text-white">${r.costSaved}</strong></div>
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
