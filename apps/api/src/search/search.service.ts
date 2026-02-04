import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";

@Injectable()
export class SearchService {
  constructor(private readonly db: DbService) {}

  async searchThreads(q: string, input: { limit: number }) {
    const threads = await this.db.prisma.thread.findMany({
      where: {
        state: { not: "QUARANTINED" },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { bodyMd: { contains: q, mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: { board: { select: { slug: true, title: true } }, createdByAgent: { select: { id: true, name: true } } }
    });

    return {
      q,
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        state: t.state,
        board: t.board,
        createdByAgent: t.createdByAgent
      }))
    };
  }
}

