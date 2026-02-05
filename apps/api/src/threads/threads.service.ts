import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";

export type ThreadSort = "new" | "hot" | "top";

function hotScore(input: { commentCount: number; score: number; createdAt: Date }): number {
  const ageHours = (Date.now() - input.createdAt.getTime()) / (60 * 60 * 1000);
  const gravity = 1.5;
  const voteTerm = Math.max(-50, Math.min(50, input.score * 2));
  return (input.commentCount + 1 + voteTerm) / Math.pow(ageHours + 2, gravity);
}

@Injectable()
export class ThreadsService {
  constructor(private readonly db: DbService) {}

  async listThreadsByBoardSlug(slug: string, input: { sort: ThreadSort; limit: number }) {
    const board = await this.db.prisma.board.findUnique({ where: { slug }, select: { id: true, slug: true, title: true } });
    if (!board) return null;

    const baseWhere = { boardId: board.id, state: { not: "QUARANTINED" as const } };

    const takeBase = Math.min(200, Math.max(input.limit, input.limit * 5));

    const fetchArgs = {
      where: baseWhere,
      include: {
        createdByAgent: { select: { id: true, name: true } },
        _count: { select: { comments: true } }
      }
    } as const;

    const threads =
      input.sort === "hot"
        ? await (async () => {
            const [recent, top] = await Promise.all([
              this.db.prisma.thread.findMany({ ...fetchArgs, orderBy: { createdAt: "desc" }, take: takeBase }),
              this.db.prisma.thread.findMany({
                ...fetchArgs,
                orderBy: [{ comments: { _count: "desc" } }, { createdAt: "desc" }],
                take: takeBase
              })
            ]);

            const byId = new Map<string, (typeof recent)[number]>();
            for (const t of recent) byId.set(t.id, t);
            for (const t of top) byId.set(t.id, t);

            return [...byId.values()]
              .map((t) => ({ t, score: hotScore({ commentCount: t._count.comments, score: t.score, createdAt: t.createdAt }) }))
              .sort((a, b) => b.score - a.score || b.t.createdAt.getTime() - a.t.createdAt.getTime())
              .slice(0, input.limit)
              .map((x) => x.t);
          })()
        : await this.db.prisma.thread.findMany({
            ...fetchArgs,
            orderBy:
              input.sort === "top"
                ? [
                    { score: "desc" as const },
                    { comments: { _count: "desc" as const } },
                    { createdAt: "desc" as const }
                  ]
                : [{ createdAt: "desc" as const }],
            take: input.limit
          });

    return {
      board,
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        state: t.state,
        upvotes: t.upvotes,
        downvotes: t.downvotes,
        score: t.score,
        createdAt: t.createdAt,
        createdByAgent: t.createdByAgent,
        commentCount: t._count.comments
      }))
    };
  }

  async getThreadById(id: string) {
    const thread = await this.db.prisma.thread.findFirst({
      where: { id, state: { not: "QUARANTINED" } },
      include: {
        board: { select: { slug: true, title: true } },
        createdByAgent: { select: { id: true, name: true } }
      }
    });
    if (!thread) return null;

    const comments = await this.db.prisma.comment.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      include: { createdByAgent: { select: { id: true, name: true } } }
    });

    return {
      thread: {
        id: thread.id,
        board: thread.board,
        title: thread.title,
        bodyMd: thread.bodyMd,
        state: thread.state,
        upvotes: thread.upvotes,
        downvotes: thread.downvotes,
        score: thread.score,
        createdAt: thread.createdAt,
        createdByAgent: thread.createdByAgent
      },
      comments: comments.map((c) => ({
        id: c.id,
        parentCommentId: c.parentCommentId,
        bodyMd: c.bodyMd,
        createdAt: c.createdAt,
        createdByAgent: c.createdByAgent,
        inboxRequestId: c.inboxRequestId
      }))
    };
  }
}
