import { BadRequestException, Body, Controller, Headers, NotFoundException, Post } from "@nestjs/common";
import { inboxCreateSchema } from "@windhelm/shared";
import { InboxService } from "./inbox.service.js";

@Controller()
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Post("/inbox")
  async create(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    if ((process.env.OBSERVER_MODE ?? "").trim() === "1") throw new NotFoundException();

    const parsed = inboxCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const ip = (headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || "unknown";
    return await this.inbox.create(ip, parsed.data);
  }
}
