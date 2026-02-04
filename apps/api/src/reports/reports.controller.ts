import { BadRequestException, Body, Controller, Headers, NotFoundException, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ReportsService } from "./reports.service.js";
import { getClientIp } from "../http/client-ip.js";

type RequestLike = { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } };

const reportCreateSchema = z.object({
  targetType: z.enum(["THREAD", "COMMENT"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(2000)
});

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("/reports")
  async create(@Req() req: RequestLike, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    if ((process.env.OBSERVER_MODE ?? "").trim() === "1") throw new NotFoundException();

    const parsed = reportCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const ip = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress }) || "unknown";
    return await this.reports.createReport(ip, parsed.data);
  }
}
