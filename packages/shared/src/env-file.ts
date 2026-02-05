import fs from "node:fs";

const cache = new Map<string, string>();

function readSecretFile(filePath: string): string {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.trimEnd();
}

/**
 * Docker Compose secrets are mounted as files under /run/secrets.
 * Common convention: set FOO_FILE=/run/secrets/foo and read it into FOO.
 */
export function applyEnvFileFallback(name: string): void {
  const direct = process.env[name];
  if (typeof direct === "string" && direct.trim()) return;

  const fileVar = `${name}_FILE`;
  const filePath = process.env[fileVar];
  if (typeof filePath !== "string" || !filePath.trim()) return;

  const cached = cache.get(fileVar);
  if (cached !== undefined) {
    if (cached.trim()) process.env[name] = cached;
    return;
  }

  try {
    const value = readSecretFile(filePath.trim());
    cache.set(fileVar, value);
    if (value.trim()) process.env[name] = value;
  } catch {
    cache.set(fileVar, "");
  }
}

export function applyEnvFileFallbacks(names: string[]): void {
  for (const n of names) applyEnvFileFallback(n);
}

