export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roundCoordinate = (value: number) => Number(value.toFixed(6));

export const normalizeConceptLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
