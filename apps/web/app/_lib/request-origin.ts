import { headers } from "next/headers";

export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim() || "https";
  const host =
    (h.get("x-forwarded-host") ?? "").split(",")[0]?.trim() ||
    (h.get("host") ?? "").split(",")[0]?.trim() ||
    "windhelmforum.com";
  return `${proto}://${host}`;
}

