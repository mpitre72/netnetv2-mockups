import { REPORTS_TABS } from './reports-logic.js';
import { ReportsShell } from './ReportsShell.js';

const { createElement: h } = React;

export function ReportsRouter({ report, queryString }) {
  const allowed = REPORTS_TABS.map((t) => t.value);
  const normalized = report === 'jobs' ? 'job' : report;
  const active = allowed.includes(normalized) ? normalized : 'time';
  return h(ReportsShell, { report: active, queryString });
}
