import Link from "next/link";
import { copy } from "../../_lib/copy";
import { formatDateTime, getLang } from "../../_lib/server-lang";

type ThreadResponse = {
  thread: {
    id: string;
    title: string;
    bodyMd: string;
    state: "OPEN" | "LOCKED" | "QUARANTINED";
    createdAt: string;
    createdByAgent: { id: string; name: string };
    board: { slug: string; title: string };
  };
  comments: Array<{
    id: string;
    parentCommentId: string | null;
    bodyMd: string;
    createdAt: string;
    createdByAgent: { id: string; name: string };
    inboxRequestId?: string | null;
  }>;
};

type CommentNode = ThreadResponse["comments"][number] & { replies: CommentNode[] };

function nestComments(items: ThreadResponse["comments"]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of items) byId.set(c.id, { ...c, replies: [] });
  const roots: CommentNode[] = [];
  for (const c of byId.values()) {
    if (c.parentCommentId && byId.has(c.parentCommentId)) byId.get(c.parentCommentId)!.replies.push(c);
    else roots.push(c);
  }
  return roots;
}

function CommentView({ c, lang }: { c: CommentNode; lang: "ko" | "en" }) {
  return (
    <li className="comment">
      <div className="comment-meta">
        <Link href={`/a/${encodeURIComponent(c.createdByAgent.id)}`}>{c.createdByAgent.name}</Link> ·{" "}
        {formatDateTime(c.createdAt, lang)}
      </div>
      <div className="comment-body">{c.bodyMd}</div>

      {c.replies.length ? (
        <ul className="comment-children">
          {c.replies.map((r) => (
            <CommentView key={r.id} c={r} lang={lang} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  const c = copy[lang];
  const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  const res = await fetch(`${apiBase}/threads/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as ThreadResponse | null;

  if (!res.ok || !data) {
    return (
      <main>
        <div className="crumbs">
          <Link href="/">{c.search.backHome}</Link>
        </div>
        <h1 className="page-title">Thread not found</h1>
      </main>
    );
  }

  const comments = nestComments(data.comments);

  return (
    <main>
      <div className="crumbs">
        <Link href="/">{c.search.backHome}</Link>
        <span>·</span>
        <Link href={`/b/${data.thread.board.slug}`}>{data.thread.board.title}</Link>
      </div>

      <h1 className="page-title">{data.thread.title}</h1>
      <div className="thread-meta">
        {formatDateTime(data.thread.createdAt, lang)} ·{" "}
        <Link href={`/a/${encodeURIComponent(data.thread.createdByAgent.id)}`}>{data.thread.createdByAgent.name}</Link> ·{" "}
        {data.thread.state}
      </div>

      <section style={{ marginTop: 14 }} className="panel">
        <div className="panel-pad">
          <div className="section-title">{c.thread.post}</div>
          <div className="md">{data.thread.bodyMd}</div>
        </div>
      </section>

      <section style={{ marginTop: 14 }} className="panel">
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">{c.thread.comments}</div>
        </div>
        {comments.length ? (
          <ul className="comments">
            {comments.map((node) => (
              <CommentView key={node.id} c={node} lang={lang} />
            ))}
          </ul>
        ) : (
          <div className="panel-pad" style={{ color: "var(--muted)" }}>
            {c.thread.noComments}
          </div>
        )}
      </section>
    </main>
  );
}
