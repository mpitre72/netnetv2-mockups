const REPORT_FILTERS = { ALL: 'all', OVERDUE: 'overdue', DUE7: 'due7' };
let REPORT_FILTER = REPORT_FILTERS.ALL;

function getDateShifted(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const mockReportData = {
  jobs: [
    { id: 1, name: 'NCBF Web Redesign', client: 'National Cherry Blossom Festival', estHours: 200, actualHours: 80, plannedEnd: getDateShifted(14), startDate: getDateShifted(-20), wipPressure: 0.85 },
    { id: 2, name: 'Quantum Leap Website', client: 'Future Systems', estHours: 350, actualHours: 300, plannedEnd: getDateShifted(7), startDate: getDateShifted(-60), wipPressure: 1.2 },
    { id: 3, name: 'Data Migration Strategy', client: 'Legacy Corp', estHours: 120, actualHours: 125, plannedEnd: getDateShifted(-5), startDate: getDateShifted(-40), wipPressure: 1.5 },
    { id: 4, name: 'Mobile App Revamp', client: 'Appify', estHours: 500, actualHours: 150, plannedEnd: getDateShifted(45), startDate: getDateShifted(-10), wipPressure: 0.7 },
  ],
  deliverables: [
    { id: 101, jobId: 2, jobName: 'Quantum Leap Website', name: 'API Integration', owner: 'Sam', due: getDateShifted(-2), effortConsumed: 110, durationConsumed: 105, estHours: 40 },
    { id: 102, jobId: 3, jobName: 'Data Migration Strategy', name: 'Final Report Delivery', owner: 'Maria', due: getDateShifted(3), effortConsumed: 102, durationConsumed: 115, estHours: 20 },
    { id: 103, jobId: 2, jobName: 'Quantum Leap Website', name: 'Frontend Deployment', owner: 'Alex', due: getDateShifted(5), effortConsumed: 98, durationConsumed: 101, estHours: 60 },
    { id: 104, jobId: 4, jobName: 'Mobile App Revamp', name: 'Wireframes', owner: 'Sarah', due: getDateShifted(12), effortConsumed: 40, durationConsumed: 30, estHours: 80 },
  ],
};

function getStoplightClasses(percent) {
  if (percent <= 85) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500', bgWeak: 'bg-green-100 dark:bg-green-500/20' };
  if (percent <= 100) return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500', bgWeak: 'bg-yellow-100 dark:bg-yellow-500/20' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', bgWeak: 'bg-red-100 dark:bg-red-500/20' };
}

function renderStackedPerformance(actual, est, timelinePct) {
  const validEst = est || 1;
  const safeActual = actual || 0;
  const effortPct = (safeActual / validEst) * 100;
  const safeEffortPct = isNaN(effortPct) ? 0 : effortPct;
  const safeTimelinePct = isNaN(timelinePct) ? 0 : timelinePct;
  const getBarColor = (p) => {
    if (p > 100) return 'bg-red-500';
    if (p > 85.001) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  return `
      <div class="flex flex-col w-48 gap-1">
          <div class="flex justify-between items-baseline text-xs mb-0.5">
              <span class="text-gray-500 dark:text-gray-400 font-mono">${safeActual.toFixed(0)}/${validEst}</span>
              <span class="font-bold text-gray-700 dark:text-gray-300">${safeEffortPct.toFixed(0)}%</span>
          </div>
          <div class="flex items-center gap-2" data-tooltip="Actual vs estimated hours.">
              <div class="flex-1 h-[8px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div class="${getBarColor(safeEffortPct)} h-full rounded-full" style="width: ${Math.min(safeEffortPct, 100)}%" aria-label="LOE ${safeEffortPct.toFixed(0)} percent"></div>
              </div>
              <span class="text-xs font-medium w-8 text-right text-gray-600 dark:text-gray-400">${safeEffortPct.toFixed(0)}%</span>
          </div>
          <div class="flex items-center gap-2" data-tooltip="Elapsed vs planned timeline.">
              <div class="flex-1 h-[8px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div class="${getBarColor(safeTimelinePct)} h-full rounded-full" style="width: ${Math.min(safeTimelinePct, 100)}%" aria-label="Timeline ${safeTimelinePct.toFixed(0)} percent"></div>
              </div>
              <span class="text-xs font-medium w-8 text-right text-gray-600 dark:text-gray-400">${safeTimelinePct.toFixed(0)}%</span>
          </div>
      </div>
  `;
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

function renderReportsDashboard() {
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const onTimeRatio = 92;
  const jobsAtRisk = mockReportData.jobs.filter(j => (j.actualHours / (j.estHours || 1)) * 100 > 85).length;
  const next14Days = new Date(today.getTime() + 14 * oneDay);
  let hoursDue = 0;
  mockReportData.deliverables.forEach(d => { const dDate = new Date(d.due); if (!isNaN(dDate) && dDate >= today && dDate <= next14Days) hoursDue += 42; });
  if (hoursDue === 0) hoursDue = 126;
  const teamCapacity = 120;
  const capacityRatio = (hoursDue / teamCapacity) * 100;
  const capacityStatus = capacityRatio > 100 ? 'Overbooked' : (capacityRatio > 85 ? 'Tight' : 'OK');
  const capColor = getStoplightClasses(capacityRatio);
  let overdueCount = 0;
  let due7Count = 0;
  const next7Days = new Date(today.getTime() + 7 * oneDay);
  mockReportData.deliverables.forEach(d => { const dDate = new Date(d.due); if (isNaN(dDate)) return; const dTime = dDate.setHours(0,0,0,0); const nowTime = today.setHours(0,0,0,0); if (dTime < nowTime) overdueCount++; else if (dTime <= next7Days.getTime()) due7Count++; });
  let tableData = mockReportData.deliverables;
  if (REPORT_FILTER === REPORT_FILTERS.OVERDUE) tableData = tableData.filter(d => { const dt = new Date(d.due); return !isNaN(dt) && dt < today; });
  else if (REPORT_FILTER === REPORT_FILTERS.DUE7) tableData = tableData.filter(d => { const dt = new Date(d.due); return !isNaN(dt) && dt >= today && dt <= next7Days; });
  const sortedJobs = mockReportData.jobs.map(j => {
    const timelinePct = getTimelinePercent(j.startDate, j.plannedEnd);
    const effortPct = (j.actualHours / (j.estHours || 1)) * 100;
    const maxRisk = Math.max(timelinePct, effortPct);
    return { ...j, timelinePct, effortPct, maxRisk };
  }).sort((a, b) => b.maxRisk - a.maxRisk);
  const sortedDeliverables = tableData.map(d => {
    const est = d.estHours || 20;
    const safeEffort = d.effortConsumed || 0;
    const actual = (safeEffort / 100) * est;
    const timelinePct = d.durationConsumed || 0;
    const maxRisk = Math.max(timelinePct, safeEffort);
    return { ...d, est, actual, timelinePct, maxRisk };
  }).sort((a, b) => b.maxRisk - a.maxRisk);
  const csvContent = "ID,Name,Job,Owner,Due,Effort,Timeline\n" + sortedDeliverables.map(d => `${d.id},"${d.name}","${d.jobName}","${d.owner}",${d.due},${d.effortConsumed},${d.timelinePct}`).join("\n");
  const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);

  return `
    <div class="w-full max-w-7xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Performance Dashboard</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Real-time overview of effort, duration, and team capacity.</p>
      </header>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-black/10 dark:border-white/10 p-5 flex flex-col justify-between">
           <div> <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">On-Time Effort Ratio</h2> <div class="mt-2 flex items-baseline gap-2"> <span class="text-3xl font-bold text-gray-900 dark:text-white">${onTimeRatio}%</span> <span class="text-xs font-medium text-green-600 dark:text-green-400">Target 85%</span> </div> </div> <div class="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"> <div class="bg-green-500 h-1.5 rounded-full" style="width: ${onTimeRatio}%"></div> </div>
        </div>
        <div class="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-black/10 dark:border-white/10 p-5 flex flex-col justify-between">
           <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">Jobs at Risk</h2> <div class="mt-2"> <span class="text-3xl font-bold ${jobsAtRisk > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}">${jobsAtRisk}</span> <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Active jobs with Effort or Timeline > 85%</p> </div>
        </div>
        <div class="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-black/10 dark:border-white/10 p-5 flex flex-col justify-between" data-tooltip="Compare total hours due in next 14 days to team’s weekly capacity.">
           <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">Capacity Next 14 Days</h2> <div class="mt-2"> <span class="text-3xl font-bold ${capColor.text}">${capacityStatus}</span> <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Hours due in 14 days: ${hoursDue}h</p> </div>
        </div>
        <div class="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-black/10 dark:border-white/10 p-5 flex flex-col justify-between" data-tooltip="Deliverables past due or due within 7 days.">
           <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">Overdue & Due Soon</h2> <div class="mt-3 flex flex-wrap gap-2"> <button class="filter-chip px-3 py-1 rounded-full text-xs font-medium border border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 ${REPORT_FILTER === REPORT_FILTERS.OVERDUE ? 'active ring-2 ring-red-500' : ''}" data-filter="overdue"> Overdue (${overdueCount}) </button> <button class="filter-chip px-3 py-1 rounded-full text-xs font-medium border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 ${REPORT_FILTER === REPORT_FILTERS.DUE7 ? 'active ring-2 ring-yellow-500' : ''}" data-filter="due7"> Due in 7 Days (${due7Count}) </button> ${REPORT_FILTER !== REPORT_FILTERS.ALL ? `<button class="text-xs underline text-gray-500" data-filter="all">Clear</button>` : ''} </div>
        </div>
      </div>
      <div class="space-y-8">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Portfolio Status</h2>
          <div class="bg-white dark:bg-gray-800/50 rounded-lg shadow border border-black/10 dark:border-white/10 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400"> <tr> <th scope="col" class="px-6 py-3">Job Name</th> <th scope="col" class="px-6 py-3">Client</th> <th scope="col" class="px-6 py-3">Performance (LOE & Timeline)</th> </tr> </thead>
                <tbody>
                  ${sortedJobs.map(job => `<tr class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"> <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">${job.name}</td> <td class="px-6 py-4">${job.client}</td> <td class="px-6 py-4"> ${renderStackedPerformance(job.actualHours, job.estHours, job.timelinePct)} </td> </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-4"> <h2 class="text-xl font-semibold text-gray-900 dark:text-white">At-Risk Deliverables <span class="text-sm font-normal text-gray-500 ml-2">(${sortedDeliverables.length})</span></h2> <a href="${encodedUri}" download="at_risk_deliverables.csv" class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"> Export List → CSV </a> </div>
          <div class="bg-white dark:bg-gray-800/50 rounded-lg shadow border border-black/10 dark:border-white/10 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400"> <tr> <th scope="col" class="px-6 py-3">Job / Deliverable</th> <th scope="col" class="px-6 py-3">Performance (LOE & Timeline)</th> <th scope="col" class="px-6 py-3">Owner</th> <th scope="col" class="px-6 py-3">Due</th> <th scope="col" class="px-6 py-3 text-right">Suggested Action</th> </tr> </thead>
                <tbody>
                ${sortedDeliverables.length === 0 ? `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No deliverables match current filter.</td></tr>` :
                  sortedDeliverables.map(d => `<tr class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"> <td class="px-6 py-4"> <div class="font-medium text-gray-900 dark:text-white">${d.name}</div> <div class="text-xs text-gray-500 dark:text-gray-400">${d.jobName}</div> </td> <td class="px-6 py-4"> ${renderStackedPerformance(d.actual, d.est, d.timelinePct)} </td> <td class="px-6 py-4">${d.owner}</td> <td class="px-6 py-4 whitespace-nowrap ${new Date(d.due) < today ? 'text-red-600 font-medium' : ''}">${d.due}</td> <td class="px-6 py-4 text-right whitespace-nowrap"> <div class="flex justify-end gap-2"> <button class="text-xs text-netnet-purple dark:text-white hover:underline" onclick="openActionModal && openActionModal('reassign', ${d.id})">Reassign</button> <span class="text-gray-300">|</span> <button class="text-xs text-netnet-purple dark:text-white hover:underline" onclick="openActionModal && openActionModal('rescope', ${d.id})">Re-scope</button> <span class="text-gray-300">|</span> <button class="text-xs text-netnet-purple dark:text-white hover:underline" onclick="openActionModal && openActionModal('movedate', ${d.id})">Move Date</button> </div> </td> </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderReportsPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ReportsModule] container not found for renderReportsPage.');
    return;
  }
  container.innerHTML = renderReportsDashboard();

  const filterButtons = container.querySelectorAll('.filter-chip');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-filter');
      if (!f) return;
      if (f === 'overdue') REPORT_FILTER = REPORT_FILTERS.OVERDUE;
      else if (f === 'due7') REPORT_FILTER = REPORT_FILTERS.DUE7;
      else REPORT_FILTER = REPORT_FILTERS.ALL;
      renderReportsPage(container);
    });
  });
}
