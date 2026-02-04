import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { z } from "zod";
import { ThreadsService } from "./threads.service.js";

const listThreadsQuerySchema = z.object({
  sort: z.enum(["new", "hot", "top"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

@Controller()
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Get("/b/:slug/threads")
  async listThreads(@Param("slug") slug: string, @Query() query: unknown) {
    const parsed = listThreadsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const sort = parsed.data.sort ?? "new";
    const limit = parsed.data.limit ?? 50;

    const result = await this.threads.listThreadsByBoardSlug(slug, { sort, limit });
    if (!result) throw new NotFoundException("Board not found");
    return result;
  }

  @Get("/threads/:id")
  async getThread(@Param("id", new ParseUUIDPipe()) id: string) {
    const thread = await this.threads.getThreadById(id);
    if (!thread) throw new NotFoundException("Thread not found");
    return thread;
  }
}

