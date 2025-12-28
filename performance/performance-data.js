function getDateShifted(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const performanceJobs = [
  { id: 101, name: 'NCBF Web Redesign', client: 'National Cherry Blossom Festival', estHours: 200, actualHours: 92, startDate: getDateShifted(-25), plannedEnd: getDateShifted(20), status: 'active', serviceType: 'Web' },
  { id: 102, name: 'Quantum Leap Website', client: 'Future Systems', estHours: 340, actualHours: 260, startDate: getDateShifted(-60), plannedEnd: getDateShifted(45), status: 'active', serviceType: 'Web' },
  { id: 103, name: 'Data Migration Strategy', client: 'Legacy Corp', estHours: 180, actualHours: 140, startDate: getDateShifted(-40), plannedEnd: getDateShifted(25), status: 'active', serviceType: 'Consulting' },
  { id: 104, name: 'Mobile App Revamp', client: 'Appify', estHours: 480, actualHours: 210, startDate: getDateShifted(-18), plannedEnd: getDateShifted(42), status: 'active', serviceType: 'Mobile' },
  { id: 105, name: 'Fathom SEO Sprint', client: 'Fathom', estHours: 120, actualHours: 118, startDate: getDateShifted(-35), plannedEnd: getDateShifted(-2), status: 'completed', serviceType: 'SEO' },
  { id: 106, name: 'Right Here Rebrand', client: 'Right Here Interactive', estHours: 260, actualHours: 82, startDate: getDateShifted(-10), plannedEnd: getDateShifted(55), status: 'active', serviceType: 'Brand' },
];

export const performanceDeliverables = [
  { id: 201, jobId: 102, name: 'API Integration', owner: 'Sam', due: getDateShifted(-2), effortConsumed: 112, durationConsumed: 108, estHours: 50, status: 'completed', completedAt: getDateShifted(-1), originalDue: getDateShifted(-5), changedAt: getDateShifted(-7) },
  { id: 202, jobId: 103, name: 'Final Report Delivery', owner: 'Maria', due: getDateShifted(3), effortConsumed: 102, durationConsumed: 115, estHours: 30, status: 'in-progress', originalDue: getDateShifted(1), changedAt: getDateShifted(-2) },
  { id: 203, jobId: 102, name: 'Frontend Deployment', owner: 'Alex', due: getDateShifted(5), effortConsumed: 98, durationConsumed: 101, estHours: 60, status: 'completed', completedAt: getDateShifted(-4) },
  { id: 204, jobId: 104, name: 'Wireframes', owner: 'Sarah', due: getDateShifted(12), effortConsumed: 42, durationConsumed: 35, estHours: 90, status: 'in-progress' },
  { id: 205, jobId: 104, name: 'Usability Test', owner: 'Chris', due: getDateShifted(18), effortConsumed: 76, durationConsumed: 80, estHours: 60, status: 'in-progress' },
  { id: 206, jobId: 101, name: 'Homepage Refresh', owner: 'Priya', due: getDateShifted(7), effortConsumed: 64, durationConsumed: 70, estHours: 80, status: 'in-progress' },
  { id: 207, jobId: 101, name: 'Content Migration', owner: 'Ashley', due: getDateShifted(14), effortConsumed: 54, durationConsumed: 58, estHours: 60, status: 'in-progress' },
  { id: 208, jobId: 105, name: 'SEO Audit', owner: 'Leo', due: getDateShifted(-1), effortConsumed: 88, durationConsumed: 92, estHours: 50, status: 'completed', completedAt: getDateShifted(-1) },
  { id: 209, jobId: 106, name: 'Brand Guidelines', owner: 'Nora', due: getDateShifted(25), effortConsumed: 48, durationConsumed: 44, estHours: 120, status: 'in-progress' },
  { id: 210, jobId: 106, name: 'Logo Concepts', owner: 'Nora', due: getDateShifted(9), effortConsumed: 82, durationConsumed: 78, estHours: 90, status: 'completed', completedAt: getDateShifted(-3), originalDue: getDateShifted(5), changedAt: getDateShifted(-1) },
  { id: 211, jobId: 103, name: 'Data Mapping', owner: 'Maria', due: getDateShifted(-4), effortConsumed: 118, durationConsumed: 120, estHours: 40, status: 'completed', completedAt: getDateShifted(-6) },
  { id: 212, jobId: 102, name: 'Performance Tuning', owner: 'Sam', due: getDateShifted(2), effortConsumed: 84, durationConsumed: 88, estHours: 55, status: 'in-progress' },
];

export const performanceServiceTypes = [
  { id: 'web', name: 'Web' },
  { id: 'mobile', name: 'Mobile' },
  { id: 'consulting', name: 'Consulting' },
  { id: 'seo', name: 'SEO' },
  { id: 'brand', name: 'Brand' },
  { id: 'ux', name: 'UX' },
];

export const performanceTimeEntries = [
  { id: 'te1', taskId: 't1', serviceTypeId: 'web', hours: 6, date: getDateShifted(-2), notes: 'API refactor' },
  { id: 'te2', taskId: 't1', serviceTypeId: 'web', hours: 4, date: getDateShifted(-10), notes: 'Pair with Alex' },
  { id: 'te3', taskId: 't2', serviceTypeId: 'consulting', hours: 5, date: getDateShifted(-8), notes: 'Findings draft' },
  { id: 'te4', taskId: 't3', serviceTypeId: 'web', hours: 7, date: getDateShifted(-20), notes: 'Frontend deploy prep' },
  { id: 'te5', taskId: 't4', serviceTypeId: 'ux', hours: 6, date: getDateShifted(-15), notes: 'Wireframe polish' },
  { id: 'te6', taskId: 't5', serviceTypeId: 'mobile', hours: 8, date: getDateShifted(-6), notes: 'Device matrix test' },
  { id: 'te7', taskId: 't6', serviceTypeId: 'web', hours: 5, date: getDateShifted(-27), notes: 'Copy pass' },
  { id: 'te8', taskId: 't7', serviceTypeId: 'web', hours: 3, date: getDateShifted(-4), notes: 'Migration checklist' },
  { id: 'te9', taskId: 't9', serviceTypeId: 'brand', hours: 4, date: getDateShifted(-12), notes: 'Color refinement' },
  { id: 'te10', taskId: 't10', serviceTypeId: 'brand', hours: 6, date: getDateShifted(-3), notes: 'Logo round 2' },
  { id: 'te11', taskId: 't11', serviceTypeId: 'consulting', hours: 4, date: getDateShifted(-18), notes: 'Map dependencies' },
  { id: 'te12', taskId: 't12', serviceTypeId: 'web', hours: 5, date: getDateShifted(-1), notes: 'Perf tuning' },
  { id: 'te13', taskId: 't8', serviceTypeId: 'seo', hours: 2, date: getDateShifted(-5), notes: 'Meta fix' },
  { id: 'te14', taskId: 't5', serviceTypeId: 'mobile', hours: 4, date: getDateShifted(-32) }, // outside lookback
  { id: 'te15', taskId: 't4', serviceTypeId: 'ux', hours: 2, date: getDateShifted(-5), notes: 'Microcopy' },
  { id: 'te16', taskId: 't14', serviceTypeId: 'web', hours: 3, date: getDateShifted(-9), notes: 'QA sweep' },
  { id: 'te17', taskId: 't1', serviceTypeId: 'web', hours: 20, date: getDateShifted(-8), notes: 'API hardening' },
  { id: 'te18', taskId: 't1', serviceTypeId: 'web', hours: 20, date: getDateShifted(-14), notes: 'Regression fixes' },
  { id: 'te19', taskId: 't3', serviceTypeId: 'web', hours: 25, date: getDateShifted(-5), notes: 'Frontend load tests' },
  { id: 'te20', taskId: 't3', serviceTypeId: 'web', hours: 20, date: getDateShifted(-1), notes: 'Cache tuning' },
  { id: 'te21', taskId: 't3', serviceTypeId: 'web', hours: 20, date: getDateShifted(-12), notes: 'Optimize bundle' },
  { id: 'te22', taskId: 't10', serviceTypeId: 'brand', hours: 40, date: getDateShifted(-7), notes: 'Logo round 3' },
  { id: 'te23', taskId: 't10', serviceTypeId: 'brand', hours: 40, date: getDateShifted(-2), notes: 'Final polish' },
  { id: 'te24', taskId: 't11', serviceTypeId: 'consulting', hours: 20, date: getDateShifted(-6), notes: 'Data cut' },
  { id: 'te25', taskId: 't11', serviceTypeId: 'consulting', hours: 20, date: getDateShifted(-3), notes: 'Workshop prep' },
  { id: 'te26', memberId: 'tm4', serviceTypeId: 'ux', hours: 6, date: getDateShifted(-11), notes: 'Quick task: audit flow', quickTask: true, title: 'Audit flow' },
  { id: 'te27', memberId: 'tm5', serviceTypeId: 'qa', hours: 5, date: getDateShifted(-16), notes: 'Quick task: smoke tests', quickTask: true, title: 'Smoke tests' },
];

if (typeof window !== 'undefined') {
  window.__performanceJobs = performanceJobs;
  window.__performanceDeliverables = performanceDeliverables;
  window.__performanceServiceTypes = performanceServiceTypes;
  window.__performanceTimeEntries = performanceTimeEntries;
}

export const performanceTeam = [
  { id: 'tm1', name: 'Sam', monthlyCapacityHours: 200, serviceTypes: ['Web', 'API'] },
  { id: 'tm2', name: 'Maria', monthlyCapacityHours: 200, serviceTypes: ['Consulting', 'Data'] },
  { id: 'tm3', name: 'Alex', monthlyCapacityHours: 200, serviceTypes: ['Web', 'Frontend'] },
  { id: 'tm4', name: 'Sarah', monthlyCapacityHours: 200, serviceTypes: ['UX', 'Mobile'] },
  { id: 'tm5', name: 'Chris', monthlyCapacityHours: 200, serviceTypes: ['UX', 'QA'] },
  { id: 'tm6', name: 'Nora', monthlyCapacityHours: 200, serviceTypes: ['Brand', 'Design'] },
];

export const performanceTasks = [
  { id: 't1', deliverableId: 201, assigneeId: 'tm1', estimatedHours: 50, actualHours: 28, remainingHours: null, serviceTypeId: 'web' },
  { id: 't2', deliverableId: 202, assigneeId: 'tm2', estimatedHours: 30, actualHours: 10, remainingHours: null, serviceTypeId: 'consulting' },
  { id: 't3', deliverableId: 203, assigneeId: 'tm3', estimatedHours: 60, actualHours: 25, remainingHours: null, serviceTypeId: 'web' },
  { id: 't4', deliverableId: 204, assigneeId: 'tm4', estimatedHours: 90, actualHours: 32, remainingHours: null, serviceTypeId: 'ux' },
  { id: 't5', deliverableId: 205, assigneeId: 'tm5', estimatedHours: 60, actualHours: 15, remainingHours: 35, serviceTypeId: 'mobile' },
  { id: 't6', deliverableId: 206, assigneeId: 'tm6', estimatedHours: 80, actualHours: 24, remainingHours: null, serviceTypeId: 'web' },
  { id: 't7', deliverableId: 207, assigneeId: 'tm6', estimatedHours: 60, actualHours: 12, remainingHours: null, serviceTypeId: 'web' },
  { id: 't8', deliverableId: 208, assigneeId: 'tm2', estimatedHours: 50, actualHours: 50, remainingHours: 0, serviceTypeId: 'seo' },
  { id: 't9', deliverableId: 209, assigneeId: 'tm6', estimatedHours: 120, actualHours: 40, remainingHours: null, serviceTypeId: 'brand' },
  { id: 't10', deliverableId: 210, assigneeId: 'tm6', estimatedHours: 90, actualHours: 60, remainingHours: null, serviceTypeId: 'brand' },
  { id: 't11', deliverableId: 211, assigneeId: 'tm2', estimatedHours: 40, actualHours: 38, remainingHours: null, serviceTypeId: 'consulting' },
  { id: 't12', deliverableId: 212, assigneeId: 'tm1', estimatedHours: 55, actualHours: 30, remainingHours: null, serviceTypeId: 'web' },
  { id: 't13', deliverableId: 205, assigneeId: null, estimatedHours: 20, actualHours: 0, remainingHours: null, serviceTypeId: 'ux' }, // unassigned portion
  { id: 't14', deliverableId: 212, assigneeId: 'tm5', estimatedHours: null, actualHours: 0, remainingHours: null, serviceTypeId: 'web' }, // unknown estimate -> unknown demand
];

if (typeof window !== 'undefined') {
  window.__performanceTeam = performanceTeam;
  window.__performanceTasks = performanceTasks;
}

// -----------------------------------------------------------------------------
// Sales report seed data (simple pipeline + activity timeline)
// -----------------------------------------------------------------------------

export const performanceSalesDeals = [
  {
    id: 'sd1',
    name: 'Quantum Leap Website (Phase 2)',
    client: 'Future Systems',
    ownerId: 'tm6',
    serviceTypeId: 'web',
    source: 'Inbound',
    stage: 'won',
    amount: 45000,
    probability: 1,
    createdAt: getDateShifted(-62),
    closedAt: getDateShifted(-25),
  },
  {
    id: 'sd2',
    name: 'Right Here Rebrand (Sprint)',
    client: 'Right Here Interactive',
    ownerId: 'tm6',
    serviceTypeId: 'brand',
    source: 'Referral',
    stage: 'proposal',
    amount: 32000,
    probability: 0.55,
    createdAt: getDateShifted(-21),
    closedAt: null,
  },
  {
    id: 'sd3',
    name: 'Data Migration Strategy',
    client: 'Legacy Corp',
    ownerId: 'tm2',
    serviceTypeId: 'consulting',
    source: 'Inbound',
    stage: 'negotiation',
    amount: 58000,
    probability: 0.7,
    createdAt: getDateShifted(-44),
    closedAt: null,
  },
  {
    id: 'sd4',
    name: 'Fathom SEO Sprint',
    client: 'Fathom',
    ownerId: 'tm2',
    serviceTypeId: 'seo',
    source: 'Outbound',
    stage: 'lost',
    amount: 12000,
    probability: 0,
    createdAt: getDateShifted(-36),
    closedAt: getDateShifted(-12),
  },
  {
    id: 'sd5',
    name: 'Mobile App Revamp',
    client: 'Appify',
    ownerId: 'tm4',
    serviceTypeId: 'mobile',
    source: 'Inbound',
    stage: 'discovery',
    amount: 82000,
    probability: 0.65,
    createdAt: getDateShifted(-10),
    closedAt: null,
  },
  {
    id: 'sd6',
    name: 'NCBF Web Redesign (Expansion)',
    client: 'National Cherry Blossom Festival',
    ownerId: 'tm1',
    serviceTypeId: 'web',
    source: 'Existing client',
    stage: 'won',
    amount: 26000,
    probability: 1,
    createdAt: getDateShifted(-15),
    closedAt: getDateShifted(-2),
  },
  {
    id: 'sd7',
    name: 'Brand Refresh (Quarterly)',
    client: 'Northwind',
    ownerId: 'tm6',
    serviceTypeId: 'brand',
    source: 'Inbound',
    stage: 'won',
    amount: 15000,
    probability: 1,
    createdAt: getDateShifted(-78),
    closedAt: getDateShifted(-71),
  },
  {
    id: 'sd8',
    name: 'Legacy Corp Retainer',
    client: 'Legacy Corp',
    ownerId: 'tm2',
    serviceTypeId: 'consulting',
    source: 'Referral',
    stage: 'lead',
    amount: 18000,
    probability: 0.6,
    createdAt: getDateShifted(-5),
    closedAt: null,
  },
  {
    id: 'sd9',
    name: 'UX Audit + Roadmap',
    client: 'Paper Street',
    ownerId: 'tm4',
    serviceTypeId: 'ux',
    source: 'Inbound',
    stage: 'proposal',
    amount: 14000,
    probability: 0.6,
    createdAt: getDateShifted(-29),
    closedAt: null,
  },
];

export const performanceSalesActivities = [
  { id: 'sa1', dealId: 'sd6', date: getDateShifted(-2), type: 'Closed won', ownerId: 'tm1', note: 'Signed addendum + deposit received.' },
  { id: 'sa2', dealId: 'sd6', date: getDateShifted(-6), type: 'Proposal sent', ownerId: 'tm1', note: 'Sent SOW + timeline.' },
  { id: 'sa3', dealId: 'sd5', date: getDateShifted(-1), type: 'Discovery call', ownerId: 'tm4', note: 'Confirmed stakeholders + success metrics.' },
  { id: 'sa4', dealId: 'sd5', date: getDateShifted(-8), type: 'Intro email', ownerId: 'tm4', note: 'Inbound lead — scheduling kickoff.' },
  { id: 'sa5', dealId: 'sd2', date: getDateShifted(-3), type: 'Proposal revision', ownerId: 'tm6', note: 'Adjusted scope + added brand guidelines.' },
  { id: 'sa6', dealId: 'sd2', date: getDateShifted(-14), type: 'Proposal sent', ownerId: 'tm6', note: 'Presented 2 package options.' },
  { id: 'sa7', dealId: 'sd3', date: getDateShifted(-4), type: 'Negotiation', ownerId: 'tm2', note: 'Working through contract terms.' },
  { id: 'sa8', dealId: 'sd3', date: getDateShifted(-23), type: 'Scope workshop', ownerId: 'tm2', note: 'Aligned on deliverables + constraints.' },
  { id: 'sa9', dealId: 'sd4', date: getDateShifted(-12), type: 'Closed lost', ownerId: 'tm2', note: 'Went with incumbent agency.' },
  { id: 'sa10', dealId: 'sd4', date: getDateShifted(-19), type: 'Follow-up', ownerId: 'tm2', note: 'Sent recap + next steps.' },
  { id: 'sa11', dealId: 'sd1', date: getDateShifted(-25), type: 'Closed won', ownerId: 'tm6', note: 'Approved budget + signed agreement.' },
  { id: 'sa12', dealId: 'sd1', date: getDateShifted(-31), type: 'Negotiation', ownerId: 'tm6', note: 'Finalized scope and milestones.' },
  { id: 'sa13', dealId: 'sd9', date: getDateShifted(-7), type: 'Proposal sent', ownerId: 'tm4', note: 'Shared audit outline + deliverables.' },
  { id: 'sa14', dealId: 'sd9', date: getDateShifted(-27), type: 'Discovery call', ownerId: 'tm4', note: 'Identified key UX pain points.' },
  { id: 'sa15', dealId: 'sd8', date: getDateShifted(-2), type: 'Lead qualified', ownerId: 'tm2', note: 'Confirmed budget range + urgency.' },
];

if (typeof window !== 'undefined') {
  window.__performanceSalesDeals = performanceSalesDeals;
  window.__performanceSalesActivities = performanceSalesActivities;
}
