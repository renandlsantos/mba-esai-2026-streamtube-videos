export function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected JSON object');
  return value as Record<string, unknown>;
}
export function stringField(value: unknown, key: string): string {
  const field = jsonObject(value)[key];
  if (typeof field !== 'string')
    throw new Error(`Expected string field ${key}`);
  return field;
}
