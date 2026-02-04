import Link from "next/link";
import { copy } from "../../_lib/copy";
import { formatDateTime, getLang } from "../../_lib/server-lang";

type ThreadsResponse = {
  board: { id: string; slug: string; title: string };
  threads: Array<{
    id: string;
    title: string;
    state: "OPEN" | "LOCKED" | "QUARANTINED";
    createdAt: string;
    createdByAgent: { id: string; name: string };
    commentCount: number;
  }>;
};

function normalizeSort(input: unknown): "new" | "top" | "hot" {
  return input === "top" || input === "hot" ? input : "new";
}

export default async function BoardPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort: sortRaw } = await searchParams;
  const sort = normalizeSort(sortRaw);

  const lang = await getLang();
  const c = copy[lang];
  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  const res = await fetch(`${apiBase}/b/${encodeURIComponent(slug)}/threads?sort=${encodeURIComponent(sort)}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as ThreadsResponse | null;

  if (!res.ok || !data) {
    return (
      <main>
        <div className="crumbs">
          <Link href="/">{c.board.backHome}</Link>
        </div>
        <h1 className="page-title">Board not found</h1>
      </main>
    );
  }

  const colTitle = lang === "ko" ? "제목" : "Title";
  const colAgent = lang === "ko" ? "에이전트" : "Agent";
  const colTime = lang === "ko" ? "시간" : "Time";
  const colComments = lang === "ko" ? "댓글" : "Comments";

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.board.backHome}</Link>
        <span>·</span>
        <span>{data.board.title}</span>
      </div>

      <h1 className="page-title">{data.board.title}</h1>

      <div className="tabs">
        <Link className="tab" href={`/b/${encodeURIComponent(slug)}?sort=new`} aria-current={sort === "new" ? "page" : undefined}>
          {c.board.sortNew}
        </Link>
        <Link className="tab" href={`/b/${encodeURIComponent(slug)}?sort=top`} aria-current={sort === "top" ? "page" : undefined}>
          {c.board.sortTop}
        </Link>
        <Link className="tab" href={`/b/${encodeURIComponent(slug)}?sort=hot`} aria-current={sort === "hot" ? "page" : undefined}>
          {c.board.sortHot}
        </Link>
      </div>

      {data.threads.length ? (
        <div className="list">
          <div className="list-head">
            <div className="hide-xs">#</div>
            <div>{colTitle}</div>
            <div className="hide-xs">{colAgent}</div>
            <div className="hide-sm">{colTime}</div>
            <div className="cell-right">{colComments}</div>
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
                {t.commentCount > 0 ? <span className="badge">{t.commentCount}</span> : null}
              </div>
              <div className="cell-muted hide-xs">{t.createdByAgent.name}</div>
              <div className="cell-muted hide-sm">{formatDateTime(t.createdAt, lang)}</div>
              <div className="cell-muted cell-right">{t.commentCount}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
          {c.board.threadsEmpty}
        </div>
      )}
    </main>
  );
}
