export const mockSalesOpportunities = [
  {
    id: '1',
    name: 'Northstar Rebrand',
    company: 'Northstar Health',
    person: 'Lena Park',
    clarity: 'clear',
    type: 'both',
    status: 'open',
    linkedJobsCount: 3,
    estimatedTiming: 'Jun 2026',
    estimatedStartDate: '2026-06-10',
    estimatedCompletionDate: '2026-09-30',
    projectValue: '$25,000',
    retainerValue: '$5,000/mo',
    ownerId: 'team_marc_pitre',
    lastModified: '2d ago',
    value: {
      project: {
        budget: '$25,000',
        baseValue: '$18,000',
        overrideValue: '$25,000',
        effectiveValue: '$25,000',
      },
      retainer: {
        monthlyValue: '$5,000/mo',
        durationMonths: 12,
        baseMonthly: '$4,200/mo',
        overrideMonthly: '$5,000/mo',
        effectiveMonthly: '$5,000/mo',
        reportedTotal: '$60,000 total',
      },
    },
    linkedJobs: [
      { id: 'job_101', jobNumber: 'NN-101', name: 'Brand Strategy Sprint', status: 'Active' },
      { id: 'job_104', jobNumber: 'NN-104', name: 'Website Refresh', status: 'Planned' },
      { id: 'job_118', jobNumber: 'NN-118', name: 'Retention Campaign', status: 'At Risk' },
    ],
    tasks: [
      {
        id: 'opp_task_1',
        title: 'Finalize discovery brief',
        status: 'backlog',
        assigneeId: 'team_marc_pitre',
        dueDate: '2026-06-18',
        startDate: '2026-06-11',
      },
      {
        id: 'opp_task_2',
        title: 'Review retained scope with Lena',
        status: 'in_progress',
        assigneeId: 'team_arthur_iturres',
        dueDate: '2026-04-03',
        startDate: '2026-03-27',
      },
      {
        id: 'opp_task_3',
        title: 'Map linked Jobs and owners',
        status: 'completed',
        assigneeId: 'team_andres_naranjo',
        dueDate: '2026-03-21',
        startDate: '2026-03-14',
      },
      {
        id: 'opp_task_4',
        title: 'Draft kickoff timeline',
        status: 'backlog',
        assigneeId: 'team_kumail_abas',
        dueDate: '2026-06-24',
        startDate: '2026-06-17',
      },
    ],
    activities: [
      { type: 'note', text: 'Client confirmed they want project work plus an ongoing advisory retainer.', date: '2026-03-28', user: 'Marc' },
      { type: 'system', title: 'Value override applied', text: 'Project and retainer overrides are now the effective values.', date: '2026-03-27' },
      { type: 'note', text: 'Override approved after internal pricing review.', date: '2026-03-26', user: 'Arthur' },
      { type: 'email', subject: 'Updated opportunity scope', snippet: 'Sending revised project and retainer scope for review.', date: '2026-03-24' },
      { type: 'task', title: 'Review retained scope with Lena', text: 'Task moved into active follow-up.', date: '2026-03-23' },
      { type: 'meeting', title: 'Discovery debrief with Northstar team', date: '2026-03-22' },
      { type: 'task', title: 'Map linked Jobs and owners', text: 'Task marked complete.', date: '2026-03-21' },
    ],
  },
  {
    id: '2',
    name: 'Q3 Launch Sprint',
    company: 'Atlas Consumer',
    person: 'Mason Reed',
    clarity: 'emerging',
    type: 'project',
    status: 'on-hold',
    linkedJobsCount: 0,
    estimatedTiming: 'Jun -> Aug',
    estimatedStartDate: '2026-06-15',
    estimatedCompletionDate: '2026-08-20',
    projectValue: '$18,500',
    retainerValue: '',
    ownerId: 'team_arthur_iturres',
    lastModified: 'Mar 21',
  },
  {
    id: '3',
    name: 'Growth Advisory',
    company: 'Helio Labs',
    person: '',
    clarity: 'fog',
    type: 'retainer',
    status: 'open',
    linkedJobsCount: 1,
    estimatedTiming: 'Jul 2026',
    estimatedStartDate: '2026-07-01',
    estimatedCompletionDate: '2027-06-30',
    projectValue: '',
    retainerValue: '$5,000/mo',
    ownerId: 'team_andres_naranjo',
    lastModified: '5d ago',
  },
  {
    id: '4',
    name: 'Packaging Rollout',
    company: 'Pine & Co.',
    person: 'Noah Bennett',
    clarity: 'clear',
    type: 'both',
    status: 'won',
    linkedJobsCount: 3,
    estimatedTiming: 'Jun -> Sep',
    estimatedStartDate: '2026-06-02',
    estimatedCompletionDate: '2026-09-15',
    projectValue: '$25,000',
    retainerValue: '$5,000/mo',
    ownerId: 'team_marc_pitre',
    lastModified: '1d ago',
  },
  {
    id: '5',
    name: 'Website Refresh',
    company: 'Summit Foods',
    person: 'Avery Cole',
    clarity: 'emerging',
    type: 'project',
    status: 'open',
    linkedJobsCount: 1,
    estimatedTiming: 'Aug 2026',
    estimatedStartDate: '2026-08-03',
    estimatedCompletionDate: '2026-10-02',
    projectValue: '$31,900',
    retainerValue: '',
    ownerId: 'team_kumail_abas',
    lastModified: 'Mar 18',
  },
  {
    id: '6',
    name: 'Investor Deck + Advisory',
    company: 'Motive Capital',
    person: 'Priya Shah',
    clarity: 'fog',
    type: 'both',
    status: 'lost',
    linkedJobsCount: 0,
    estimatedTiming: '-',
    estimatedStartDate: '',
    estimatedCompletionDate: '',
    projectValue: '$9,800',
    retainerValue: '$3,000/mo',
    ownerId: 'team_arthur_iturres',
    lastModified: 'Mar 12',
  },
  {
    id: '7',
    name: 'Marketing Ops Retainer',
    company: 'Graybridge Group',
    person: '',
    clarity: 'clear',
    type: 'retainer',
    status: 'won',
    linkedJobsCount: 2,
    estimatedTiming: 'Jun 2026',
    estimatedStartDate: '2026-06-01',
    estimatedCompletionDate: '2027-05-31',
    projectValue: '',
    retainerValue: '$7,500/mo',
    ownerId: 'team_andres_naranjo',
    lastModified: '3d ago',
  },
  {
    id: '8',
    name: 'Brand Refresh',
    company: 'Oakwell Studio',
    person: 'Jules Carter',
    clarity: 'fog',
    type: 'project',
    status: 'open',
    linkedJobsCount: 0,
    estimatedTiming: 'Jul 2026',
    estimatedStartDate: '2026-07-08',
    estimatedCompletionDate: '2026-08-30',
    projectValue: '$14,250',
    retainerValue: '',
    ownerId: 'team_kumail_abas',
    lastModified: '7d ago',
  },
  {
    id: '9',
    name: 'Partnership Expansion',
    company: 'Greenline Energy',
    person: 'Eli Torres',
    clarity: 'emerging',
    type: 'retainer',
    status: 'on-hold',
    linkedJobsCount: 1,
    estimatedTiming: 'Sep 2026',
    estimatedStartDate: '2026-09-10',
    estimatedCompletionDate: '2027-09-09',
    projectValue: '',
    retainerValue: '$4,200/mo',
    ownerId: 'team_marc_pitre',
    lastModified: 'Mar 9',
  },
  {
    id: '10',
    name: 'Seasonal Campaign Bundle',
    company: 'Riverside Retail',
    person: 'Camila Flores',
    clarity: 'clear',
    type: 'both',
    status: 'open',
    linkedJobsCount: 2,
    estimatedTiming: 'Jun -> Aug',
    estimatedStartDate: '2026-06-05',
    estimatedCompletionDate: '2026-08-28',
    projectValue: '$36,000',
    retainerValue: '$6,500/mo',
    ownerId: 'team_arthur_iturres',
    lastModified: 'Today',
  },
];

export const mockSalesJobOptions = [
  { id: 'job_101', jobNumber: 'NN-101', name: 'Brand Strategy Sprint', status: 'Active', projectBaseValue: 8000, retainerBaseMonthly: 2000 },
  { id: 'job_104', jobNumber: 'NN-104', name: 'Website Refresh', status: 'Planned', projectBaseValue: 6000, retainerBaseMonthly: 1200 },
  { id: 'job_118', jobNumber: 'NN-118', name: 'Retention Campaign', status: 'At Risk', projectBaseValue: 4000, retainerBaseMonthly: 1000 },
  { id: 'job_121', jobNumber: 'NN-121', name: 'Campaign Production', status: 'Pending', projectBaseValue: 5500, retainerBaseMonthly: 1500 },
  { id: 'job_135', jobNumber: 'NN-135', name: 'Lifecycle Automation', status: 'Active', projectBaseValue: 7000, retainerBaseMonthly: 1800 },
  { id: 'job_142', jobNumber: 'NN-142', name: 'Quarterly Advisory Sprint', status: 'Completed', projectBaseValue: 3200, retainerBaseMonthly: 900 },
];

function nextOpportunityId() {
  const maxId = mockSalesOpportunities.reduce((acc, item) => Math.max(acc, Number(item?.id) || 0), 0);
  return String(maxId + 1);
}

function parseCurrency(raw) {
  const cleaned = String(raw || '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function hasOwn(source, key) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

function resolveField(source, key, fallback = '') {
  return hasOwn(source, key) ? source[key] : fallback;
}

function formatCurrency(raw) {
  const numeric = typeof raw === 'number' ? raw : parseCurrency(raw);
  if (numeric === null) return String(raw || '').trim();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatMonthlyValue(raw) {
  const base = formatCurrency(raw);
  if (!base) return '';
  return base.includes('/mo') ? base : `${base}/mo`;
}

function findJobValueSource(job) {
  if (!job) return null;
  return mockSalesJobOptions.find((option) => String(option.id) === String(job.id)) || job;
}

function sumLinkedJobValues(linkedJobs = []) {
  return (linkedJobs || []).reduce((acc, job) => {
    const source = findJobValueSource(job);
    acc.project += Number(source?.projectBaseValue) || 0;
    acc.retainer += Number(source?.retainerBaseMonthly) || 0;
    return acc;
  }, { project: 0, retainer: 0 });
}

function hasProjectBudget(financial = {}, existingValue = {}) {
  const projectInput = financial.project || {};
  const rawBudget = resolveField(projectInput, 'budget', existingValue?.project?.budget || '');
  return parseCurrency(rawBudget) !== null;
}

function deriveClarity(linkedJobs = [], financial = {}, existingValue = {}) {
  if ((linkedJobs || []).length > 0) return 'clear';
  if (hasProjectBudget(financial, existingValue)) return 'emerging';
  return 'fog';
}

function formatEstimatedTiming(startDate, completionDate) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = completionDate ? new Date(`${completionDate}T00:00:00`) : null;
  const isValid = (value) => value && !Number.isNaN(value.getTime());
  if (!isValid(start) && !isValid(end)) return '-';
  const fmt = (date) => date.toLocaleDateString('en-US', { month: 'short' });
  const fmtMonthYear = (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (isValid(start) && isValid(end)) {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return fmtMonthYear(start);
    }
    return `${fmt(start)} -> ${fmt(end)}`;
  }
  return fmtMonthYear(start || end);
}

function buildReportedTotal(retainer = {}) {
  const monthly = parseCurrency(retainer.effectiveMonthly || retainer.overrideMonthly || retainer.monthlyValue || retainer.baseMonthly);
  if (monthly === null) return '';
  const durationType = retainer.durationType === 'fixed' ? 'fixed' : 'ongoing';
  const durationMonths = durationType === 'fixed'
    ? Math.max(1, Number(retainer.durationMonths) || 1)
    : 12;
  return `${formatCurrency(monthly * durationMonths)} total`;
}

function buildValueBlock(type, financial = {}, linkedJobs = [], existingValue = {}) {
  const projectInput = financial.project || {};
  const retainerInput = financial.retainer || {};
  const linkedValues = sumLinkedJobValues(linkedJobs);
  const projectBudgetRaw = resolveField(projectInput, 'budget', existingValue?.project?.budget || '');
  const projectOverrideRaw = resolveField(projectInput, 'overrideValue', existingValue?.project?.overrideValue || '');
  const projectBaseRaw = linkedValues.project > 0
    ? linkedValues.project
    : resolveField(projectInput, 'baseValue', existingValue?.project?.baseValue || '');
  const projectEffectiveRaw = projectOverrideRaw || projectBaseRaw || projectBudgetRaw || '';
  const project = {
    budget: formatCurrency(projectBudgetRaw),
    baseValue: formatCurrency(projectBaseRaw),
    overrideValue: formatCurrency(projectOverrideRaw),
    effectiveValue: formatCurrency(projectEffectiveRaw),
  };

  const retainerMonthlyRaw = resolveField(retainerInput, 'monthlyValue', existingValue?.retainer?.monthlyValue || '');
  const retainerOverrideRaw = resolveField(retainerInput, 'overrideMonthly', existingValue?.retainer?.overrideMonthly || '');
  const retainerBaseRaw = linkedValues.retainer > 0
    ? linkedValues.retainer
    : resolveField(retainerInput, 'baseMonthly', existingValue?.retainer?.baseMonthly || '');
  const durationType = resolveField(retainerInput, 'durationType', existingValue?.retainer?.durationType === 'fixed' ? 'fixed' : 'ongoing') === 'fixed'
    ? 'fixed'
    : 'ongoing';
  const durationMonths = durationType === 'fixed'
    ? Math.max(1, Number(resolveField(retainerInput, 'durationMonths', existingValue?.retainer?.durationMonths || 1)) || 1)
    : 12;
  const retainerEffectiveRaw = retainerOverrideRaw || retainerBaseRaw || retainerMonthlyRaw || '';
  const retainer = {
    monthlyValue: formatMonthlyValue(retainerMonthlyRaw),
    durationType,
    durationMonths,
    baseMonthly: formatMonthlyValue(retainerBaseRaw),
    overrideMonthly: formatMonthlyValue(retainerOverrideRaw),
    effectiveMonthly: formatMonthlyValue(retainerEffectiveRaw),
  };
  retainer.reportedTotal = buildReportedTotal(retainer);

  if (type === 'project') return { project, retainer: null };
  if (type === 'retainer') return { project: null, retainer };
  return { project, retainer };
}

function mapLinkedJobs(linkedJobIds = null, existingJobs = []) {
  if (!Array.isArray(linkedJobIds)) {
    return existingJobs;
  }
  return linkedJobIds
    .map((id) => String(id))
    .map((jobId) => mockSalesJobOptions.find((job) => String(job.id) === jobId))
    .filter(Boolean)
    .map((job) => ({ ...job }));
}

function normalizeOpportunity(input = {}, existing = null) {
  const type = input.type || existing?.type || 'project';
  const linkedJobs = mapLinkedJobs(input.linkedJobIds, input.linkedJobs || existing?.linkedJobs || []);
  const value = buildValueBlock(type, input.financial || {}, linkedJobs, existing?.value || {});

  const projectValue = value?.project?.effectiveValue || '';
  const retainerValue = value?.retainer?.effectiveMonthly || '';

  return {
    ...(existing || {}),
    id: String(input.id || existing?.id || nextOpportunityId()),
    name: String(input.name || existing?.name || '').trim(),
    company: String(input.company || existing?.company || '').trim(),
    person: String(input.person || existing?.person || '').trim(),
    clarity: deriveClarity(linkedJobs, input.financial || {}, existing?.value || {}),
    type,
    status: input.status || existing?.status || 'open',
    description: String(input.description || existing?.description || '').trim(),
    estimatedStartDate: input.estimatedStartDate || existing?.estimatedStartDate || '',
    estimatedCompletionDate: input.estimatedCompletionDate || existing?.estimatedCompletionDate || '',
    estimatedTiming: formatEstimatedTiming(
      input.estimatedStartDate || existing?.estimatedStartDate || '',
      input.estimatedCompletionDate || existing?.estimatedCompletionDate || ''
    ),
    projectValue,
    retainerValue,
    ownerId: input.ownerId || existing?.ownerId || 'team_marc_pitre',
    lastModified: 'Today',
    value,
    linkedJobs,
    linkedJobsCount: linkedJobs.length,
    linkedJobIds: linkedJobs.map((job) => String(job.id)),
    tasks: Array.isArray(input.tasks) ? input.tasks : (existing?.tasks || []),
    activities: Array.isArray(input.activities) ? input.activities : (existing?.activities || []),
  };
}

export function getMockSalesOpportunity(id) {
  return mockSalesOpportunities.find((opportunity) => String(opportunity.id) === String(id)) || null;
}

export function prepareMockSalesOpportunity(payload = {}) {
  const existing = payload?.id ? getMockSalesOpportunity(payload.id) : null;
  return normalizeOpportunity(payload, existing);
}

export function saveMockSalesOpportunity(payload = {}) {
  const normalized = prepareMockSalesOpportunity(payload);
  const existing = normalized?.id ? getMockSalesOpportunity(normalized.id) : null;
  if (existing) {
    const index = mockSalesOpportunities.findIndex((item) => String(item.id) === String(existing.id));
    if (index >= 0) {
      mockSalesOpportunities[index] = normalized;
    }
  } else {
    mockSalesOpportunities.unshift(normalized);
  }

  if (typeof window !== 'undefined') {
    window.mockSalesOpportunities = mockSalesOpportunities;
  }

  return normalized;
}

if (typeof window !== 'undefined') {
  window.mockSalesOpportunities = mockSalesOpportunities;
}
