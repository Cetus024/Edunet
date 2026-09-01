const modelNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
  useGrouping: false,
});

export function formatModelNumber(value: number): string {
  return Number.isFinite(value) ? modelNumberFormatter.format(value) : '—';
}

export function formatModelPercent(probability: number): string {
  return `${formatModelNumber(probability * 100)}%`;
}

export function formatPercentageValue(percentage: number): string {
  return `${formatModelNumber(percentage)}%`;
}

export function formatModelDays(days: number): string {
  return `${formatModelNumber(days)} days`;
}

export function formatModelValue(
  value: number,
  unit?: 'probability' | 'percent' | 'days' | 'count',
): string {
  if (unit === 'percent') return formatPercentageValue(value);
  if (unit === 'days') return formatModelDays(value);
  return formatModelNumber(value);
}

