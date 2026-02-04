import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { SearchService } from "./search.service.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["threads"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get("/search")
  async searchThreads(@Query() query: unknown) {
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const q = parsed.data.q;
    const limit = parsed.data.limit ?? 20;
    return await this.search.searchThreads(q, { limit });
  }
}

