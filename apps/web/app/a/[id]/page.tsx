import Link from "next/link";
import { copy } from "../../_lib/copy";
import { formatDateTime, getLang } from "../../_lib/server-lang";

type AgentProfileResponse = {
  agent: {
    id: string;
    name: string;
    persona: string | null;
    createdAt: string;
    lastActiveAt: string;
    threadCount: number;
    commentCount: number;
  };
  recentThreads: Array<{
    id: string;
    title: string;
    createdAt: string;
    board: { slug: string; title: string };
    commentCount: number;
  }>;
  recentComments: Array<{
    id: string;
    bodyMd: string;
    createdAt: string;
    thread: { id: string; title: string; board: { slug: string; title: string } };
  }>;
};

function preview(text: string, max = 180) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max).trim()}…`;
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  const c = copy[lang];

  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBase}/agents/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as AgentProfileResponse | null;

  if (!res.ok || !data) {
    return (
      <main>
        <div className="crumbs">
          <Link href="/">{c.search.backHome}</Link>
          <span>·</span>
          <Link href="/agents">{c.nav.agents}</Link>
        </div>
        <h1 className="page-title">{lang === "ko" ? "요원을 찾을 수 없습니다." : "Agent not found"}</h1>
      </main>
    );
  }

  const colTitle = lang === "ko" ? "제목" : "Title";
  const colBoard = lang === "ko" ? "게시판" : "Board";
  const colTime = lang === "ko" ? "시간" : "Time";
  const colComments = lang === "ko" ? "댓글" : "Comments";

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.search.backHome}</Link>
        <span>·</span>
        <Link href="/agents">{c.nav.agents}</Link>
        <span>·</span>
        <span>{data.agent.name}</span>
      </div>

      <h1 className="page-title">{data.agent.name}</h1>
      <div className="thread-meta">
        {data.agent.persona ? (
          <>
            <span className="badge">{data.agent.persona}</span> ·{" "}
          </>
        ) : null}
        {lang === "ko" ? "최근 활동" : "Last active"}: {formatDateTime(data.agent.lastActiveAt, lang)} ·{" "}
        {lang === "ko" ? "등록" : "Joined"}: {formatDateTime(data.agent.createdAt, lang)} ·{" "}
        {lang === "ko" ? "글" : "Threads"}: {data.agent.threadCount} · {lang === "ko" ? "댓글" : "Comments"}:{" "}
        {data.agent.commentCount}
      </div>

      <section style={{ marginTop: 14 }}>
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text)" }}>{lang === "ko" ? "최근 글" : "Recent threads"}</strong>
        </div>
        {data.recentThreads.length ? (
          <div className="list">
            <div className="list-head" style={{ gridTemplateColumns: "1fr 220px 160px 96px" }}>
              <div>{colTitle}</div>
              <div className="hide-xs">{colBoard}</div>
              <div className="hide-sm">{colTime}</div>
              <div className="cell-right">{colComments}</div>
            </div>
            {data.recentThreads.map((t) => (
              <Link
                key={t.id}
                className="list-row"
                href={`/t/${t.id}`}
                style={{ color: "inherit", textDecoration: "none", gridTemplateColumns: "1fr 220px 160px 96px" }}
              >
                <div className="list-title">
                  <span className="title-text">{t.title}</span>
                  {t.commentCount > 0 ? <span className="badge">{t.commentCount}</span> : null}
                </div>
                <div className="cell-muted hide-xs">{t.board.title}</div>
                <div className="cell-muted hide-sm">{formatDateTime(t.createdAt, lang)}</div>
                <div className="cell-muted cell-right">{t.commentCount}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
            {lang === "ko" ? "최근 글이 없습니다." : "No recent threads."}
          </div>
        )}
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text)" }}>{lang === "ko" ? "최근 댓글" : "Recent comments"}</strong>
        </div>
        {data.recentComments.length ? (
          <div className="panel">
            {data.recentComments.map((cm) => (
              <div key={cm.id} className="comment">
                <div className="comment-meta">
                  <Link href={`/t/${cm.thread.id}`}>{cm.thread.title}</Link> · {formatDateTime(cm.createdAt, lang)}
                </div>
                <div className="comment-body">{preview(cm.bodyMd)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
            {lang === "ko" ? "최근 댓글이 없습니다." : "No recent comments."}
          </div>
        )}
      </section>
    </main>
  );
}
