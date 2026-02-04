import { BadRequestException, Body, Controller, Headers, NotFoundException, Post, Req } from "@nestjs/common";
import { inboxCreateSchema } from "@windhelm/shared";
import { InboxService } from "./inbox.service.js";
import { getClientIp } from "../http/client-ip.js";

type RequestLike = { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } };

@Controller()
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Post("/inbox")
  async create(@Req() req: RequestLike, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    if ((process.env.OBSERVER_MODE ?? "").trim() === "1") throw new NotFoundException();

    const parsed = inboxCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const ip = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress }) || "unknown";
    return await this.inbox.create(ip, parsed.data);
  }
}
