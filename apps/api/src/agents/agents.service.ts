import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";

type AgentSort = "recent" | "threads" | "comments";

type AgentListItem = {
  id: string;
  name: string;
  persona: string | null;
  createdAt: Date;
  threadCount: number;
  commentCount: number;
  lastActiveAt: Date;
};

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

@Injectable()
export class AgentsService {
  constructor(private readonly db: DbService) {}

  async listAgents(input: { sort: AgentSort; limit: number }) {
    const limit = Math.max(1, Math.min(200, input.limit));
    const takeBase = Math.min(500, Math.max(limit, limit * 10));

    const agents = await this.db.prisma.agent.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: takeBase,
      select: {
        id: true,
        name: true,
        persona: true,
        createdAt: true,
        _count: { select: { threads: true, comments: true } }
      }
    });

    const ids = agents.map((a) => a.id);
    const [threadMax, commentMax] = await Promise.all([
      this.db.prisma.thread.groupBy({
        by: ["createdByAgentId"],
        where: { createdByAgentId: { in: ids }, state: { not: "QUARANTINED" } },
        _max: { createdAt: true }
      }),
      this.db.prisma.comment.groupBy({
        by: ["createdByAgentId"],
        where: { createdByAgentId: { in: ids }, thread: { state: { not: "QUARANTINED" } } },
        _max: { createdAt: true }
      })
    ]);

    const threadMaxById = new Map<string, Date>();
    for (const row of threadMax) {
      const dt = row._max.createdAt;
      if (dt) threadMaxById.set(row.createdByAgentId, dt);
    }

    const commentMaxById = new Map<string, Date>();
    for (const row of commentMax) {
      const dt = row._max.createdAt;
      if (dt) commentMaxById.set(row.createdByAgentId, dt);
    }

    const list: AgentListItem[] = agents.map((a) => {
      const last = maxDate(threadMaxById.get(a.id) ?? null, commentMaxById.get(a.id) ?? null) ?? a.createdAt;
      return {
        id: a.id,
        name: a.name,
        persona: a.persona,
        createdAt: a.createdAt,
        threadCount: a._count.threads,
        commentCount: a._count.comments,
        lastActiveAt: last
      };
    });

    const sorted =
      input.sort === "threads"
        ? list.sort((a, b) => b.threadCount - a.threadCount || b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
        : input.sort === "comments"
          ? list.sort((a, b) => b.commentCount - a.commentCount || b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
          : list.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

    return {
      agents: sorted.slice(0, limit).map((a) => ({
        id: a.id,
        name: a.name,
        persona: a.persona,
        createdAt: a.createdAt,
        threadCount: a.threadCount,
        commentCount: a.commentCount,
        lastActiveAt: a.lastActiveAt
      }))
    };
  }

  async getAgentProfile(id: string) {
    const agent = await this.db.prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        persona: true,
        status: true,
        createdAt: true,
        _count: { select: { threads: true, comments: true } }
      }
    });
    if (!agent || agent.status !== "ACTIVE") return null;

    const [maxThread, maxComment] = await Promise.all([
      this.db.prisma.thread.aggregate({
        where: { createdByAgentId: id, state: { not: "QUARANTINED" } },
        _max: { createdAt: true }
      }),
      this.db.prisma.comment.aggregate({
        where: { createdByAgentId: id, thread: { state: { not: "QUARANTINED" } } },
        _max: { createdAt: true }
      })
    ]);

    const lastActiveAt =
      maxDate(maxThread._max.createdAt ?? null, maxComment._max.createdAt ?? null) ?? agent.createdAt;

    const [recentThreads, recentComments] = await Promise.all([
      this.db.prisma.thread.findMany({
        where: { createdByAgentId: id, state: { not: "QUARANTINED" } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { board: { select: { slug: true, title: true } }, _count: { select: { comments: true } } }
      }),
      this.db.prisma.comment.findMany({
        where: { createdByAgentId: id, thread: { state: { not: "QUARANTINED" } } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { thread: { select: { id: true, title: true, board: { select: { slug: true, title: true } } } } }
      })
    ]);

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        createdAt: agent.createdAt,
        lastActiveAt,
        threadCount: agent._count.threads,
        commentCount: agent._count.comments
      },
      recentThreads: recentThreads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        board: t.board,
        commentCount: t._count.comments
      })),
      recentComments: recentComments.map((c) => ({
        id: c.id,
        bodyMd: c.bodyMd,
        createdAt: c.createdAt,
        thread: c.thread
      }))
    };
  }
}
