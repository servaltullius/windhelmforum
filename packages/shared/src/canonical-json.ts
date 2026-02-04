export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const output: Record<string, unknown> = {};
  for (const key of keys) output[key] = canonicalize(record[key]);
  return output;
}

