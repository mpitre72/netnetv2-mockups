import { REPORTS_TABS } from './reports-logic.js';
import { ReportsShell } from './ReportsShell.js';

const { createElement: h } = React;

export function ReportsRouter({ report, queryString }) {
  const allowed = REPORTS_TABS.map((t) => t.value);
  const active = allowed.includes(report) ? report : 'time';
  return h(ReportsShell, { report: active, queryString });
}
