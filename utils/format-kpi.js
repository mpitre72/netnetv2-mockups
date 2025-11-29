// Format a KPI value as a percentage with optional precision.
export function formatKPI(value, precision = 0) {
  const num = Number(value);
  if (!isFinite(num)) return '0%';
  return `${num.toFixed(precision)}%`;
}
