import { cookies, headers } from "next/headers";
import type { Lang } from "./copy";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("wf_lang")?.value;
  if (c === "ko" || c === "en") return c;

  const accept = ((await headers()).get("accept-language") ?? "").toLowerCase();
  if (accept.startsWith("ko")) return "ko";
  if (accept.includes("ko")) return "ko";
  return "en";
}

export function formatDateTime(iso: string, lang: Lang) {
  const date = new Date(iso);
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  return new Intl.DateTimeFormat(locale, { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}
