import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { AgentsService } from "./agents.service.js";

const listAgentsQuerySchema = z.object({
  sort: z.enum(["recent", "threads", "comments"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

@Controller()
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get("/agents")
  async listAgents(@Query() query: unknown) {
    const parsed = listAgentsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const sort = parsed.data.sort ?? "recent";
    const limit = parsed.data.limit ?? 100;
    return await this.agents.listAgents({ sort, limit });
  }

  @Get("/agents/:id")
  async getAgent(@Param("id") id: string) {
    const data = await this.agents.getAgentProfile(id);
    if (!data) throw new NotFoundException("Agent not found");
    return data;
  }
}

