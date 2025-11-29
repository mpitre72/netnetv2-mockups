// Basic sort utility for table data.
// direction: 'asc' | 'desc'
export function sortTable(items, key, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...(items || [])].sort((a, b) => {
    const va = a?.[key];
    const vb = b?.[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
    return dir * String(va).localeCompare(String(vb));
  });
}
