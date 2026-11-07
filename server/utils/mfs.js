export function normalizeBdPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let digits = String(value).replace(/\\D/g, '');
  if (digits.startsWith('00880')) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith('880')) digits = `0${digits.slice(3)}`;
  if (/^01[3-9]\\d{8}$/.test(digits)) return digits;
  return null;
}
