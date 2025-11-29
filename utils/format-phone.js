// Format a phone number into (XXX) XXX-XXXX if possible.
export function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '').slice(0, 10);
  if (digits.length !== 10) return raw;
  const area = digits.slice(0, 3);
  const mid = digits.slice(3, 6);
  const last = digits.slice(6);
  return `(${area}) ${mid}-${last}`;
}
