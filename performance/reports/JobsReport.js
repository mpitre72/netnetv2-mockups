import { openSingleDatePickerPopover } from '../../quick-tasks/quick-task-detail.js';

const { createElement: h, useMemo, useRef, useState } = React;

const JOBS_REPORT_DEMO_JOBS = [
  {
    id: 'northbridge-refresh',
    jobNumber: '1138',
    jobName: 'Northbridge Website Refresh',
    company: 'Northbridge Capital',
    jobType: 'Project',
    status: 'Active',
    startDate: '2026-05-11',
    completionDate: null,
    originalPlan: 120,
    currentPlan: 138,
    actualHours: 84,
    changeOrders: 2,
    deliverables: [
      { name: 'UX + Visual Design', originalPlan: 46, currentPlan: 54, actualHours: 38, variance: -16, status: 'Completed' },
      { name: 'Frontend Build', originalPlan: 58, currentPlan: 66, actualHours: 36, variance: -30, status: 'In progress' },
      { name: 'Release QA', originalPlan: 16, currentPlan: 18, actualHours: 10, variance: -8, status: 'Active' },
    ],
    serviceTypes: [
      { name: 'UX Design', currentPlan: 54, actualHours: 38, variance: -16 },
      { name: 'Development', currentPlan: 56, actualHours: 30, variance: -26 },
      { name: 'QA Review', currentPlan: 18, actualHours: 10, variance: -8 },
      { name: 'Project Management', currentPlan: 10, actualHours: 6, variance: -4 },
    ],
  },
  {
    id: 'growth-support',
    jobNumber: '1142',
    jobName: 'SEO Management Retainer',
    company: 'Future Systems',
    jobType: 'Retainer',
    status: 'Active',
    startDate: '2026-04-01',
    completionDate: null,
    originalPlan: 66,
    currentPlan: 72,
    actualHours: 55,
    changeOrders: 1,
    deliverables: [
      { name: 'Plugin Updates', originalPlan: 24, currentPlan: 24, actualHours: 16, variance: -8, status: 'Active' },
      { name: 'Anything Hours', originalPlan: 30, currentPlan: 30, actualHours: 22, variance: -8, status: 'Active' },
      { name: 'Landing Page Fixes', originalPlan: 12, currentPlan: 18, actualHours: 17, variance: -1, status: 'Active' },
    ],
    serviceTypes: [
      { name: 'SEO', currentPlan: 30, actualHours: 22, variance: -8 },
      { name: 'Development', currentPlan: 22, actualHours: 19, variance: -3 },
      { name: 'UX Design', currentPlan: 12, actualHours: 9, variance: -3 },
      { name: 'Project Management', currentPlan: 8, actualHours: 5, variance: -3 },
    ],
    retainerCycles: [
      {
        cycleKey: '2026-04',
        planHours: 66,
        actualHours: 63,
        changeOrders: 1,
        deliverables: [
          { name: 'Plugin Updates', planHours: 24, actualHours: 21, variance: -3, status: 'Completed', workType: 'Monthly work' },
          { name: 'Anything Hours', planHours: 30, actualHours: 28, variance: -2, status: 'Completed', workType: 'Monthly work' },
          { name: 'Emergency Diagnostics', planHours: 12, actualHours: 14, variance: 2, status: 'Completed', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'SEO', planHours: 34, actualHours: 33, variance: -1 },
          { name: 'Development', planHours: 12, actualHours: 14, variance: 2 },
          { name: 'Project Management', planHours: 20, actualHours: 16, variance: -4 },
        ],
      },
      {
        cycleKey: '2026-05',
        planHours: 72,
        actualHours: 76,
        changeOrders: 0,
        deliverables: [
          { name: 'Plugin Updates', planHours: 24, actualHours: 22, variance: -2, status: 'Completed', workType: 'Monthly work' },
          { name: 'Anything Hours', planHours: 30, actualHours: 30, variance: 0, status: 'Completed', workType: 'Monthly work' },
          { name: 'Landing Page Fixes', planHours: 18, actualHours: 24, variance: 6, status: 'In Progress', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'SEO', planHours: 30, actualHours: 30, variance: 0 },
          { name: 'Development', planHours: 22, actualHours: 28, variance: 6 },
          { name: 'UX Design', planHours: 12, actualHours: 10, variance: -2 },
          { name: 'Project Management', planHours: 8, actualHours: 8, variance: 0 },
        ],
      },
      {
        cycleKey: '2026-06',
        planHours: 72,
        actualHours: 55,
        changeOrders: 0,
        deliverables: [
          { name: 'Plugin Updates', planHours: 24, actualHours: 16, variance: -8, status: 'Active', workType: 'Monthly work' },
          { name: 'Anything Hours', planHours: 30, actualHours: 22, variance: -8, status: 'Active', workType: 'Monthly work' },
          { name: 'Landing Page Fixes', planHours: 18, actualHours: 17, variance: -1, status: 'Active', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'SEO', planHours: 30, actualHours: 22, variance: -8 },
          { name: 'Development', planHours: 22, actualHours: 19, variance: -3 },
          { name: 'UX Design', planHours: 12, actualHours: 9, variance: -3 },
          { name: 'Project Management', planHours: 8, actualHours: 5, variance: -3 },
        ],
      },
    ],
  },
  {
    id: 'fathom-seo-sprint',
    jobNumber: '1097',
    jobName: 'Fathom SEO Sprint',
    company: 'Fathom',
    jobType: 'Project',
    status: 'Completed',
    startDate: '2026-02-03',
    completionDate: '2026-05-29',
    originalPlan: 120,
    currentPlan: 126,
    actualHours: 118,
    changeOrders: 1,
    deliverables: [
      { name: 'Technical SEO Audit', originalPlan: 42, currentPlan: 42, actualHours: 40, variance: -2, status: 'Completed' },
      { name: 'Content Recommendations', originalPlan: 38, currentPlan: 44, actualHours: 41, variance: -3, status: 'Completed' },
      { name: 'Implementation QA', originalPlan: 40, currentPlan: 40, actualHours: 37, variance: -3, status: 'Completed' },
    ],
    serviceTypes: [
      { name: 'SEO', currentPlan: 76, actualHours: 72, variance: -4 },
      { name: 'QA Review', currentPlan: 24, actualHours: 22, variance: -2 },
      { name: 'Project Management', currentPlan: 26, actualHours: 24, variance: -2 },
    ],
  },
  {
    id: 'right-here-rebrand',
    jobNumber: '1124',
    jobName: 'Right Here Rebrand',
    company: 'Right Here Interactive',
    jobType: 'Project',
    status: 'Active',
    startDate: '2026-05-28',
    completionDate: null,
    originalPlan: 180,
    currentPlan: 204,
    actualHours: 82,
    changeOrders: 2,
    deliverables: [
      { name: 'Brand Discovery', originalPlan: 42, currentPlan: 42, actualHours: 30, variance: -12, status: 'Completed' },
      { name: 'Logo Concepts', originalPlan: 64, currentPlan: 76, actualHours: 36, variance: -40, status: 'In progress' },
      { name: 'Brand Guidelines', originalPlan: 74, currentPlan: 86, actualHours: 16, variance: -70, status: 'Active' },
    ],
    serviceTypes: [
      { name: 'Brand Strategy', currentPlan: 52, actualHours: 30, variance: -22 },
      { name: 'UX Design', currentPlan: 122, actualHours: 46, variance: -76 },
      { name: 'Project Management', currentPlan: 30, actualHours: 6, variance: -24 },
    ],
  },
  {
    id: 'lumen-portal-retainer',
    jobNumber: '1083',
    jobName: 'Portal Support Retainer',
    company: 'Lumen Health',
    jobType: 'Retainer',
    status: 'Completed',
    startDate: '2025-11-01',
    completionDate: '2026-04-30',
    originalPlan: 160,
    currentPlan: 160,
    actualHours: 154,
    changeOrders: 0,
    deliverables: [
      { name: 'Monthly Support', originalPlan: 96, currentPlan: 96, actualHours: 92, variance: -4, status: 'Completed' },
      { name: 'Analytics Cleanup', originalPlan: 36, currentPlan: 36, actualHours: 35, variance: -1, status: 'Completed' },
      { name: 'Planning Reviews', originalPlan: 28, currentPlan: 28, actualHours: 27, variance: -1, status: 'Completed' },
    ],
    serviceTypes: [
      { name: 'Development', currentPlan: 72, actualHours: 70, variance: -2 },
      { name: 'Analytics', currentPlan: 36, actualHours: 35, variance: -1 },
      { name: 'Project Management', currentPlan: 52, actualHours: 49, variance: -3 },
    ],
    retainerCycles: [
      {
        cycleKey: '2025-11',
        planHours: 168,
        actualHours: 155,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 86, variance: -10, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 34, variance: -2, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 28, variance: 0, status: 'Completed' },
          { name: 'Emergency Diagnostics', planHours: 8, actualHours: 7, variance: -1, status: 'Completed', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 80, actualHours: 73, variance: -7 },
          { name: 'Analytics', planHours: 36, actualHours: 34, variance: -2 },
          { name: 'Project Management', planHours: 52, actualHours: 48, variance: -4 },
        ],
      },
      {
        cycleKey: '2025-12',
        planHours: 170,
        actualHours: 168,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 98, variance: 2, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 37, variance: 1, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 27, variance: -1, status: 'Completed' },
          { name: 'Landing Page Fixes', planHours: 10, actualHours: 6, variance: -4, status: 'In Progress', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 82, actualHours: 80, variance: -2 },
          { name: 'Analytics', planHours: 36, actualHours: 37, variance: 1 },
          { name: 'Project Management', planHours: 52, actualHours: 51, variance: -1 },
        ],
      },
      {
        cycleKey: '2026-01',
        planHours: 164,
        actualHours: 156,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 89, variance: -7, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 35, variance: -1, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 27, variance: -1, status: 'Completed' },
          { name: 'Landing Page Fixes', planHours: 4, actualHours: 5, variance: 1, status: 'Completed', workType: 'One-off' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 76, actualHours: 73, variance: -3 },
          { name: 'Analytics', planHours: 36, actualHours: 35, variance: -1 },
          { name: 'Project Management', planHours: 52, actualHours: 48, variance: -4 },
        ],
      },
      {
        cycleKey: '2026-02',
        planHours: 160,
        actualHours: 159,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 96, variance: 0, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 35, variance: -1, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 28, variance: 0, status: 'Completed' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 72, actualHours: 72, variance: 0 },
          { name: 'Analytics', planHours: 36, actualHours: 35, variance: -1 },
          { name: 'Project Management', planHours: 52, actualHours: 52, variance: 0 },
        ],
      },
      {
        cycleKey: '2026-03',
        planHours: 160,
        actualHours: 156,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 94, variance: -2, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 35, variance: -1, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 27, variance: -1, status: 'Completed' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 72, actualHours: 71, variance: -1 },
          { name: 'Analytics', planHours: 36, actualHours: 35, variance: -1 },
          { name: 'Project Management', planHours: 52, actualHours: 50, variance: -2 },
        ],
      },
      {
        cycleKey: '2026-04',
        planHours: 160,
        actualHours: 154,
        changeOrders: 0,
        deliverables: [
          { name: 'Monthly Support', planHours: 96, actualHours: 92, variance: -4, status: 'Completed' },
          { name: 'Analytics Cleanup', planHours: 36, actualHours: 35, variance: -1, status: 'Completed' },
          { name: 'Planning Reviews', planHours: 28, actualHours: 27, variance: -1, status: 'Completed' },
        ],
        serviceTypes: [
          { name: 'Development', planHours: 72, actualHours: 70, variance: -2 },
          { name: 'Analytics', planHours: 36, actualHours: 35, variance: -1 },
          { name: 'Project Management', planHours: 52, actualHours: 49, variance: -3 },
        ],
      },
    ],
  },
  {
    id: 'apex-data-migration',
    jobNumber: '1066',
    jobName: 'Data Migration Strategy',
    company: 'Apex Legacy Group',
    jobType: 'Project',
    status: 'Archived',
    startDate: '2025-09-15',
    completionDate: '2026-01-22',
    originalPlan: 180,
    currentPlan: 196,
    actualHours: 204,
    changeOrders: 3,
    deliverables: [
      { name: 'Discovery + Inventory', originalPlan: 44, currentPlan: 44, actualHours: 48, variance: 4, status: 'Completed' },
      { name: 'Migration Map', originalPlan: 72, currentPlan: 84, actualHours: 88, variance: 4, status: 'Completed' },
      { name: 'Executive Report', originalPlan: 64, currentPlan: 68, actualHours: 68, variance: 0, status: 'Completed' },
    ],
    serviceTypes: [
      { name: 'Consulting', currentPlan: 132, actualHours: 140, variance: 8 },
      { name: 'QA Review', currentPlan: 28, actualHours: 26, variance: -2 },
      { name: 'Project Management', currentPlan: 36, actualHours: 38, variance: 2 },
    ],
  },
];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCycleLabel(cycleKey) {
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return cycleKey || '';
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function getCycleKeyFromDate(value) {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

function addMonthsToCycleKey(cycleKey, delta = 0) {
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return '';
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getRetainerEndDate(job) {
  if (!job || job.jobType !== 'Retainer') return job?.completionDate || null;
  if (job.completionDate) return job.completionDate;
  if (job.retainerEndDate) return job.retainerEndDate;
  if (job.billingStructure === 'fixed_term' && Number(job.billingDurationMonths) > 0 && job.startDate) {
    const startCycle = getCycleKeyFromDate(job.startDate);
    const endCycle = addMonthsToCycleKey(startCycle, Number(job.billingDurationMonths) - 1);
    const [yearStr, monthStr] = endCycle.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (year && month) {
      const lastDay = new Date(year, month, 0).getDate();
      return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    }
  }
  return null;
}

function getRetainerReportCycles(job) {
  const cycles = Array.isArray(job?.retainerCycles) ? job.retainerCycles : [];
  if (!cycles.length) return [];
  const startCycle = getCycleKeyFromDate(job.startDate) || cycles[0].cycleKey;
  const endDate = getRetainerEndDate(job);
  const endCycle = endDate ? getCycleKeyFromDate(endDate) : cycles[cycles.length - 1].cycleKey;
  return cycles.filter((cycle) => {
    const key = String(cycle.cycleKey || '');
    if (startCycle && key < startCycle) return false;
    if (endCycle && key > endCycle) return false;
    return true;
  });
}

function formatHours(value, { signed = false } = {}) {
  const n = Number(value) || 0;
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${Math.round(n)} hrs`;
}

function formatPercent(value) {
  const n = Number(value) || 0;
  return `${Math.round(n)}%`;
}

function remainingHours(job) {
  return Math.round((Number(job.currentPlan) || 0) - (Number(job.actualHours) || 0));
}

function varianceHours(job) {
  return Math.round((Number(job.actualHours) || 0) - (Number(job.currentPlan) || 0));
}

function cycleRemainingHours(cycle) {
  return Math.round((Number(cycle?.planHours) || 0) - (Number(cycle?.actualHours) || 0));
}

function cycleVarianceHours(cycle) {
  return Math.round((Number(cycle?.actualHours) || 0) - (Number(cycle?.planHours) || 0));
}

function cycleCapacityUsed(cycle) {
  const plan = Number(cycle?.planHours) || 0;
  if (plan <= 0) return 0;
  return ((Number(cycle?.actualHours) || 0) / plan) * 100;
}

function buildRetainerSummary(job) {
  const cycles = getRetainerReportCycles(job);
  const cycleCount = cycles.length;
  const totalPlan = cycles.reduce((sum, cycle) => sum + (Number(cycle.planHours) || 0), 0);
  const totalActual = cycles.reduce((sum, cycle) => sum + (Number(cycle.actualHours) || 0), 0);
  const remainingTotal = cycles.reduce((sum, cycle) => sum + cycleRemainingHours(cycle), 0);
  const totalChangeOrders = cycles.reduce((sum, cycle) => sum + (Number(cycle.changeOrders) || 0), 0);
  const monthsOverPlan = cycles.filter((cycle) => cycleVarianceHours(cycle) > 0).length;
  const monthsWithUnusedCapacity = cycles.filter((cycle) => cycleRemainingHours(cycle) > 0).length;
  const serviceTotals = new Map();

  cycles.forEach((cycle) => {
    (cycle.serviceTypes || []).forEach((service) => {
      const key = service.name || 'Service Type';
      serviceTotals.set(key, (serviceTotals.get(key) || 0) + (Number(service.actualHours) || 0));
    });
  });

  const topService = Array.from(serviceTotals.entries())
    .sort((a, b) => b[1] - a[1])[0] || ['-', 0];

  return {
    cycleCount,
    averageCapacityUsed: totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0,
    averageRemaining: cycleCount ? remainingTotal / cycleCount : 0,
    totalHoursUsed: totalActual,
    monthsOverPlan,
    monthsWithUnusedCapacity,
    totalChangeOrders,
    mostUsedService: topService[0],
    mostUsedServiceHours: topService[1],
  };
}

function jobStatusClass(status) {
  if (status === 'Active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  if (status === 'Completed') return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200';
  return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70';
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ExportMenu({ onCsv, onPrint }) {
  const [open, setOpen] = useState(false);

  return h('div', { className: 'relative' }, [
    h('button', {
      type: 'button',
      className: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800',
      onClick: () => setOpen((value) => !value),
    }, [
      h('span', null, 'Export'),
      h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' },
        h('path', { d: 'M6 9l6 6 6-6' })),
    ]),
    open
      ? h('div', { className: 'absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900' }, [
          h('button', {
            type: 'button',
            className: 'w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
            onClick: () => {
              onCsv?.();
              setOpen(false);
            },
          }, 'Export CSV'),
          h('button', {
            type: 'button',
            className: 'w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
            onClick: () => {
              onPrint?.();
              setOpen(false);
            },
          }, 'Print-friendly view'),
        ])
      : null,
  ]);
}

function FieldLabel({ children }) {
  return h('label', { className: 'space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, children);
}

function TextInput({ value, onChange, placeholder }) {
  return h('input', {
    value,
    placeholder,
    onChange: (event) => onChange(event.target.value),
    className: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-netnet-purple focus:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white',
  });
}

function SelectInput({ value, onChange, options }) {
  return h('select', {
    value,
    onChange: (event) => onChange(event.target.value),
    className: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-netnet-purple focus:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white',
  }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label)));
}

function dateMatchesRange(job, start, end) {
  if (!start && !end) return true;
  const dates = [job.startDate, job.completionDate].filter(Boolean);
  return dates.some((value) => {
    if (start && value < start) return false;
    if (end && value > end) return false;
    return true;
  });
}

function filterJobs(jobs, filters) {
  const nameTerm = filters.jobName.trim().toLowerCase();
  const numberTerm = filters.jobNumber.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filters.company && job.company !== filters.company) return false;
    if (nameTerm && !job.jobName.toLowerCase().includes(nameTerm)) return false;
    if (numberTerm && !job.jobNumber.toLowerCase().includes(numberTerm)) return false;
    if (filters.jobType && job.jobType !== filters.jobType) return false;
    if (filters.status && job.status !== filters.status) return false;
    if (!dateMatchesRange(job, filters.startDate, filters.endDate)) return false;
    return true;
  });
}

function exportListCsv(jobs) {
  const rows = [
    ['Job Number', 'Job Name', 'Company', 'Job Type', 'Status', 'Start Date', 'Completion Date'],
    ...jobs.map((job) => [
      job.jobNumber,
      job.jobName,
      job.company,
      job.jobType,
      job.status,
      job.startDate,
      job.completionDate || '-',
    ]),
  ];
  downloadCsv('jobs-report.csv', rows);
}

function exportProjectDetailCsv(job) {
  const rows = [
    ['Jobs Report Detail'],
    ['Job Number', job.jobNumber],
    ['Job Name', job.jobName],
    ['Company', job.company],
    ['Job Type', job.jobType],
    ['Status', job.status],
    ['Start Date', job.startDate],
    ['Completion Date', job.completionDate || '-'],
    ['Original Plan', formatHours(job.originalPlan)],
    ['Current Plan', formatHours(job.currentPlan)],
    ['Actual Hours', formatHours(job.actualHours)],
    ...(job.status === 'Active' ? [['Remaining Hours', formatHours(remainingHours(job))]] : []),
    ['Variance', formatHours(varianceHours(job), { signed: true })],
    ['Change Orders', job.changeOrders],
    [],
    ['Deliverable Breakdown'],
    ['Deliverable', 'Original Plan', 'Current Plan', 'Actual Hours', 'Variance', 'Status'],
    ...job.deliverables.map((row) => [
      row.name,
      formatHours(row.originalPlan),
      formatHours(row.currentPlan),
      formatHours(row.actualHours),
      formatHours(row.variance, { signed: true }),
      row.status,
    ]),
    [],
    ['Service Type Breakdown'],
    ['Service Type', 'Current Plan', 'Actual Hours', 'Variance'],
    ...job.serviceTypes.map((row) => [
      row.name,
      formatHours(row.currentPlan),
      formatHours(row.actualHours),
      formatHours(row.variance, { signed: true }),
    ]),
  ];
  downloadCsv(`jobs-report-${job.jobNumber}.csv`, rows);
}

function exportRetainerDetailCsv(job, cycle) {
  const summary = buildRetainerSummary(job);
  const selectedCycle = cycle || getRetainerReportCycles(job)[0] || {};
  const rows = [
    ['Jobs Report Retainer Detail'],
    ['Job Number', job.jobNumber],
    ['Job Name', job.jobName],
    ['Company', job.company],
    ['Job Type', job.jobType],
    ['Status', job.status],
    ['Retainer Start Date', job.startDate],
    ['Retainer End Date', getRetainerEndDate(job) || '-'],
    [],
    ['Retainer Summary'],
    ['Cycles', summary.cycleCount],
    ['Average Monthly Capacity Used', formatPercent(summary.averageCapacityUsed)],
    ['Average Remaining Capacity', formatHours(summary.averageRemaining)],
    ['Total Hours Used', formatHours(summary.totalHoursUsed)],
    ['Months Over Monthly Plan', summary.monthsOverPlan],
    ['Months With Unused Capacity', summary.monthsWithUnusedCapacity],
    ['Change Orders During Retainer', summary.totalChangeOrders],
    ['Most Used Service Type', `${summary.mostUsedService} (${formatHours(summary.mostUsedServiceHours)})`],
    [],
    ['Selected Month Detail'],
    ['Month', formatCycleLabel(selectedCycle.cycleKey)],
    ['Monthly Plan', formatHours(selectedCycle.planHours)],
    ['Actual Hours', formatHours(selectedCycle.actualHours)],
    ['Remaining Capacity', formatHours(cycleRemainingHours(selectedCycle))],
    ['Capacity Used', formatPercent(cycleCapacityUsed(selectedCycle))],
    ['Variance', formatHours(cycleVarianceHours(selectedCycle), { signed: true })],
    ['Change Orders This Month', selectedCycle.changeOrders || 0],
    [],
    ['Selected Month Deliverable Breakdown'],
    ['Deliverable', 'Monthly Plan', 'Actual Hours', 'Remaining', 'Variance'],
    ...(selectedCycle.deliverables || []).map((row) => [
      row.name,
      formatHours(row.planHours),
      formatHours(row.actualHours),
      formatHours((Number(row.planHours) || 0) - (Number(row.actualHours) || 0)),
      formatHours(row.variance, { signed: true }),
    ]),
    [],
    ['Selected Month Service Type Breakdown'],
    ['Service Type', 'Monthly Plan', 'Actual Hours', 'Variance'],
    ...(selectedCycle.serviceTypes || []).map((row) => [
      row.name,
      formatHours(row.planHours),
      formatHours(row.actualHours),
      formatHours(row.variance, { signed: true }),
    ]),
  ];
  downloadCsv(`jobs-report-${job.jobNumber}-${selectedCycle.cycleKey || 'retainer'}.csv`, rows);
}

function exportDetailCsv(job, cycle = null) {
  if (job?.jobType === 'Retainer') {
    exportRetainerDetailCsv(job, cycle);
    return;
  }
  exportProjectDetailCsv(job);
}

function SummaryStat({ label, value, subtext }) {
  return h('div', { className: 'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5' }, [
    h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white' }, value),
    subtext ? h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-slate-400' }, subtext) : null,
  ]);
}

function CompactSummaryStat({ label, value, subtext }) {
  return h('div', { className: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5' }, [
    h('div', { className: 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'mt-1 text-base font-semibold leading-tight tabular-nums text-slate-900 dark:text-white' }, value),
    subtext ? h('div', { className: 'mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400' }, subtext) : null,
  ]);
}

function JobsFilters({ filters, setFilters, companies }) {
  const datePickerCleanupRef = useRef(null);
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const closeDatePicker = () => {
    datePickerCleanupRef.current?.();
    datePickerCleanupRef.current = null;
  };
  const openDatePicker = (anchorEl, key) => {
    closeDatePicker();
    datePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value: filters[key] || '',
      onSelect: (nextDate) => update(key, nextDate || ''),
      onClear: () => update(key, ''),
      onClose: () => {
        datePickerCleanupRef.current = null;
        anchorEl?.focus?.();
      },
    });
  };

  const dateButtonClass = 'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-left text-sm text-slate-800 transition-colors hover:border-netnet-purple focus:border-netnet-purple focus:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white';
  const renderDateButton = (key, label) => h('button', {
    type: 'button',
    className: dateButtonClass,
    onClick: (event) => openDatePicker(event.currentTarget, key),
    'aria-label': `${label} date`,
  }, [
    h('span', { className: filters[key] ? 'truncate' : 'truncate text-slate-400 dark:text-slate-500' }, filters[key] ? formatDate(filters[key]) : 'Any date'),
    h('span', { className: 'shrink-0 text-slate-400 dark:text-slate-500', 'aria-hidden': 'true' }, 'v'),
  ]);

  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6' }, [
      h(FieldLabel, null, [
        h('span', null, 'Company'),
        h(SelectInput, {
          value: filters.company,
          onChange: (value) => update('company', value),
          options: [{ label: 'All companies', value: '' }, ...companies.map((company) => ({ label: company, value: company }))],
        }),
      ]),
      h(FieldLabel, null, [
        h('span', null, 'Job Name'),
        h(TextInput, {
          value: filters.jobName,
          onChange: (value) => update('jobName', value),
          placeholder: 'Search name',
        }),
      ]),
      h(FieldLabel, null, [
        h('span', null, 'Job Number'),
        h(TextInput, {
          value: filters.jobNumber,
          onChange: (value) => update('jobNumber', value),
          placeholder: 'Search number',
        }),
      ]),
      h(FieldLabel, null, [
        h('span', null, 'Job Type'),
        h(SelectInput, {
          value: filters.jobType,
          onChange: (value) => update('jobType', value),
          options: [
            { label: 'All types', value: '' },
            { label: 'Projects', value: 'Project' },
            { label: 'Retainers', value: 'Retainer' },
          ],
        }),
      ]),
      h(FieldLabel, null, [
        h('span', null, 'Job Status'),
        h(SelectInput, {
          value: filters.status,
          onChange: (value) => update('status', value),
          options: [
            { label: 'All statuses', value: '' },
            { label: 'Active', value: 'Active' },
            { label: 'Completed', value: 'Completed' },
            { label: 'Archived', value: 'Archived' },
          ],
        }),
      ]),
      h('div', { className: 'space-y-1.5' }, [
        h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Date Range'),
        h('div', { className: 'grid grid-cols-2 gap-2' }, [
          h(FieldLabel, null, [
            h('span', null, 'From'),
            renderDateButton('startDate', 'From'),
          ]),
          h(FieldLabel, null, [
            h('span', null, 'To'),
            renderDateButton('endDate', 'To'),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function JobsLookupTable({ jobs, onViewReport }) {
  const headerClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
  const cellClass = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-200';

  return h('div', { className: 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full divide-y divide-slate-100 dark:divide-white/10' }, [
        h('thead', { className: 'bg-slate-50 dark:bg-white/5' },
          h('tr', null, [
            h('th', { className: headerClass }, 'Job Number'),
            h('th', { className: headerClass }, 'Job Name'),
            h('th', { className: headerClass }, 'Company'),
            h('th', { className: headerClass }, 'Job Type'),
            h('th', { className: headerClass }, 'Status'),
            h('th', { className: headerClass }, 'Start Date'),
            h('th', { className: headerClass }, 'Completion Date'),
            h('th', { className: `${headerClass} text-right` }, 'View Report'),
          ])),
        h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/10' },
          jobs.length
            ? jobs.map((job) => h('tr', { key: job.id }, [
                h('td', { className: `${cellClass} font-mono` }, job.jobNumber),
                h('td', { className: `${cellClass} min-w-[220px] font-semibold text-slate-900 dark:text-white` }, job.jobName),
                h('td', { className: `${cellClass} min-w-[180px]` }, job.company),
                h('td', { className: cellClass }, job.jobType),
                h('td', { className: cellClass },
                  h('span', { className: `inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${jobStatusClass(job.status)}` }, job.status)),
                h('td', { className: cellClass }, formatDate(job.startDate)),
                h('td', { className: cellClass }, job.completionDate ? formatDate(job.completionDate) : '-'),
                h('td', { className: `${cellClass} text-right` },
                  h('button', {
                    type: 'button',
                    className: 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10',
                    onClick: () => onViewReport(job),
                  }, 'View Report')),
              ]))
            : h('tr', null,
                h('td', { className: 'px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400', colSpan: 8 }, 'No Jobs match these filters.'))
        ),
      ]))
  ]);
}

function BreakdownTable({ title, subtitle, columns, rows, renderRow }) {
  const headerClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return h('div', { className: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'border-b border-slate-100 px-5 py-4 dark:border-white/10' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
      subtitle ? h('p', { className: 'mt-1 text-sm text-slate-600 dark:text-slate-300' }, subtitle) : null,
    ]),
    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full divide-y divide-slate-100 dark:divide-white/10' }, [
        h('thead', { className: 'bg-slate-50 dark:bg-white/5' },
          h('tr', null, columns.map((column) => h('th', { key: column, className: headerClass }, column)))),
        h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/10' },
          rows.map(renderRow)),
      ])),
  ]);
}

function ProjectJobDetail({ job, onBack, onPrintFriendly, printFriendly }) {
  const cellClass = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-200';
  const variance = varianceHours(job);

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-4' }, [
      h('div', { className: 'space-y-2' }, [
        printFriendly ? null : h('button', {
          type: 'button',
          className: 'text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-300',
          onClick: onBack,
        }, 'Back to Jobs Report'),
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, `Job ${job.jobNumber}`),
          h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, job.jobName),
          h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
            h('span', null, job.company),
            h('span', { className: 'text-slate-300 dark:text-white/20' }, '|'),
            h('span', null, job.jobType),
            h('span', { className: 'text-slate-300 dark:text-white/20' }, '|'),
            h('span', { className: `inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${jobStatusClass(job.status)}` }, job.status),
          ]),
        ]),
      ]),
      printFriendly ? null : h(ExportMenu, {
        onCsv: () => exportDetailCsv(job),
        onPrint: onPrintFriendly,
      }),
    ]),
    h('div', { className: 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6' }, [
      h(SummaryStat, { label: 'Start Date', value: formatDate(job.startDate) }),
      h(SummaryStat, { label: 'Completion Date', value: job.completionDate ? formatDate(job.completionDate) : '-' }),
      h(SummaryStat, { label: 'Original Plan', value: formatHours(job.originalPlan) }),
      h(SummaryStat, { label: 'Current Plan', value: formatHours(job.currentPlan) }),
      h(SummaryStat, { label: 'Actual Hours', value: formatHours(job.actualHours) }),
      h(SummaryStat, { label: 'Change Orders', value: String(job.changeOrders) }),
    ]),
    h('div', { className: `grid grid-cols-1 gap-3 ${job.status === 'Active' ? 'md:grid-cols-2' : ''}` }, [
      job.status === 'Active'
        ? h(SummaryStat, { label: 'Remaining Hours', value: formatHours(remainingHours(job)), subtext: 'Current Plan minus Actual Hours' })
        : null,
      h(SummaryStat, { label: 'Variance', value: formatHours(variance, { signed: true }), subtext: variance > 0 ? 'Actual Hours over Current Plan' : 'Actual Hours under Current Plan' }),
    ].filter(Boolean)),
    h(BreakdownTable, {
      title: 'Deliverable Breakdown',
      subtitle: 'Plan and actual hours by deliverable.',
      columns: ['Deliverable', 'Original Plan', 'Current Plan', 'Actual Hours', 'Variance', 'Status'],
      rows: job.deliverables,
      renderRow: (row) => h('tr', { key: row.name }, [
        h('td', { className: `${cellClass} min-w-[220px] font-semibold text-slate-900 dark:text-white` }, row.name),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.originalPlan)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.currentPlan)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.actualHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.variance, { signed: true })),
        h('td', { className: cellClass }, row.status),
      ]),
    }),
    h(BreakdownTable, {
      title: 'Service Type Breakdown',
      subtitle: 'Hours grouped by service type.',
      columns: ['Service Type', 'Current Plan', 'Actual Hours', 'Variance'],
      rows: job.serviceTypes,
      renderRow: (row) => h('tr', { key: row.name }, [
        h('td', { className: `${cellClass} min-w-[220px] font-semibold text-slate-900 dark:text-white` }, row.name),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.currentPlan)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.actualHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.variance, { signed: true })),
      ]),
    }),
  ]);
}

function RetainerSummarySection({ job }) {
  const summary = buildRetainerSummary(job);
  const retainerEndDate = getRetainerEndDate(job);
  const retainerDateRange = `${formatDate(job.startDate)} -> ${retainerEndDate ? formatDate(retainerEndDate) : '-'}`;

  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'space-y-1' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Retainer Summary'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Overall hour pattern across this Retainer.'),
    ]),
    h('div', { className: 'mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5' }, [
      h(CompactSummaryStat, { label: 'Retainer Dates', value: retainerDateRange }),
      h(CompactSummaryStat, { label: 'Retainer Status', value: job.status }),
      h(CompactSummaryStat, { label: 'Cycles', value: String(summary.cycleCount), subtext: 'Monthly cycles' }),
      h(CompactSummaryStat, { label: 'Average Capacity Used', value: formatPercent(summary.averageCapacityUsed), subtext: 'Across cycles' }),
      h(CompactSummaryStat, { label: 'Average Remaining', value: formatHours(summary.averageRemaining), subtext: 'Monthly capacity' }),
      h(CompactSummaryStat, { label: 'Total Hours Used', value: formatHours(summary.totalHoursUsed) }),
      h(CompactSummaryStat, { label: 'Months Over Plan', value: String(summary.monthsOverPlan) }),
      h(CompactSummaryStat, { label: 'Months With Unused Capacity', value: String(summary.monthsWithUnusedCapacity) }),
      h(CompactSummaryStat, { label: 'Change Orders', value: String(summary.totalChangeOrders), subtext: 'During Retainer' }),
      h(CompactSummaryStat, {
        label: 'Most Used Service Type',
        value: summary.mostUsedService,
        subtext: formatHours(summary.mostUsedServiceHours),
      }),
    ]),
  ]);
}

function RetainerMonthSelector({ cycles, selectedIndex, onSelect }) {
  const first = selectedIndex <= 0;
  const last = selectedIndex >= cycles.length - 1;
  const selectedCycle = cycles[selectedIndex] || cycles[0];
  const baseButton = 'h-9 w-9 rounded-full border text-sm font-semibold transition';
  const activeButton = 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10';
  const disabledButton = 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-white/5 dark:bg-white/5 dark:text-white/25';

  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Month Selector'),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Move through monthly Retainer cycles.'),
      ]),
      h('div', { className: 'inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-white/10 dark:bg-white/5' }, [
        h('button', {
          type: 'button',
          disabled: first,
          className: `${baseButton} ${first ? disabledButton : activeButton}`,
          onClick: () => !first && onSelect(selectedIndex - 1),
          'aria-label': 'Previous month',
        }, '<'),
        h('div', { className: 'min-w-[132px] text-center text-sm font-semibold text-slate-900 dark:text-white' }, formatCycleLabel(selectedCycle?.cycleKey)),
        h('button', {
          type: 'button',
          disabled: last,
          className: `${baseButton} ${last ? disabledButton : activeButton}`,
          onClick: () => !last && onSelect(selectedIndex + 1),
          'aria-label': 'Next month',
        }, '>'),
      ]),
    ]),
  ]);
}

function RetainerMonthlyDetail({ cycle }) {
  const cellClass = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-200';

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80' }, [
      h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, `${formatCycleLabel(cycle.cycleKey)} Detail`),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Monthly plan, actuals, remaining capacity, and scope movement.'),
        ]),
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Selected Month'),
      ]),
      h('div', { className: 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6' }, [
        h(SummaryStat, { label: 'Monthly Plan', value: formatHours(cycle.planHours) }),
        h(SummaryStat, { label: 'Actual Hours', value: formatHours(cycle.actualHours) }),
        h(SummaryStat, { label: 'Remaining Capacity', value: formatHours(cycleRemainingHours(cycle)) }),
        h(SummaryStat, { label: 'Capacity Used', value: formatPercent(cycleCapacityUsed(cycle)) }),
        h(SummaryStat, { label: 'Variance', value: formatHours(cycleVarianceHours(cycle), { signed: true }) }),
        h(SummaryStat, { label: 'Change Orders This Month', value: String(cycle.changeOrders || 0) }),
      ]),
    ]),
    h(BreakdownTable, {
      title: 'Monthly Deliverable Breakdown',
      subtitle: 'One-off work appears only in the month or months where it was active.',
      columns: ['Deliverable', 'Monthly Plan', 'Actual Hours', 'Remaining', 'Variance'],
      rows: cycle.deliverables || [],
      renderRow: (row) => h('tr', { key: row.name }, [
        h('td', { className: `${cellClass} min-w-[220px] font-semibold text-slate-900 dark:text-white` }, row.name),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.planHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.actualHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours((Number(row.planHours) || 0) - (Number(row.actualHours) || 0))),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.variance, { signed: true })),
      ]),
    }),
    h(BreakdownTable, {
      title: 'Monthly Service Type Breakdown',
      subtitle: 'Hours grouped by service type for this cycle.',
      columns: ['Service Type', 'Monthly Plan', 'Actual Hours', 'Variance'],
      rows: cycle.serviceTypes || [],
      renderRow: (row) => h('tr', { key: row.name }, [
        h('td', { className: `${cellClass} min-w-[220px] font-semibold text-slate-900 dark:text-white` }, row.name),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.planHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.actualHours)),
        h('td', { className: `${cellClass} tabular-nums` }, formatHours(row.variance, { signed: true })),
      ]),
    }),
  ]);
}

function RetainerJobDetail({ job, onBack, onPrintFriendly, printFriendly }) {
  const cycles = getRetainerReportCycles(job);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedCycle = cycles[selectedIndex] || cycles[0];

  if (!selectedCycle) {
    return h(ProjectJobDetail, { job, onBack, onPrintFriendly, printFriendly });
  }

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-4' }, [
      h('div', { className: 'space-y-2' }, [
        printFriendly ? null : h('button', {
          type: 'button',
          className: 'text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-300',
          onClick: onBack,
        }, 'Back to Jobs Report'),
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, `Job ${job.jobNumber}`),
          h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, job.jobName),
          h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
            h('span', null, job.company),
            h('span', { className: 'text-slate-300 dark:text-white/20' }, '|'),
            h('span', null, job.jobType),
            h('span', { className: 'text-slate-300 dark:text-white/20' }, '|'),
            h('span', { className: `inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${jobStatusClass(job.status)}` }, job.status),
          ]),
        ]),
      ]),
      printFriendly ? null : h(ExportMenu, {
        onCsv: () => exportDetailCsv(job, selectedCycle),
        onPrint: onPrintFriendly,
      }),
    ]),
    h(RetainerSummarySection, { job }),
    printFriendly
      ? h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-white' }, [
          h('span', null, `Selected month: ${formatCycleLabel(selectedCycle.cycleKey)}`),
        ])
      : h(RetainerMonthSelector, {
          cycles,
          selectedIndex,
          onSelect: setSelectedIndex,
        }),
    h(RetainerMonthlyDetail, { cycle: selectedCycle }),
  ]);
}

export function JobsReport({ printFriendly = false, onPrintFriendly }) {
  const [filters, setFilters] = useState({
    company: '',
    jobName: '',
    jobNumber: '',
    jobType: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [selectedJob, setSelectedJob] = useState(null);

  const companies = useMemo(
    () => [...new Set(JOBS_REPORT_DEMO_JOBS.map((job) => job.company))].sort((a, b) => a.localeCompare(b)),
    []
  );
  const filteredJobs = useMemo(() => filterJobs(JOBS_REPORT_DEMO_JOBS, filters), [filters]);

  if (selectedJob) {
    const DetailComponent = selectedJob.jobType === 'Retainer' ? RetainerJobDetail : ProjectJobDetail;
    return h(DetailComponent, {
      job: selectedJob,
      onBack: () => setSelectedJob(null),
      onPrintFriendly,
      printFriendly,
    });
  }

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-4' }, [
      h('div', { className: 'max-w-3xl space-y-2' }, [
        h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Jobs Report'),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Find current and historical Jobs by company, name, number, type, status, and date range.'),
      ]),
      printFriendly ? null : h(ExportMenu, {
        onCsv: () => exportListCsv(filteredJobs),
        onPrint: onPrintFriendly,
      }),
    ]),
    printFriendly ? null : h(JobsFilters, { filters, setFilters, companies }),
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Jobs'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filteredJobs.length} result${filteredJobs.length === 1 ? '' : 's'}`),
    ]),
    h(JobsLookupTable, {
      jobs: filteredJobs,
      onViewReport: (job) => setSelectedJob(job),
    }),
  ]);
}
