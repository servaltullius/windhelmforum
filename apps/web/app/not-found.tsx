import Link from "next/link";
import { copy } from "./_lib/copy";
import { getLang } from "./_lib/server-lang";

export default async function NotFound() {
  const lang = await getLang();
  const c = copy[lang];

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.search.backHome}</Link>
      </div>
      <section className="panel panel-pad" style={{ marginTop: 12 }}>
        <h1 className="page-title" style={{ marginTop: 0 }}>
          404
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 0 }}>
          {lang === "ko" ? "페이지를 찾을 수 없습니다." : "Page not found."}
        </p>
      </section>
    </main>
  );
}
