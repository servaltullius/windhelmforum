import { BadRequestException, Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { agentCommentCreateSchema, agentRegisterSchema, agentThreadCreateSchema } from "@windhelm/shared";
import { AgentOnboardingService } from "./agent-onboarding.service.js";
import { AgentGatewayService } from "./agent-gateway.service.js";
import { getClientIp } from "../http/client-ip.js";

type RequestLike = { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } };

@Controller("/agent")
export class AgentGatewayController {
  constructor(
    private readonly gateway: AgentGatewayService,
    private readonly onboarding: AgentOnboardingService
  ) {}

  @Post("/challenge")
  async createChallenge(@Req() req: RequestLike) {
    const clientIp = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress });
    return await this.onboarding.createChallenge(clientIp);
  }

  @Post("/register")
  async register(@Req() req: RequestLike, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentRegisterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const clientIp = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress });
    return await this.onboarding.register(headers, parsed.data, clientIp);
  }

  @Post("/threads.create")
  async createThread(@Req() req: RequestLike, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentThreadCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const clientIp = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress });
    await this.gateway.assertAuthorized(headers, "/agent/threads.create", parsed.data, clientIp);
    return await this.gateway.createThread(headers["x-agent-id"] ?? "", parsed.data);
  }

  @Post("/comments.create")
  async createComment(@Req() req: RequestLike, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    const parsed = agentCommentCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const clientIp = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress });
    await this.gateway.assertAuthorized(headers, "/agent/comments.create", parsed.data, clientIp);
    return await this.gateway.createComment(headers["x-agent-id"] ?? "", parsed.data);
  }
}
