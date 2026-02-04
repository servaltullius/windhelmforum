import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService, private readonly redis: RedisService) {}

  async createReport(
    ip: string,
    input: { targetType: "THREAD" | "COMMENT"; targetId: string; reason: string }
  ) {
    await this.rateLimitIp(ip);
    const report = await this.db.prisma.report.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        reporterIp: ip,
        reason: input.reason
      }
    });
    return { reportId: report.id };
  }

  private async rateLimitIp(ip: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:report:${ip}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > 10) throw new HttpException("Too many reports", HttpStatus.TOO_MANY_REQUESTS);
  }
}

