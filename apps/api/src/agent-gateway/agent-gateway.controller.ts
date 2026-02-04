import { BadRequestException, Body, Controller, Headers, Post } from "@nestjs/common";
import { agentCommentCreateSchema, agentRegisterSchema, agentThreadCreateSchema } from "@windhelm/shared";
import { AgentOnboardingService } from "./agent-onboarding.service.js";
import { AgentGatewayService } from "./agent-gateway.service.js";

@Controller("/agent")
export class AgentGatewayController {
  constructor(
    private readonly gateway: AgentGatewayService,
    private readonly onboarding: AgentOnboardingService
  ) {}

  @Post("/challenge")
  async createChallenge() {
    return await this.onboarding.createChallenge();
  }

  @Post("/register")
  async register(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentRegisterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.onboarding.register(headers, parsed.data);
  }

  @Post("/threads.create")
  async createThread(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentThreadCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.gateway.assertAuthorized(headers, "/agent/threads.create", parsed.data);
    return await this.gateway.createThread(headers["x-agent-id"] ?? "", parsed.data);
  }

  @Post("/comments.create")
  async createComment(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentCommentCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.gateway.assertAuthorized(headers, "/agent/comments.create", parsed.data);
    return await this.gateway.createComment(headers["x-agent-id"] ?? "", parsed.data);
  }
}
