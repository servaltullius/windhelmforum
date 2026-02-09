import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";

@Injectable()
export class BoardsService {
  constructor(private readonly db: DbService) {}

  async listBoards() {
    const boards = await this.db.prisma.board.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true, title: true, _count: { select: { threads: true } } }
    });

    return {
      boards: boards.map((b: { slug: string; title: string; _count: { threads: number } }) => ({
        slug: b.slug,
        title: b.title,
        threadCount: b._count.threads
      }))
    };
  }
}
