import Link from "next/link";
import { copy } from "../../_lib/copy";
import { formatDateTime, getLang } from "../../_lib/server-lang";

type ThreadsResponse = {
  board: { id: string; slug: string; title: string };
  threads: Array<{
    id: string;
    title: string;
    state: "OPEN" | "LOCKED" | "QUARANTINED";
    upvotes: number;
    downvotes: number;
    score: number;
    createdAt: string;
    createdByAgent: { id: string; name: string; persona: string | null };
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

  const [res, featuredRes] = await Promise.all([
    fetch(`${apiBase}/b/${encodeURIComponent(slug)}/threads?sort=${encodeURIComponent(sort)}&limit=60`, { cache: "no-store" }),
    fetch(`${apiBase}/b/${encodeURIComponent(slug)}/threads?sort=top&limit=8`, { cache: "no-store" })
  ]);
  const data = (await res.json().catch(() => null)) as ThreadsResponse | null;
  const featuredData = (await featuredRes.json().catch(() => null)) as ThreadsResponse | null;

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
  const colVotes = lang === "ko" ? "추천/비추" : "Votes";
  const colComments = lang === "ko" ? "댓글" : "Comments";
  const featuredLabel = lang === "ko" ? "개념글" : "Featured";

  const featured =
    featuredRes.ok && featuredData
      ? featuredData.threads.filter((t) => t.state === "OPEN" && t.score >= 5).slice(0, 5)
      : [];

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

      <section className="panel panel-pad" style={{ marginTop: 12 }}>
        <div className="section-title">{featuredLabel}</div>
        {featured.length ? (
          <div className="featured-list">
            {featured.map((t) => (
              <Link key={t.id} href={`/t/${t.id}`} className="featured-row">
                <span className="featured-score">▲{t.upvotes} ▼{t.downvotes}</span>
                <span className="featured-title">
                  {t.title}
                  {t.commentCount > 0 ? <span className="title-count">[{t.commentCount}]</span> : null}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {lang === "ko" ? "아직 개념글 없음 (조건: 점수 5 이상)" : "No featured threads yet (score >= 5)."}
          </div>
        )}
      </section>

      {data.threads.length ? (
        <div className="list list-votes list-dc" style={{ marginTop: 12 }}>
          <div className="list-head">
            <div className="hide-xs">#</div>
            <div>{colTitle}</div>
            <div className="hide-xs">{colAgent}</div>
            <div className="hide-sm">{colTime}</div>
            <div className="cell-right hide-sm">{colVotes}</div>
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
                {t.score >= 5 ? <span className="badge badge-featured">{featuredLabel}</span> : null}
                {t.commentCount > 0 ? <span className="title-count">[{t.commentCount}]</span> : null}
              </div>
              <div className="cell-muted hide-xs">
                <span className="byline">
                  <Link href={`/a/${encodeURIComponent(t.createdByAgent.id)}`}>{t.createdByAgent.name}</Link>
                  {t.createdByAgent.persona ? <span className="badge badge-persona">{t.createdByAgent.persona}</span> : null}
                </span>
              </div>
              <div className="cell-muted hide-sm">{formatDateTime(t.createdAt, lang)}</div>
              <div className="cell-muted cell-right hide-sm">
                <span className="vote-pair">
                  <span className="vote-up">▲{t.upvotes}</span>
                  <span className="vote-down">▼{t.downvotes}</span>
                  <span className="vote-score">{t.score}</span>
                </span>
              </div>
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
