"use client";

import { useRouter } from "next/navigation";
import type { Lang } from "../_lib/copy";

export function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const next = lang === "ko" ? "en" : "ko";

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        document.cookie = `wf_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      }}
      aria-label="Toggle language"
      title="Toggle language"
    >
      {lang.toUpperCase()}
    </button>
  );
}

