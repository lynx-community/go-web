export function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function areFinitePositive(...values: number[]): boolean {
  return values.every(isFinitePositive);
}
