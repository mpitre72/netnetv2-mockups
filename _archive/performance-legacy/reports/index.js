import { mockReportData as mockPerformanceData } from '../data/mock-reports.js';
import { renderEffortTimelineMeter } from '../components/metrics/effort-timeline-meter.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const DASHBOARD_TABS = [
  { value: 'performance', label: 'Performance' },
  { value: 'jobs-deliverables', label: 'Jobs & Deliverables' },
  { value: 'capacity-forecast', label: 'Capacity & Forecast' },
  { value: 'clients-service-types', label: 'Clients & Service Types' },
  { value: 'executive-pulse', label: 'Executive Pulse' },
];

const MODE_OPTIONS = [
  { value: 'dashboards', label: 'Dashboards' },
  { value: 'reports', label: 'Reports' },
];

const DEFAULT_TAB = 'performance';

let performanceMode = 'dashboards';
let performanceSearch = '';

function clampPercent(value) {
  const num = Number.isFinite(value) ? value : 0;
  if (num < 0) return 0;
  if (num > 200) return 200;
  return num;
}

function getTimelinePercent(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = new Date().getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  if (e <= s) return 100;
  const p = ((n - s) / (e - s)) * 100;
  return isNaN(p) ? 0 : Math.max(0, p);
}

function getActiveTabFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const match = hash.match(/^#\/app\/(performance|reports)\/([^/]+)/);
  const found = match ? match[2] : '';
  const isValid = DASHBOARD_TABS.some((tab) => tab.value === found);
  return isValid ? found : DEFAULT_TAB;
}

function setActiveTab(value) {
  const base = '#/app/performance';
  const target = value === DEFAULT_TAB ? base : `${base}/${value}`;
  if (typeof window !== 'undefined' && typeof window.navigate === 'function') {
    window.navigate(target);
  } else if (typeof window !== 'undefined') {
    window.location.hash = target;
  }
}

function formatDate(input) {
  const d = new Date(input);
  if (isNaN(d)) return input || '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getBadgeClasses(value) {
  if (value >= 1.25) return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  if (value >= 1.0) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
}

function buildKpiRow(metrics) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 flex flex-col gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">On-Time Effort Ratio</p>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-bold text-slate-900 dark:text-white">${metrics.onTimeRatio}%</span>
            <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-300">Target 85%</span>
          </div>
        </div>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="h-full rounded-full bg-emerald-500" style="width:${Math.min(metrics.onTimeRatio, 120)}%"></div>
        </div>
      </div>
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 flex flex-col gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Jobs at Risk</p>
          <div class="mt-2 flex items-end gap-2">
            <span class="text-3xl font-bold ${metrics.jobsAtRisk > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'}">${metrics.jobsAtRisk}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Active jobs with Effort or Timeline &gt; 85%</p>
        </div>
      </div>
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 flex flex-col gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Capacity Next 14 Days</p>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-bold ${metrics.capacityClasses.text}">${metrics.capacityStatus}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Hours due: ${metrics.hoursDue}h of ${metrics.capacity}h capacity</p>
        </div>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="h-full rounded-full ${metrics.capacityClasses.bar}" style="width:${Math.min(metrics.capacityRatio, 130)}%"></div>
        </div>
      </div>
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Overdue &amp; Due Soon</p>
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-2 rounded-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200 px-3 py-1 text-xs font-semibold">Overdue (${metrics.overdue})</span>
            <span class="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 px-3 py-1 text-xs font-semibold">Due in 7 days (${metrics.dueSoon})</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildPortfolioTable(rows) {
  const body = rows
    .map((job) => {
      const effortPct = clampPercent((job.actualHours / (job.estHours || 1)) * 100);
      const timelinePct = clampPercent(getTimelinePercent(job.startDate, job.plannedEnd));
      return `
        <tr class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">${job.name}</td>
          <td class="px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${job.client}</td>
          <td class="px-5 py-4">
            ${renderEffortTimelineMeter({
              effortPercent: effortPct,
              timelinePercent: timelinePct,
              summaryText: `${job.actualHours}/${job.estHours}h`,
            })}
          </td>
          <td class="px-5 py-4">
            <span class="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${getBadgeClasses(job.wipPressure)}">
              ${job.wipPressure.toFixed(2)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Portfolio Status</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">Jobs ranked by Effort and Timeline consumption.</p>
        </div>
      </div>
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th class="px-5 py-3 text-left font-semibold">Job Name</th>
                <th class="px-5 py-3 text-left font-semibold">Client</th>
                <th class="px-5 py-3 text-left font-semibold">Effort (Actual/Est)</th>
                <th class="px-5 py-3 text-left font-semibold">WIP Pressure</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function buildDeliverablesTable(rows) {
  const today = new Date();
  const body = rows
    .map((d) => {
      const effortPct = clampPercent(d.effortConsumed || 0);
      const timelinePct = clampPercent(d.durationConsumed || 0);
      const est = d.estHours || 1;
      const actual = Math.round((effortPct / 100) * est);
      const overdue = new Date(d.due) < today;
      return `
        <tr class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="px-5 py-4">
            <div class="font-semibold text-slate-900 dark:text-white">${d.jobName}</div>
            <div class="text-sm text-slate-600 dark:text-slate-400">${d.name}</div>
          </td>
          <td class="px-5 py-4">
            ${renderEffortTimelineMeter({
              effortPercent: effortPct,
              timelinePercent: timelinePct,
              summaryText: `${actual}/${est}h`,
            })}
          </td>
          <td class="px-5 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200">${d.owner}</td>
          <td class="px-5 py-4 whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-slate-700 dark:text-slate-200'}">${formatDate(d.due)}</td>
          <td class="px-5 py-4 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-3 text-sm">
              <button type="button" class="performance-inline-action">Reassign</button>
              <span class="text-slate-300 dark:text-white/30">|</span>
              <button type="button" class="performance-inline-action">Re-scope</button>
              <span class="text-slate-300 dark:text-white/30">|</span>
              <button type="button" class="performance-inline-action">Move Date</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  const csvContent =
    'ID,Job,Deliverable,Owner,Due,EffortPercent,TimelinePercent\n' +
    rows
      .map((d) => `${d.id},"${d.jobName}","${d.name}","${d.owner}",${d.due},${d.effortConsumed},${d.durationConsumed}`)
      .join('\n');
  const csvUri = typeof encodeURIComponent === 'function'
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
    : '';

  return `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">At-Risk Deliverables</h2>
          <span class="text-sm text-slate-600 dark:text-slate-400">(${rows.length})</span>
        </div>
        <a href="${csvUri}" download="at-risk-deliverables.csv" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors">
          Export List → CSV
        </a>
      </div>
      <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th class="px-5 py-3 text-left font-semibold">Job / Deliverable</th>
                <th class="px-5 py-3 text-left font-semibold">Effort vs Timeline</th>
                <th class="px-5 py-3 text-left font-semibold">Owner</th>
                <th class="px-5 py-3 text-left font-semibold">Due</th>
                <th class="px-5 py-3 text-right font-semibold">Suggested Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function buildDashboardSwitcher(activeTab) {
  const buttons = DASHBOARD_TABS.map((tab) => {
    const isActive = tab.value === activeTab;
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium transition-colors border';
    const activeClasses = 'bg-[var(--color-brand-purple,#711FFF)] dark:bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent';
    const idleClasses = 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25';
    return `<button type="button" data-dashboard-tab="${tab.value}" class="${baseClasses} ${isActive ? activeClasses : idleClasses}">${tab.label}</button>`;
  }).join('');

  return `
    <div class="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1 w-full md:w-auto overflow-auto">
      ${buttons}
    </div>
  `;
}

function buildPerformanceDashboard(data = mockPerformanceData) {
  const today = new Date();
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const jobs = [...data.jobs].map((job) => ({
    ...job,
    timelinePct: clampPercent(getTimelinePercent(job.startDate, job.plannedEnd)),
    effortPct: clampPercent((job.actualHours / (job.estHours || 1)) * 100),
  }));
  const deliverables = [...data.deliverables];

  const jobsAtRisk = jobs.filter((j) => j.effortPct > 85 || j.timelinePct > 85).length;
  const hoursDue = deliverables.reduce((sum, d) => {
    const due = new Date(d.due);
    if (!isNaN(due) && due >= today && due <= next14) {
      return sum + (d.estHours || 20);
    }
    return sum;
  }, 0) || 126;
  const capacity = 140;
  const capacityRatio = (hoursDue / capacity) * 100;
  const capacityStatus = capacityRatio > 110 ? 'Overbooked' : capacityRatio >= 85 ? 'Balanced' : 'Underbooked';
  const capacityClasses = capacityRatio > 110
    ? { text: 'text-red-600 dark:text-red-300', bar: 'bg-red-500' }
    : capacityRatio >= 85
      ? { text: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' }
      : { text: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' };
  const overdue = deliverables.filter((d) => new Date(d.due) < today).length;
  const dueSoon = deliverables.filter((d) => {
    const due = new Date(d.due);
    return !isNaN(due) && due >= today && due <= next7;
  }).length;

  const sortedJobs = jobs.sort((a, b) => Math.max(b.effortPct, b.timelinePct) - Math.max(a.effortPct, a.timelinePct));
  const sortedDeliverables = deliverables
    .map((d) => ({ ...d, risk: Math.max(d.effortConsumed || 0, d.durationConsumed || 0) }))
    .sort((a, b) => b.risk - a.risk);

  const metrics = {
    onTimeRatio: 92,
    jobsAtRisk,
    hoursDue,
    capacity,
    capacityRatio,
    capacityStatus,
    capacityClasses,
    overdue,
    dueSoon,
  };

  return `
    <div class="space-y-8">
      <header class="space-y-1">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Performance Dashboard</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400">Real-time overview of effort, timeline, and team capacity.</p>
      </header>
      ${buildKpiRow(metrics)}
      ${buildPortfolioTable(sortedJobs)}
      ${buildDeliverablesTable(sortedDeliverables)}
    </div>
  `;
}

function buildPlaceholder(label) {
  return `
    <div class="rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-white/60 dark:bg-slate-900/60 p-6 text-center text-slate-600 dark:text-slate-300">
      <p class="text-sm font-semibold">${label} dashboard</p>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Coming soon</p>
    </div>
  `;
}

function buildReportsList() {
  const items = [
    { title: 'Weekly Pulse', desc: 'Coming soon' },
    { title: 'Monthly Pack', desc: 'Coming soon' },
    { title: 'Exports', desc: 'Coming soon' },
  ];
  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Reports</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400">Saved report artifacts for Performance.</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${items.map((item) => `
          <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">${item.title}</h3>
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Coming soon</span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">${item.desc}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderHeader(container, root, showSecondaryRow) {
  root.render(
    h(SectionHeader, {
      title: 'Performance',
      showHelpIcon: true,
      switcherOptions: MODE_OPTIONS,
      switcherValue: performanceMode,
      onSwitcherChange: (next) => {
        performanceMode = next === 'reports' ? 'reports' : 'dashboards';
        renderPerformancePage(container);
      },
      showSearch: true,
      searchPlaceholder: 'Search Performance…',
      searchValue: performanceSearch,
      onSearchChange: (next) => { performanceSearch = next || ''; },
      showSecondaryRow,
    })
  );
}

export function renderPerformancePage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[PerformanceModule] container not found for renderPerformancePage.');
    return;
  }

  const activeTab = getActiveTabFromHash();
  const dashboardsContent = activeTab === DEFAULT_TAB
    ? buildPerformanceDashboard(mockPerformanceData)
    : buildPlaceholder(DASHBOARD_TABS.find((t) => t.value === activeTab)?.label || 'This');

  const body = performanceMode === 'dashboards'
    ? `<div class="space-y-6">${buildDashboardSwitcher(activeTab)}${dashboardsContent}</div>`
    : buildReportsList();

  container.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-6 lg:py-8 space-y-6">
      <div class="performance-header-sticky">
        <div id="section-header-root"></div>
      </div>
      ${body}
    </div>
  `;

  const headerRoot = document.getElementById('section-header-root');
  if (headerRoot) {
    const root = createRoot(headerRoot);
    let showSecondaryRow = true;
    renderHeader(container, root, showSecondaryRow);

    if (typeof window !== 'undefined') {
      if (window.__performanceScrollHandler) {
        window.removeEventListener('scroll', window.__performanceScrollHandler);
      }
      let lastY = window.scrollY || 0;
      const threshold = 64;
      const handler = () => {
        const current = window.scrollY || 0;
        const delta = current - lastY;
        let nextVisible = showSecondaryRow;
        if (current <= threshold) {
          nextVisible = true;
        } else if (delta > 0) {
          nextVisible = false;
        } else if (delta < 0) {
          nextVisible = true;
        }
        if (nextVisible !== showSecondaryRow) {
          showSecondaryRow = nextVisible;
          renderHeader(container, root, showSecondaryRow);
        }
        lastY = current;
      };
      window.__performanceScrollHandler = handler;
      window.addEventListener('scroll', handler, { passive: true });
    }
  }

  container.querySelectorAll('[data-dashboard-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-dashboard-tab') || DEFAULT_TAB;
      setActiveTab(next);
    });
  });
}
