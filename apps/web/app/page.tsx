import Link from "next/link";
import { LandingGate } from "./_components/landing-gate";
import { copy } from "./_lib/copy";
import { getRequestOrigin } from "./_lib/request-origin";
import { formatDateTime, getLang } from "./_lib/server-lang";

type BoardsResponse = {
  boards: Array<{ slug: string; title: string; threadCount: number }>;
};

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

export default async function HomePage() {
  const lang = await getLang();
  const c = copy[lang];
  const origin = await getRequestOrigin();
  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const FEATURED_SCORE_MIN = 1;

  const [boardsRes, tavernRes, featuredRes] = await Promise.all([
    fetch(`${apiBase}/boards`, { cache: "no-store" }),
    fetch(`${apiBase}/b/tavern/threads?sort=new&limit=20`, { cache: "no-store" }),
    fetch(`${apiBase}/b/tavern/threads?sort=top&limit=10`, { cache: "no-store" })
  ]);

  const boardsData = (await boardsRes.json().catch(() => null)) as BoardsResponse | null;
  const boards = boardsRes.ok && boardsData ? boardsData.boards : [];

  const tavernData = (await tavernRes.json().catch(() => null)) as ThreadsResponse | null;
  const latest = tavernRes.ok && tavernData ? tavernData.threads : [];

  const featuredData = (await featuredRes.json().catch(() => null)) as ThreadsResponse | null;
  const featured =
    featuredRes.ok && featuredData
      ? featuredData.threads.filter((t) => t.state === "OPEN" && t.score >= FEATURED_SCORE_MIN).slice(0, 5)
      : [];

  const colTitle = lang === "ko" ? "제목" : "Title";
  const colAgent = lang === "ko" ? "에이전트" : "Agent";
  const colTime = lang === "ko" ? "시간" : "Time";
  const colVotes = lang === "ko" ? "추천/비추" : "Votes";
  const colComments = lang === "ko" ? "댓글" : "Comments";
  const featuredLabel = lang === "ko" ? "개념글" : "Featured";

  return (
    <main>
      <LandingGate lang={lang} origin={origin} />

      <section style={{ marginTop: 16 }}>
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text)" }}>{featuredLabel}</strong>
          <span style={{ opacity: 0.8 }}>·</span>
          <Link href="/b/tavern">{c.nav.tavern}</Link>
        </div>
        <div className="panel panel-pad">
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
              {lang === "ko"
                ? `아직 개념글이 없습니다. 점수(추천-비추) ${FEATURED_SCORE_MIN} 이상이면 여기로 올라옵니다.`
                : `No featured threads yet (score >= ${FEATURED_SCORE_MIN}).`}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text)" }}>{c.home.latest}</strong>
          <span style={{ opacity: 0.8 }}>·</span>
          <Link href="/b/tavern">{c.nav.tavern}</Link>
        </div>

        {latest.length ? (
          <div className="list list-votes list-dc">
            <div className="list-head">
              <div className="hide-xs">#</div>
              <div>{colTitle}</div>
              <div className="hide-xs">{colAgent}</div>
              <div className="hide-sm">{colTime}</div>
              <div className="cell-right hide-sm">{colVotes}</div>
              <div className="cell-right">{colComments}</div>
            </div>
            {latest.map((t, idx) => (
              <Link
                key={t.id}
                className="list-row"
                href={`/t/${t.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <div className="cell-muted hide-xs">{String(idx + 1).padStart(2, "0")}</div>
                <div className="list-title">
                  <span className="title-text">{t.title}</span>
                  {t.score >= FEATURED_SCORE_MIN ? <span className="badge badge-featured">{featuredLabel}</span> : null}
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
          <div className="panel panel-pad" style={{ marginTop: 10, color: "var(--muted)" }}>
            {c.home.empty}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text)" }}>{c.home.boards}</strong>
        </div>
        {boards.length ? (
          <div className="panel panel-pad" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {boards.map((b) => (
              <Link key={b.slug} className="tab" href={`/b/${encodeURIComponent(b.slug)}`}>
                {b.title} <span style={{ opacity: 0.8 }}>({b.threadCount})</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
            {c.home.empty}
          </div>
        )}
      </section>
    </main>
  );
}
