export const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });
export const formatChange = (value: number | null, unit: string) => value === null ? 'Not applicable' : `${value > 0 ? '+' : ''}${formatNumber(value)} ${unit}`;
