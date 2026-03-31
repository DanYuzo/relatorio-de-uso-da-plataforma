import JSZip from 'jszip';
import type { ParsedDataset } from '../types/csv';
import type { DashboardMetrics } from '../types/metrics';
import { buildCompanyFirstEmailMap, buildRecipientMap, hasRecipientColumn, filterByEmpresa } from '../services/csvParser';
import { computeMetrics } from '../services/metricsComputer';
import { formatTimestamp } from '../utils/dateHelpers';
import { toISODay } from '../utils/dateHelpers';

/**
 * Builds compact raw access/conclusion arrays for embedding in exported HTML.
 * Uses short keys (e/d) to minimize file size.
 */
function buildRawEmbedData(companyData: ParsedDataset) {
  const rawAcessos = companyData.acessos
    .filter((a) => a.Email && a.Data)
    .map((a) => ({ e: a.Email!.toLowerCase(), d: toISODay(a.Data) }))
    .filter((a) => a.d);

  const rawConclusoes = companyData.conclusoes
    .filter((c) => c.Email && c['Data de conclusão'])
    .map((c) => ({ e: c.Email!.toLowerCase(), d: toISODay(c['Data de conclusão']) }))
    .filter((c) => c.d);

  return { rawAcessos, rawConclusoes };
}

/**
 * Generates a branded HTML dashboard for a single company.
 * Includes client-side date period filtering with 6 presets + custom range.
 */
export function generateCompanyHTML(
  empresa: string,
  metrics: DashboardMetrics,
  companyData: ParsedDataset,
): string {
  const usersMap: Record<string, unknown> = {};
  metrics.usuariosTabela.forEach(u => {
    usersMap[u.email] = u;
  });
  const embeddedUserData = JSON.stringify(usersMap);
  const embeddedProgressData = JSON.stringify(metrics.progressoPorConteudo);
  const { rawAcessos, rawConclusoes } = buildRawEmbedData(companyData);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Dashboard — ${empresa}</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
        --color-bg: #031A2B;
        --color-card: #123F5B;
        --color-gold: #FFDA71;
        --color-text: #EDF4F7;
        --color-text-dim: rgba(237,244,247,0.5);
    }
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Manrope',system-ui,sans-serif;background:var(--color-bg);color:var(--color-text);line-height:1.6;-webkit-font-smoothing:antialiased;}

    .container{max-width:1100px;margin:0 auto;padding:20px 16px;}

    .header{text-align:center;padding:32px 0 24px;border-bottom:1px solid rgba(255,218,113,0.12);margin-bottom:24px;}
    .header h1{font-size:clamp(1.25rem,4vw,1.75rem);font-weight:800;background:linear-gradient(135deg,#CA9A43,#FFDA71,#FFE39B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .header p{font-size:14px;color:var(--color-text-dim);margin-top:4px;}

    /* Period Filter */
    .period-filter-bar{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;}
    .period-pills{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;-ms-overflow-style:none;scrollbar-width:none;}
    .period-pills::-webkit-scrollbar{display:none;}
    .period-pill{white-space:nowrap;padding:6px 14px;border-radius:9999px;font-size:12px;font-weight:500;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(237,244,247,0.5);cursor:pointer;transition:all 0.2s;font-family:inherit;}
    .period-pill:hover{border-color:rgba(255,255,255,0.25);color:rgba(237,244,247,0.7);}
    .period-pill.active{background:rgba(255,218,113,0.15);color:#FFDA71;border-color:rgba(255,218,113,0.4);}
    .custom-date-row{display:none;align-items:center;gap:8px;flex-wrap:wrap;}
    .custom-date-row.visible{display:flex;}
    .custom-date-row label{font-size:12px;color:rgba(237,244,247,0.4);}
    .custom-date-row input[type="date"]{background:rgba(3,26,43,0.6);border:1px solid rgba(255,255,255,0.1);color:var(--color-text);padding:4px 8px;border-radius:8px;font-size:12px;font-family:inherit;outline:none;}
    .custom-date-row input[type="date"]:focus{border-color:rgba(255,218,113,0.4);}
    .custom-date-row input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7);}

    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;}
    .kpi{background:var(--color-card);border-radius:12px;padding:16px;border:1px solid rgba(255,218,113,0.08);}
    .kpi .value{font-size:clamp(1.25rem,3vw,1.75rem);font-weight:800;color:var(--color-gold);line-height:1;}
    .kpi .label{font-size:12px;color:var(--color-text-dim);margin-top:6px;}

    .section{background:var(--color-card);border-radius:12px;border:1px solid rgba(255,218,113,0.08);padding:20px;margin-bottom:16px;overflow-x:auto;}
    .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;}
    .section h2{font-size:16px;font-weight:700;color:var(--color-text);margin:0;}

    .search-input{background:rgba(3,26,43,0.6);border:1px solid rgba(255,255,255,0.1);color:var(--color-text);padding:6px 12px;border-radius:6px;font-size:13px;outline:none;width:200px;}
    .search-input:focus{border-color:rgba(255,218,113,0.4);}

    .mobile-sort-select {
        display: none;
        width: 100%;
        margin-top: 8px;
        background: rgba(3,26,43,0.6);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--color-text);
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
    }
    .mobile-sort-select:focus { border-color: rgba(255,218,113,0.4); }

    table{width:100%;border-collapse:collapse;font-size:14px;}
    th{padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:rgba(237,244,247,0.4);border-bottom:1px solid rgba(255,218,113,0.12);cursor:pointer;user-select:none;}
    th:hover{color:rgba(255,218,113,0.8);}

    .chart-wrapper{width:100%;aspect-ratio:16/7;position:relative;}
    .chart-wrapper canvas{width:100%!important;height:100%!important;}

    .footer{text-align:center;padding:20px 0;font-size:12px;color:rgba(237,244,247,0.3);border-top:1px solid rgba(255,218,113,0.06);margin-top:24px;}

    .table-card-mobile {
        background-color: var(--color-card);
        border-radius: 0.75rem;
        border: 1px solid rgba(255, 218, 113, 0.08);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        cursor: pointer;
        transition: transform 0.1s;
    }
    .table-card-mobile:active { transform: scale(0.98); }
    .table-card-mobile.never-accessed {
        border-color: rgba(239, 68, 68, 0.3);
        background-color: rgba(239, 68, 68, 0.05);
    }

    .mobile-rank-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 9999px;
        background: rgba(255,218,113,0.1);
        color: #FFDA71;
        font-size: 0.75rem;
        font-weight: 700;
        border: 1px solid rgba(255,218,113,0.2);
        flex-shrink: 0;
        margin-top: 0.125rem;
    }

    .modal-backdrop { display: none; position: fixed; inset: 0; z-index: 50; background: rgba(8,8,8,0.6); backdrop-filter: blur(4px); justify-content: flex-end; }
    .modal-backdrop.open { display: flex; }
    .modal-panel { background: var(--color-bg); width: 100%; max-width: 28rem; height: 100%; border-left: 1px solid rgba(255,255,255,0.1); box-shadow: -10px 0 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .modal-header { padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: flex-start; background: rgba(18,63,91,0.3); }
    .modal-close-btn { background: transparent; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 0.5rem; border-radius: 0.5rem; }
    .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
    .modal-content { flex: 1; overflow-y: auto; padding: 1.5rem; }
    .modal-card { background: rgba(18,63,91, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 1rem; }
    .timeline-container { position: relative; border-left: 1px solid rgba(255,255,255,0.1); margin-left: 0.5rem; padding-bottom: 0.5rem; }
    .timeline-entry { position: relative; padding-left: 1.5rem; margin-bottom: 1.5rem; }
    .timeline-dot { position: absolute; left: -5px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-bg); border: 2px solid var(--color-gold); z-index: 2; }
    .timeline-dot.green { border-color: #10b981; }

    .desktop-only { display: table; }
    .mobile-only { display: none; }

    @media(max-width:640px){
      .kpis{grid-template-columns:repeat(2,1fr);}
      .mobile-sort-select { display: block; }
      .desktop-only { display: none !important; }
      .mobile-only { display: block !important; }
    }
  </style>
</head>
<body onload="initDashboard()">
  <div class="container">
    <div class="header">
      <h1>Dashboard — ${empresa}</h1>
      <p>Prosperus Club — Treinamento Corporativo</p>
    </div>

    <!-- Period Filter -->
    <div class="period-filter-bar">
      <div class="period-pills" id="periodPills">
        <button class="period-pill active" data-period="all" onclick="selectPeriod('all')">Todo período</button>
        <button class="period-pill" data-period="this-month" onclick="selectPeriod('this-month')">Este mês</button>
        <button class="period-pill" data-period="last-month" onclick="selectPeriod('last-month')">Mês passado</button>
        <button class="period-pill" data-period="this-year" onclick="selectPeriod('this-year')">Este ano</button>
        <button class="period-pill" data-period="last-year" onclick="selectPeriod('last-year')">Ano passado</button>
        <button class="period-pill" data-period="custom" onclick="selectPeriod('custom')">Personalizado</button>
      </div>
      <div class="custom-date-row" id="customDateRow">
        <label>De:</label>
        <input type="date" id="dateStart" onchange="applyCustomDate()">
        <label>Até:</label>
        <input type="date" id="dateEnd" onchange="applyCustomDate()">
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi"><div class="value" id="kpi-funcionarios">${metrics.totalFuncionarios}</div><div class="label">Funcionários</div></div>
      <div class="kpi"><div class="value" id="kpi-ativos">${metrics.usuariosAtivos}</div><div class="label">Ativos</div></div>
      <div class="kpi"><div class="value" id="kpi-acessos">${metrics.totalAcessos.toLocaleString('pt-BR')}</div><div class="label">Acessos</div></div>
      <div class="kpi"><div class="value" id="kpi-conclusoes">${metrics.totalConclusoes.toLocaleString('pt-BR')}</div><div class="label">Conclusões</div></div>
      <div class="kpi"><div class="value" id="kpi-engajamento">${metrics.taxaEngajamento}%</div><div class="label">Engajamento</div></div>
      <div class="kpi"><div class="value" id="kpi-progresso">${metrics.usuariosComProgresso}</div><div class="label">Com Progresso</div></div>
    </div>

    <div class="section">
      <h2>Evolução de Acessos</h2>
      <div class="chart-wrapper"><canvas id="acessosChart"></canvas></div>
    </div>

    <!-- USER TABLE -->
    <div class="section">
      <div class="section-header">
         <h2>Ranking de Colaboradores</h2>
         <div style="flex:1;max-width:100%;display:flex;flex-direction:column;">
             <input type="text" class="search-input" style="width:100%;max-width:200px;align-self:flex-end;" placeholder="Buscar colaborador..." onkeyup="filterData(this.value, 'users')">
             <select class="mobile-sort-select" onchange="sortUsersMobile(this.value)">
                 <option value="conclusoes-desc">Mais Conclusões</option>
                 <option value="acessos-desc">Mais Acessos</option>
                 <option value="nome-asc">Nome (A-Z)</option>
                 <option value="ultimoAcesso-desc">Último Acesso (Recent)</option>
             </select>
         </div>
      </div>

      <table id="usersTable" class="desktop-only">
        <thead>
           <tr>
             <th onclick="sortTable('usersTable', 0)">#</th>
             <th onclick="sortTable('usersTable', 1)">Colaborador</th>
             <th onclick="sortTable('usersTable', 2)" style="text-align:right;">Acessos</th>
             <th onclick="sortTable('usersTable', 3)" style="text-align:right;">Conclusões</th>
             <th onclick="sortTable('usersTable', 4)">Último Acesso</th>
           </tr>
        </thead>
        <tbody id="usersBodyDesktop"></tbody>
      </table>

      <div id="usersListMobile" class="mobile-only space-y-3"></div>
    </div>

    <!-- PROGRESS TABLE -->
    <div class="section">
      <div class="section-header">
         <h2>Progresso por Conteúdo</h2>
         <div style="flex:1;max-width:100%;display:flex;flex-direction:column;">
            <input type="text" class="search-input" style="width:100%;max-width:200px;align-self:flex-end;" placeholder="Buscar conteúdo..." onkeyup="filterData(this.value, 'progress')">
            <select class="mobile-sort-select" onchange="sortProgressMobile(this.value)">
                 <option value="progresso-desc">Maior Progresso</option>
                 <option value="progresso-asc">Menor Progresso</option>
                 <option value="nome-asc">Nome (A-Z)</option>
                 <option value="conteudo-asc">Conteúdo (A-Z)</option>
            </select>
         </div>
      </div>

      <table id="progressTable" class="desktop-only">
        <thead>
          <tr>
            <th onclick="sortTable('progressTable', 0)">Nome</th>
            <th onclick="sortTable('progressTable', 1)">Conteúdo</th>
            <th onclick="sortTable('progressTable', 2, true)" style="text-align:right;">Progresso</th>
          </tr>
        </thead>
        <tbody id="progressBodyDesktop"></tbody>
      </table>

      <div id="progressListMobile" class="mobile-only space-y-2"></div>
    </div>

    <div class="footer">Gerado em ${formatTimestamp()} — Prosperus Club</div>
  </div>

  <!-- MODAL -->
  <div id="userModal" class="modal-backdrop" onclick="if(event.target===this) closeModal()">
      <div class="modal-panel">
          <div class="modal-header">
              <div id="modalUserHeader"></div>
              <button class="modal-close-btn" onclick="closeModal()">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
          </div>
          <div class="modal-content" id="modalContent"></div>
      </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script>
    // ═══ EMBEDDED DATA ═══
    const BASE_USERS_MAP = ${embeddedUserData};
    const progressArray = ${embeddedProgressData};
    const allAcessosDiarios = ${JSON.stringify(metrics.acessosDiarios)};
    const rawAcessos = ${JSON.stringify(rawAcessos)};
    const rawConclusoes = ${JSON.stringify(rawConclusoes)};
    const TOTAL_FUNCIONARIOS = ${metrics.totalFuncionarios};

    // ═══ STATE ═══
    let currentPeriod = 'all';
    let usersMap = JSON.parse(JSON.stringify(BASE_USERS_MAP));
    let usersArray = Object.values(usersMap);
    let userSort = { key: 'conclusoes', dir: 'desc' };
    let progressSort = { key: 'progresso', dir: 'desc' };
    let userFilter = '';
    let progressFilter = '';
    let chartInstance = null;

    // ═══ PERIOD FILTER ═══
    function getPeriodRange(period) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        switch(period) {
            case 'this-month': return [new Date(y,m,1), new Date(y,m+1,1)];
            case 'last-month': return [new Date(y,m-1,1), new Date(y,m,1)];
            case 'this-year':  return [new Date(y,0,1), new Date(y+1,0,1)];
            case 'last-year':  return [new Date(y-1,0,1), new Date(y,0,1)];
            case 'custom': {
                const s = document.getElementById('dateStart').value;
                const e = document.getElementById('dateEnd').value;
                if (!s || !e) return null;
                const start = new Date(s + 'T00:00:00');
                const end = new Date(e + 'T00:00:00');
                end.setDate(end.getDate() + 1);
                return [start, end];
            }
            default: return null;
        }
    }

    function selectPeriod(period) {
        currentPeriod = period;
        document.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.period-pill[data-period="'+period+'"]').classList.add('active');
        document.getElementById('customDateRow').classList.toggle('visible', period === 'custom');
        if (period !== 'custom') applyFilter();
    }

    function applyCustomDate() {
        if (currentPeriod === 'custom') applyFilter();
    }

    function inRange(isoDay, range) {
        if (!range || !isoDay) return true;
        const d = new Date(isoDay + 'T00:00:00');
        return d >= range[0] && d < range[1];
    }

    function applyFilter() {
        const range = getPeriodRange(currentPeriod);

        // 1) Filter raw arrays
        const filtAcessos = range ? rawAcessos.filter(a => inRange(a.d, range)) : rawAcessos;
        const filtConclusoes = range ? rawConclusoes.filter(c => inRange(c.d, range)) : rawConclusoes;

        // 2) Recompute KPIs
        const totalAcessos = filtAcessos.length;
        const emailsAtivos = new Set(filtAcessos.map(a => a.e));
        const usuariosAtivos = emailsAtivos.size;
        const usuariosInativos = TOTAL_FUNCIONARIOS - usuariosAtivos;
        const totalConclusoes = filtConclusoes.length;
        const taxa = TOTAL_FUNCIONARIOS > 0 ? ((usuariosAtivos / TOTAL_FUNCIONARIOS) * 100).toFixed(1) : '0';

        document.getElementById('kpi-funcionarios').textContent = TOTAL_FUNCIONARIOS.toLocaleString('pt-BR');
        document.getElementById('kpi-ativos').textContent = usuariosAtivos.toLocaleString('pt-BR');
        document.getElementById('kpi-acessos').textContent = totalAcessos.toLocaleString('pt-BR');
        document.getElementById('kpi-conclusoes').textContent = totalConclusoes.toLocaleString('pt-BR');
        document.getElementById('kpi-engajamento').textContent = taxa + '%';
        // progresso KPI unchanged (no dates in progress data)

        // 3) Rebuild chart
        const filtDiarios = range ? allAcessosDiarios.filter(d => inRange(d.dia, range)) : allAcessosDiarios;
        rebuildChart(filtDiarios);

        // 4) Recount per-user stats
        const userAcessoCounts = {};
        const userConcCounts = {};
        filtAcessos.forEach(a => { userAcessoCounts[a.e] = (userAcessoCounts[a.e] || 0) + 1; });
        filtConclusoes.forEach(c => { userConcCounts[c.e] = (userConcCounts[c.e] || 0) + 1; });

        usersMap = JSON.parse(JSON.stringify(BASE_USERS_MAP));
        Object.keys(usersMap).forEach(email => {
            usersMap[email].acessos = userAcessoCounts[email] || 0;
            usersMap[email].conclusoes = userConcCounts[email] || 0;
        });
        usersArray = Object.values(usersMap);

        // 5) Re-render tables
        renderUsers();
        renderProgress();
    }

    function rebuildChart(data) {
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        const ctx = document.getElementById('acessosChart');
        if (!ctx || data.length === 0) return;
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.map(d => { const p = d.dia.split('-'); return p[2]+'/'+p[1]; }),
              datasets: [{
                label: 'Acessos',
                data: data.map(d => d.acessos),
                borderColor: '#FFDA71',
                backgroundColor: 'rgba(255,218,113,0.1)',
                fill: true, tension: 0.3, pointRadius: 1, borderWidth: 2,
              }]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } }, beginAtZero: true }
              }
            }
        });
    }

    // ═══ INIT ═══
    function initDashboard() {
        sortUsersMobile('conclusoes-desc');
        sortProgressMobile('progresso-desc');
        rebuildChart(allAcessosDiarios);
    }

    // ═══ MODAL ═══
    function formatDate(isoStr) {
        if(!isoStr) return '';
        if(isoStr.includes('/')) return isoStr;
        let datePart = isoStr;
        if(isoStr.includes('T')) datePart = isoStr.split('T')[0];
        const parts = datePart.split('-');
        if(parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return isoStr;
    }

    function openUserModal(email) {
        const user = usersMap[email];
        if(!user) return;
        const modal = document.getElementById('userModal');
        const header = document.getElementById('modalUserHeader');
        const content = document.getElementById('modalContent');

        header.innerHTML = \`
            <h2 style="font-size:1.25rem;font-weight:700;color:#EDF4F7;">\${user.nome}</h2>
            <p style="font-size:0.875rem;color:rgba(237,244,247,0.5);margin-top:4px;">\${user.email}</p>
            <p style="font-size:0.75rem;color:#FFDA71;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">\${user.empresa}</p>
        \`;

        const lastAccessDate = user.ultimoAcesso ? formatDate(user.ultimoAcesso) : null;

        let statsHtml = \`
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:2rem;">
             <div class="modal-card">
                <span style="font-size:0.75rem;color:rgba(237,244,247,0.5);display:block;margin-bottom:0.25rem;">Acessos</span>
                <span style="font-size:1.5rem;font-weight:700;color:#fff;">\${user.acessos}</span>
             </div>
             <div class="modal-card">
                <span style="font-size:0.75rem;color:rgba(237,244,247,0.5);display:block;margin-bottom:0.25rem;">Conclusões</span>
                <span style="font-size:1.5rem;font-weight:700;color:#fff;">\${user.conclusoes}</span>
             </div>
          </div>
           <div style="margin-bottom:2rem;">
               <h3 style="font-size:0.875rem;font-weight:600;color:rgba(237,244,247,0.8);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">Último Acesso</h3>
               <div style="padding:1rem;border-radius:0.5rem;border:1px solid \${!lastAccessDate ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}; background:\${!lastAccessDate ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.05)'};">
                   <p style="font-weight:500;color:\${!lastAccessDate ? '#f87171' : '#fff'};">\${lastAccessDate || 'Nunca acessou a plataforma'}</p>
               </div>
           </div>
        \`;

        let historyHtml = '<div style="margin-bottom:2rem;"><h3 style="font-size:0.875rem;font-weight:600;color:rgba(237,244,247,0.8);margin-bottom:1rem;">Histórico de Acessos</h3>';
        if(user.historico && user.historico.length > 0) {
            historyHtml += '<div class="timeline-container">';
            user.historico.forEach(h => {
                historyHtml += \`
                  <div class="timeline-entry">
                      <div class="timeline-dot"></div>
                      <p style="font-size:0.875rem;color:#fff;font-weight:500;">Acesso à plataforma</p>
                      <p style="font-size:0.75rem;color:rgba(237,244,247,0.4);margin-top:2px;">\${formatDate(h.data)}</p>
                  </div>\`;
            });
            historyHtml += '</div>';
        } else { historyHtml += '<p style="font-size:0.875rem;color:rgba(237,244,247,0.3);font-style:italic;">Nenhuma atividade recente.</p>'; }
        historyHtml += '</div>';

        let contentHtml = '<div><h3 style="font-size:0.875rem;font-weight:600;color:rgba(237,244,247,0.8);margin-bottom:1rem;">Conteúdo Recente</h3>';
        if(user.conteudoRecente && user.conteudoRecente.length > 0) {
            contentHtml += '<div class="timeline-container">';
            user.conteudoRecente.forEach(c => {
                contentHtml += \`
                  <div class="timeline-entry">
                      <div class="timeline-dot green"></div>
                      <p style="font-size:0.875rem;color:#fff;font-weight:500;">\${c.titulo}</p>
                      <p style="font-size:0.75rem;color:rgba(237,244,247,0.4);margin-top:2px;">\${c.data ? formatDate(c.data) : 'Data indisponível'}</p>
                  </div>\`;
            });
            contentHtml += '</div>';
        } else { contentHtml += '<p style="font-size:0.875rem;color:rgba(237,244,247,0.3);font-style:italic;">Nenhum conteúdo concluído recentemente.</p>'; }
        contentHtml += '</div>';

        content.innerHTML = statsHtml + historyHtml + contentHtml;
        modal.classList.add('open');
    }
    function closeModal() { document.getElementById('userModal').classList.remove('open'); }

    // ═══ SORTING & FILTERING ═══
    function filterData(val, type) {
        const q = val.toLowerCase();
        if(type === 'users') { userFilter = q; renderUsers(); }
        else { progressFilter = q; renderProgress(); }
    }

    function sortUsersMobile(val) {
        const [key, dir] = val.split('-');
        userSort = { key, dir };
        renderUsers();
    }

    function sortProgressMobile(val) {
        const [key, dir] = val.split('-');
        progressSort = { key, dir };
        renderProgress();
    }

    function sortTable(tableId, n) {
        var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
        table = document.getElementById(tableId);
        switching = true; dir = "asc";
        while (switching) {
            switching = false; rows = table.rows;
            for (i = 1; i < (rows.length - 1); i++) {
                shouldSwitch = false; x = rows[i].getElementsByTagName("TD")[n]; y = rows[i + 1].getElementsByTagName("TD")[n];
                let xVal = x.textContent.toLowerCase(); let yVal = y.textContent.toLowerCase();
                if (n > 1) {
                    let xNum = parseFloat(xVal.replace(/[^0-9.-]/g, '')); let yNum = parseFloat(yVal.replace(/[^0-9.-]/g, ''));
                    if(!isNaN(xNum) && !isNaN(yNum)) { xVal = xNum; yVal = yNum; }
                }
                if (dir == "asc") { if (xVal > yVal) { shouldSwitch = true; break; } }
                else if (dir == "desc") { if (xVal < yVal) { shouldSwitch = true; break; } }
            }
            if (shouldSwitch) { rows[i].parentNode.insertBefore(rows[i + 1], rows[i]); switching = true; switchcount ++; }
            else { if (switchcount == 0 && dir == "asc") { dir = "desc"; switching = true; } }
        }
    }

    // ═══ RENDERING ═══
    function renderUsers() {
        let list = [...usersArray];
        if(userFilter) {
            list = list.filter(u => u.nome.toLowerCase().includes(userFilter) || u.email.toLowerCase().includes(userFilter));
        }
        list.sort((a, b) => {
            let aVal = a[userSort.key], bVal = b[userSort.key];
            if(userSort.dir === 'desc') {
                if(typeof aVal === 'number') return bVal - aVal;
                return String(bVal||'').localeCompare(String(aVal||''));
            } else {
                if(typeof aVal === 'number') return aVal - bVal;
                return String(aVal||'').localeCompare(String(bVal||''));
            }
        });

        const tbody = document.getElementById('usersBodyDesktop');
        let htmlDesk = '';
        list.forEach((u, i) => {
            const neverAccessed = !u.ultimoAcesso;
            const textStyle = neverAccessed ? 'color:#ef4444;' : 'color:#EDF4F7;';
            const rowStyle = neverAccessed ? 'background:rgba(239,68,68,0.08);' : '';

            htmlDesk += \`
              <tr style="\${rowStyle}cursor:pointer;transition:background 0.2s;" onclick="openUserModal('\${u.email}')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='\${neverAccessed ? 'rgba(239,68,68,0.08)' : 'transparent'}'">
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);color:#9ca3af;font-size:13px;">\${i + 1}</td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);">
                    <div style="font-weight:600;\${textStyle}">\${u.nome}</div>
                    <div style="font-size:12px;color:#9ca3af;">\${u.email}</div>
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);text-align:right;font-weight:600;color:#FFDA71;">\${u.acessos}</td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);text-align:right;font-weight:600;color:#10b981;">\${u.conclusoes}</td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);color:rgba(237,244,247,0.6);font-size:13px;">
                    \${neverAccessed ? '<span style="color:#ef4444;font-weight:700;font-size:11px;border:1px solid rgba(239,68,68,0.2);padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.1);">NUNCA</span>' : (u.ultimoAcesso ? formatDate(u.ultimoAcesso) : '-')}
                </td>
              </tr>\`;
        });
        tbody.innerHTML = htmlDesk;

        const mobileDiv = document.getElementById('usersListMobile');
        let htmlMob = '';
        list.forEach((u, i) => {
            const neverAccessed = !u.ultimoAcesso;
            const rank = i + 1;

            htmlMob += \`
              <div onclick="openUserModal('\${u.email}')" class="table-card-mobile \${neverAccessed ? 'never-accessed' : ''}">
                 <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
                     <div style="display:flex;align-items:flex-start;gap:0.75rem;min-width:0;">
                         <span class="mobile-rank-badge">\${rank}</span>
                         <div style="min-width:0;">
                             <p style="font-weight:600;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\${neverAccessed ? 'color:#f87171;' : 'color:#EDF4F7;'}">\${u.nome}</p>
                             <p style="font-size:0.75rem;color:rgba(237,244,247,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${u.email}</p>
                         </div>
                     </div>
                     \${neverAccessed ? '<span style="flex-shrink:0;padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.625rem;font-weight:700;background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.2);">NUNCA</span>' : ''}
                 </div>

                 <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <p style="font-size:0.625rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(237,244,247,0.3);font-weight:600;">Acessos</p>
                        <p style="font-size:1.125rem;font-weight:700;color:#FFDA71;">\${u.acessos}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:0.625rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(237,244,247,0.3);font-weight:600;">Conclusões</p>
                        <p style="font-size:1.125rem;font-weight:700;color:#EDF4F7;">\${u.conclusoes}</p>
                    </div>
                 </div>

                 \${!neverAccessed ? \`
                 <div style="margin-top:0.5rem;text-align:right;">
                    <p style="font-size:0.75rem;color:rgba(237,244,247,0.4);">
                        Último acesso: <span style="color:rgba(237,244,247,0.7);">\${formatDate(u.ultimoAcesso)}</span>
                    </p>
                 </div>\` : ''}
              </div>\`;
        });
        mobileDiv.innerHTML = htmlMob;
    }

    function renderProgress() {
        let list = [...progressArray];
        if(progressFilter) {
            list = list.filter(p => p.nome.toLowerCase().includes(progressFilter) || p.conteudo.toLowerCase().includes(progressFilter));
        }
        list.sort((a, b) => {
            let aVal = a[progressSort.key], bVal = b[progressSort.key];
            if(progressSort.dir === 'desc') {
                if(typeof aVal === 'number') return bVal - aVal;
                return String(bVal||'').localeCompare(String(aVal||''));
            } else {
                if(typeof aVal === 'number') return aVal - bVal;
                return String(aVal||'').localeCompare(String(bVal||''));
            }
        });

        const tbody = document.getElementById('progressBodyDesktop');
        let htmlDesk = '';
        list.forEach(p => {
             let gradient = '#dc2626,#ef4444';
             if (p.progresso >= 80) gradient = '#059669,#10b981';
             else if (p.progresso >= 50) gradient = '#CA9A43,#FFDA71';
             else if (p.progresso >= 25) gradient = '#ea580c,#f59e0b';

             htmlDesk += \`
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);font-weight:500;color:#EDF4F7;">\${p.nome}</td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);color:#9ca3af;">\${p.conteudo}</td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,218,113,0.08);text-align:right;">
                  <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
                    <div style="width:80px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                      <div style="width:\${p.progresso}%;height:100%;border-radius:3px;background:linear-gradient(90deg,\${gradient});"></div>
                    </div>
                    <span style="font-weight:600;color:#EDF4F7;font-size:13px;min-width:40px;text-align:right;">\${p.progresso}%</span>
                  </div>
                </td>
              </tr>\`;
        });
        tbody.innerHTML = htmlDesk;

        const mobileDiv = document.getElementById('progressListMobile');
        let htmlMob = '';
        list.forEach(item => {
             let gradient = '#dc2626,#ef4444';
             if (item.progresso >= 80) gradient = '#059669,#10b981';
             else if (item.progresso >= 50) gradient = '#CA9A43,#FFDA71';
             else if (item.progresso >= 25) gradient = '#ea580c,#f59e0b';

            htmlMob += \`
              <div class="table-card-mobile">
                  <p style="font-weight:600;font-size:0.875rem;color:#EDF4F7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${item.nome}</p>
                  <p style="font-size:0.75rem;color:rgba(237,244,247,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${item.conteudo}</p>
                  <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;">
                      <div style="flex:1;">
                          <div style="width:100%;height:0.5rem;background:rgba(255,255,255,0.08);border-radius:0.25rem;overflow:hidden;">
                              <div style="width:\${item.progresso}%;height:100%;border-radius:0.25rem;background:linear-gradient(90deg,\${gradient});"></div>
                          </div>
                      </div>
                      <span style="font-size:0.875rem;font-weight:700;color:#FFDA71;width:3rem;text-align:right;">\${item.progresso}%</span>
                  </div>
                  <p style="font-size:0.75rem;color:rgba(237,244,247,0.3);margin-top:0.25rem;">\${item.aulasCompletas} aulas concluídas</p>
              </div>\`;
        });
        mobileDiv.innerHTML = htmlMob;
    }
  </script>
</body>
</html>`;
}

/**
 * Exports dashboards as a ZIP file containing only selected companies.
 * Always embeds ALL-TIME data so the exported HTML can filter client-side.
 */
export async function exportDashboards(
  data: ParsedDataset,
  selectedEmpresas: string[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  const zip = new JSZip();

  // Detect mode: multi-recipient or fallback
  const useRecipients = hasRecipientColumn(data.referencia);

  if (useRecipients) {
    const recipients = buildRecipientMap(data.referencia);
    // Filter by selected companies
    const filtered = recipients.filter(r => selectedEmpresas.includes(r.empresa));
    // Cache HTML per company to avoid reprocessing
    const htmlCache: Record<string, string> = {};

    for (let i = 0; i < filtered.length; i++) {
      const { email, empresa } = filtered[i];
      if (!htmlCache[empresa]) {
        const companyData = filterByEmpresa(data, empresa);
        const metrics = computeMetrics(companyData);
        htmlCache[empresa] = generateCompanyHTML(empresa, metrics, companyData);
      }
      zip.file(`${email}.html`, htmlCache[empresa]);
      onProgress?.(Math.round(((i + 1) / filtered.length) * 100));
    }
  } else {
    // Fallback: original logic (first email per company)
    const firstEmailMap = buildCompanyFirstEmailMap(data.referencia);
    for (let i = 0; i < selectedEmpresas.length; i++) {
      const empresa = selectedEmpresas[i];
      const companyData = filterByEmpresa(data, empresa);
      const metrics = computeMetrics(companyData);
      const html = generateCompanyHTML(empresa, metrics, companyData);
      const firstEmail = firstEmailMap[empresa] ?? empresa.replace(/[^a-zA-Z0-9]/g, '_');
      zip.file(`${firstEmail}.html`, html);
      onProgress?.(Math.round(((i + 1) / selectedEmpresas.length) * 100));
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dashboards_${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
