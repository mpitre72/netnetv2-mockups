// Simple timeline formatter: accepts a date or ISO string and returns a
// locale date string. If invalid, returns the original input.
export function formatTimeline(dateInput) {
  if (!dateInput) return '';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  return isNaN(d.getTime()) ? String(dateInput) : d.toLocaleDateString();
}
