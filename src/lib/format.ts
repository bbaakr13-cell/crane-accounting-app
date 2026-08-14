const RIYAL = 'ر.س';

export function formatSAR(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${RIYAL}`;
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}
