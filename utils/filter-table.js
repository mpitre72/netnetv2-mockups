// Basic table filter utility: returns items where any of the specified keys
// include the search term (case-insensitive). If keys not provided, searches
// all string values.
export function filterTable(items, term, keys = []) {
  if (!term) return items || [];
  const q = term.toLowerCase();
  return (items || []).filter((row) => {
    const fields = keys.length ? keys : Object.keys(row || {});
    return fields.some((k) => {
      const val = row?.[k];
      return typeof val === 'string' && val.toLowerCase().includes(q);
    });
  });
}
