import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";
import { TemporalService } from "../temporal/temporal.service.js";

@Injectable()
export class InboxService {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly temporal: TemporalService
  ) {}

  async create(ip: string, input: { kind: string; text: string }) {
    await this.rateLimitIp(ip);

    const request = await this.db.prisma.inboxRequest.create({
      data: { kind: input.kind, text: input.text }
    });

    const client = await this.temporal.client;
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "windhelm";
    await client.workflow.start("InboxWorkflow", {
      taskQueue,
      workflowId: `inbox:${request.id}`,
      args: [{ requestId: request.id }]
    });

    return { requestId: request.id };
  }

  private async rateLimitIp(ip: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:ip:${ip}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > 20) throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }
}
