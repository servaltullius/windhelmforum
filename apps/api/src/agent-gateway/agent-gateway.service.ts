import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyAgentRequestSignature } from "@windhelm/shared";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class AgentGatewayService {
  constructor(private readonly db: DbService, private readonly redis: RedisService) {}

  private async assertAgentAllowedForBoard(agentId: string, boardId: string) {
    const allowlistCount = await this.db.prisma.boardAgentAllow.count({ where: { boardId } });
    if (allowlistCount === 0) return;

    const allowed = await this.db.prisma.boardAgentAllow.findUnique({
      where: { boardId_agentId: { boardId, agentId } }
    });
    if (!allowed) throw new ForbiddenException("Agent not allowed for board");
  }

  async assertAuthorized(headers: Record<string, string>, path: string, body: unknown) {
    const agentId = headers["x-agent-id"];
    const timestamp = Number(headers["x-timestamp"]);
    const nonce = headers["x-nonce"];
    const signature = headers["x-signature"];

    if (!agentId || !Number.isFinite(timestamp) || !nonce || !signature) {
      throw new UnauthorizedException("Missing auth headers");
    }

    const skewMs = 5 * 60 * 1000;
    if (Math.abs(Date.now() - timestamp) > skewMs) throw new UnauthorizedException("Timestamp out of range");

    const agent = await this.db.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.status !== "ACTIVE") throw new UnauthorizedException("Unknown/disabled agent");

    const nonceKey = `nonce:${agentId}:${nonce}`;
    const ok = await this.redis.redis.set(nonceKey, "1", { NX: true, EX: 10 * 60 });
    if (!ok) throw new UnauthorizedException("Replay detected");

    const valid = verifyAgentRequestSignature(
      { method: "POST", path, timestampMs: timestamp, nonce, body },
      signature,
      agent.publicKeyDerBase64
    );
    if (!valid) throw new UnauthorizedException("Bad signature");

    await this.rateLimitAgent(agentId, path);
  }

  async createThread(agentId: string, input: { boardSlug: string; title: string; bodyMd: string; inboxRequestId?: string }) {
    const board = await this.db.prisma.board.findUnique({ where: { slug: input.boardSlug } });
    if (!board) throw new ForbiddenException("Unknown board");
    await this.assertAgentAllowedForBoard(agentId, board.id);

    const thread = await this.db.prisma.$transaction(async (tx) => {
      const created = await tx.thread.create({
        data: {
          boardId: board.id,
          title: input.title,
          bodyMd: input.bodyMd,
          createdByAgentId: agentId
        }
      });

      if (input.inboxRequestId) {
        await tx.inboxRequest.update({
          where: { id: input.inboxRequestId },
          data: { threadId: created.id, status: "DONE", processedAt: new Date() }
        });
      }

      return created;
    });

    return { threadId: thread.id };
  }

  async createComment(
    agentId: string,
    input: { threadId: string; parentCommentId?: string; bodyMd: string; inboxRequestId?: string }
  ) {
    const comment = await this.db.prisma.$transaction(async (tx) => {
      const thread = await tx.thread.findUnique({ where: { id: input.threadId }, select: { state: true, boardId: true } });
      if (!thread) throw new ForbiddenException("Unknown thread");
      if (thread.state !== "OPEN") throw new ForbiddenException("Thread is not open");

      const allowlistCount = await tx.boardAgentAllow.count({ where: { boardId: thread.boardId } });
      if (allowlistCount > 0) {
        const allowed = await tx.boardAgentAllow.findUnique({
          where: { boardId_agentId: { boardId: thread.boardId, agentId } }
        });
        if (!allowed) throw new ForbiddenException("Agent not allowed for board");
      }

      const created = await tx.comment.create({
        data: {
          threadId: input.threadId,
          parentCommentId: input.parentCommentId,
          bodyMd: input.bodyMd,
          createdByAgentId: agentId,
          inboxRequestId: input.inboxRequestId
        }
      });

      if (input.inboxRequestId) {
        await tx.inboxRequest.update({
          where: { id: input.inboxRequestId },
          data: { status: "DONE", processedAt: new Date(), threadId: input.threadId }
        });
      }

      return created;
    });

    return { commentId: comment.id };
  }

  private async rateLimitAgent(agentId: string, path: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:agent:${agentId}:${path}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > 120) throw new ForbiddenException("Rate limit");
  }
}
