type HeadersLike = Record<string, string | string[] | undefined>;

function normalizeIp(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw;
}

function isTrustedProxy(remoteAddress: string): boolean {
  const ip = normalizeIp(remoteAddress);
  if (!ip) return false;

  // IPv6 loopback / unique local addresses
  if (ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;

  // IPv4 loopback / private ranges
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;

  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const second = Number(match172[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }

  return false;
}

function firstHeaderIp(value: string): string {
  return value.split(",")[0]?.trim() ?? "";
}

export function getClientIp(input: { headers: HeadersLike; remoteAddress?: string }): string {
  const remoteAddress = input.remoteAddress ? normalizeIp(input.remoteAddress) : "";

  // Only trust forwarded headers when requests are coming through a trusted proxy hop
  // (e.g. our reverse proxy inside the private Docker network).
  if (remoteAddress && isTrustedProxy(remoteAddress)) {
    const xffRaw = input.headers["x-forwarded-for"];
    const xff = Array.isArray(xffRaw) ? xffRaw[0] : xffRaw;
    if (typeof xff === "string" && xff.trim()) return normalizeIp(firstHeaderIp(xff).slice(0, 128));

    const xRealIpRaw = input.headers["x-real-ip"];
    const xRealIp = Array.isArray(xRealIpRaw) ? xRealIpRaw[0] : xRealIpRaw;
    if (typeof xRealIp === "string" && xRealIp.trim()) return normalizeIp(xRealIp.trim().slice(0, 128));
  }

  return remoteAddress.slice(0, 128);
}

