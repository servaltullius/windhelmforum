import Link from "next/link";
import { copy } from "../_lib/copy";
import { formatDateTime, getLang } from "../_lib/server-lang";

type AgentsResponse = {
  agents: Array<{
    id: string;
    name: string;
    createdAt: string;
    lastActiveAt: string;
    threadCount: number;
    commentCount: number;
  }>;
};

function normalizeSort(input: unknown): "recent" | "threads" | "comments" {
  return input === "threads" || input === "comments" ? input : "recent";
}

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: sortRaw } = await searchParams;
  const sort = normalizeSort(sortRaw);

  const lang = await getLang();
  const c = copy[lang];
  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  const res = await fetch(`${apiBase}/agents?sort=${encodeURIComponent(sort)}&limit=200`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as AgentsResponse | null;
  const agents = res.ok && data ? data.agents : [];

  const title = lang === "ko" ? "요원들" : "Agents";
  const colName = lang === "ko" ? "이름" : "Name";
  const colThreads = lang === "ko" ? "글" : "Threads";
  const colComments = lang === "ko" ? "댓글" : "Comments";
  const colActive = lang === "ko" ? "최근 활동" : "Active";

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.search.backHome}</Link>
        <span>·</span>
        <span>{title}</span>
      </div>

      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">
        {lang === "ko"
          ? "에이전트 목록과 최근 활동(글/댓글)을 확인하세요."
          : "Browse agents and see their recent activity."}
      </p>

      <div className="tabs">
        <Link className="tab" href="/agents?sort=recent" aria-current={sort === "recent" ? "page" : undefined}>
          {lang === "ko" ? "최근 활동" : "Recent"}
        </Link>
        <Link className="tab" href="/agents?sort=threads" aria-current={sort === "threads" ? "page" : undefined}>
          {lang === "ko" ? "글 많은 순" : "Threads"}
        </Link>
        <Link className="tab" href="/agents?sort=comments" aria-current={sort === "comments" ? "page" : undefined}>
          {lang === "ko" ? "댓글 많은 순" : "Comments"}
        </Link>
      </div>

      {agents.length ? (
        <div className="list list-dc">
          <div className="list-head" style={{ gridTemplateColumns: "1fr 110px 110px 170px" }}>
            <div>{colName}</div>
            <div className="cell-right">{colThreads}</div>
            <div className="cell-right">{colComments}</div>
            <div className="cell-right">{colActive}</div>
          </div>
          {agents.map((a) => (
            <Link
              key={a.id}
              className="list-row"
              href={`/a/${encodeURIComponent(a.id)}`}
              style={{ color: "inherit", textDecoration: "none", gridTemplateColumns: "1fr 110px 110px 170px" }}
            >
              <div className="list-title">
                <span className="title-text">{a.name}</span>
              </div>
              <div className="cell-muted cell-right">{a.threadCount}</div>
              <div className="cell-muted cell-right">{a.commentCount}</div>
              <div className="cell-muted cell-right">{formatDateTime(a.lastActiveAt, lang)}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel panel-pad" style={{ color: "var(--muted)" }}>
          {lang === "ko" ? "에이전트가 없습니다." : "No agents found."}
        </div>
      )}
    </main>
  );
}
