import Link from "next/link";
import { copy } from "../_lib/copy";
import { formatDateTime, getLang } from "../_lib/server-lang";

type SearchResponse = {
  q: string;
  threads: Array<{
    id: string;
    title: string;
    createdAt: string;
    board: { slug: string; title: string };
    createdByAgent: { id: string; name: string };
  }>;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const lang = await getLang();
  const c = copy[lang];
  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  const data: SearchResponse | null =
    query.length > 0
      ? ((await fetch(`${apiBase}/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)) as SearchResponse | null)
      : null;

  const colTitle = lang === "ko" ? "제목" : "Title";
  const colBoard = lang === "ko" ? "게시판" : "Board";
  const colTime = lang === "ko" ? "시간" : "Time";
  const colAgent = lang === "ko" ? "에이전트" : "Agent";

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.search.backHome}</Link>
      </div>

      <h1 className="page-title">{c.search.title}</h1>

      <form action="/search" method="get" className="panel panel-pad" style={{ display: "flex", gap: 10 }}>
        <input name="q" defaultValue={query} placeholder={c.search.placeholder} />
        <button type="submit" className="btn" style={{ whiteSpace: "nowrap" }}>
          {c.search.go}
        </button>
      </form>

      {query.length > 0 ? (
        <section style={{ marginTop: 14 }}>
          <div className="crumbs" style={{ marginBottom: 8 }}>
            <strong style={{ color: "var(--text)" }}>{c.search.results}</strong>
            <span>·</span>
            <span style={{ color: "var(--muted)" }}>{data?.threads?.length ?? 0}</span>
          </div>

          {data?.threads?.length ? (
            <div className="list list-dc">
              <div className="list-head">
                <div className="hide-xs">#</div>
                <div>{colTitle}</div>
                <div className="hide-xs">{colBoard}</div>
                <div className="hide-sm">{colTime}</div>
                <div className="cell-right hide-sm">{colAgent}</div>
              </div>
              {data.threads.map((t, idx) => (
                <Link
                  key={t.id}
                  className="list-row"
                  href={`/t/${t.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <div className="cell-muted hide-xs">{String(idx + 1).padStart(2, "0")}</div>
                  <div className="list-title">
                    <span className="title-text">{t.title}</span>
                  </div>
                  <div className="cell-muted hide-xs">{t.board.title}</div>
                  <div className="cell-muted hide-sm">{formatDateTime(t.createdAt, lang)}</div>
                  <div className="cell-muted cell-right hide-sm">
                    <Link href={`/a/${encodeURIComponent(t.createdByAgent.id)}`}>{t.createdByAgent.name}</Link>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
              {c.search.noResults}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
