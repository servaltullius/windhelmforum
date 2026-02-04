import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyAgentRequestSignature } from "@windhelm/shared";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class AgentGatewayService {
  constructor(private readonly db: DbService, private readonly redis: RedisService) {}

  private isInternalAgent(agentId: string): boolean {
    const systemAgentId = (process.env.SYSTEM_AGENT_ID ?? "").trim();
    if (systemAgentId && agentId === systemAgentId) return true;
    const devAgentId = (process.env.DEV_AGENT_ID ?? "").trim();
    if (devAgentId && agentId === devAgentId) return true;
    return false;
  }

  private async assertAgentAllowedForBoard(agentId: string, boardId: string) {
    const allowlistCount = await this.db.prisma.boardAgentAllow.count({ where: { boardId } });
    if (allowlistCount === 0) return;

    const allowed = await this.db.prisma.boardAgentAllow.findUnique({
      where: { boardId_agentId: { boardId, agentId } }
    });
    if (!allowed) throw new ForbiddenException("Agent not allowed for board");
  }

  async assertAuthorized(headers: Record<string, string>, path: string, body: unknown, clientIp: string) {
    const ip = clientIp.trim() || "unknown";
    await this.rateLimitAuthAttempt(ip);

    const agentId = headers["x-agent-id"];
    const timestamp = Number(headers["x-timestamp"]);
    const nonce = headers["x-nonce"];
    const signature = headers["x-signature"];

    if (!agentId || !Number.isFinite(timestamp) || !nonce || !signature) {
      await this.rateLimitAuthFailure(ip);
      throw new UnauthorizedException("Missing auth headers");
    }

    const skewMs = 5 * 60 * 1000;
    if (Math.abs(Date.now() - timestamp) > skewMs) {
      await this.rateLimitAuthFailure(ip);
      throw new UnauthorizedException("Timestamp out of range");
    }

    const agent = await this.db.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.status !== "ACTIVE") {
      await this.rateLimitAuthFailure(ip);
      throw new UnauthorizedException("Unknown/disabled agent");
    }

    const valid = verifyAgentRequestSignature(
      { method: "POST", path, timestampMs: timestamp, nonce, body },
      signature,
      agent.publicKeyDerBase64
    );
    if (!valid) {
      await this.rateLimitAuthFailure(ip);
      throw new UnauthorizedException("Bad signature");
    }

    const nonceKey = `nonce:${agentId}:${nonce}`;
    const ok = await this.redis.redis.set(nonceKey, "1", { NX: true, EX: 10 * 60 });
    if (!ok) {
      await this.rateLimitAuthFailure(ip);
      throw new UnauthorizedException("Replay detected");
    }

    await this.rateLimitAgent(agentId, path);
  }

  async createThread(agentId: string, input: { boardSlug: string; title: string; bodyMd: string; inboxRequestId?: string }) {
    if (input.inboxRequestId && !this.isInternalAgent(agentId)) throw new ForbiddenException("inboxRequestId not allowed");

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
    if (input.inboxRequestId && !this.isInternalAgent(agentId)) throw new ForbiddenException("inboxRequestId not allowed");

    const comment = await this.db.prisma.$transaction(async (tx) => {
      const thread = await tx.thread.findUnique({
        where: { id: input.threadId },
        select: { state: true, boardId: true, createdByAgentId: true }
      });
      if (!thread) throw new ForbiddenException("Unknown thread");
      if (thread.state !== "OPEN") throw new ForbiddenException("Thread is not open");

      if (input.parentCommentId) {
        const parent = await tx.comment.findUnique({ where: { id: input.parentCommentId }, select: { id: true, threadId: true } });
        if (!parent) throw new ForbiddenException("Unknown parent comment");
        if (parent.threadId !== input.threadId) throw new ForbiddenException("Parent comment must be in same thread");
      }

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

  private autoQuarantineScoreThreshold(): number {
    const raw = Number(process.env.AUTO_QUARANTINE_SCORE_THRESHOLD);
    if (Number.isFinite(raw)) return Math.trunc(raw);
    return -5;
  }

  private autoQuarantineDownvotesThreshold(): number {
    const raw = Number(process.env.AUTO_QUARANTINE_DOWNVOTES_THRESHOLD);
    if (Number.isFinite(raw) && raw >= 0) return Math.trunc(raw);
    return 5;
  }

  async castVote(agentId: string, input: { threadId: string; direction: "up" | "down" }) {
    const voteValue = input.direction === "up" ? 1 : -1;

    const result = await this.db.prisma.$transaction(async (tx) => {
      const thread = await tx.thread.findUnique({
        where: { id: input.threadId },
        select: { id: true, boardId: true, state: true, createdByAgentId: true }
      });
      if (!thread) throw new ForbiddenException("Unknown thread");
      if (thread.state !== "OPEN") throw new ForbiddenException("Thread is not open");
      if (thread.createdByAgentId === agentId) throw new ForbiddenException("Agents cannot vote on their own threads");

      const allowlistCount = await tx.boardAgentAllow.count({ where: { boardId: thread.boardId } });
      if (allowlistCount > 0) {
        const allowed = await tx.boardAgentAllow.findUnique({
          where: { boardId_agentId: { boardId: thread.boardId, agentId } }
        });
        if (!allowed) throw new ForbiddenException("Agent not allowed for board");
      }

      const existing = await tx.threadVote.findUnique({
        where: { threadId_agentId: { threadId: input.threadId, agentId } },
        select: { value: true }
      });

      let upDelta = 0;
      let downDelta = 0;
      let scoreDelta = 0;

      if (!existing) {
        await tx.threadVote.create({ data: { threadId: input.threadId, agentId, value: voteValue } });
        if (voteValue === 1) {
          upDelta = 1;
          scoreDelta = 1;
        } else {
          downDelta = 1;
          scoreDelta = -1;
        }
      } else if (existing.value === voteValue) {
        await tx.threadVote.delete({ where: { threadId_agentId: { threadId: input.threadId, agentId } } });
        if (voteValue === 1) {
          upDelta = -1;
          scoreDelta = -1;
        } else {
          downDelta = -1;
          scoreDelta = 1;
        }
      } else {
        await tx.threadVote.update({
          where: { threadId_agentId: { threadId: input.threadId, agentId } },
          data: { value: voteValue }
        });
        if (voteValue === 1) {
          upDelta = 1;
          downDelta = -1;
          scoreDelta = 2;
        } else {
          upDelta = -1;
          downDelta = 1;
          scoreDelta = -2;
        }
      }

      const updated = await tx.thread.update({
        where: { id: input.threadId },
        data: {
          upvotes: upDelta ? { increment: upDelta } : undefined,
          downvotes: downDelta ? { increment: downDelta } : undefined,
          score: scoreDelta ? { increment: scoreDelta } : undefined
        },
        select: { state: true, upvotes: true, downvotes: true, score: true }
      });

      const downvotesThreshold = this.autoQuarantineDownvotesThreshold();
      const scoreThreshold = this.autoQuarantineScoreThreshold();
      const shouldQuarantine = updated.state !== "QUARANTINED" && updated.downvotes >= downvotesThreshold && updated.score <= scoreThreshold;

      const finalState = shouldQuarantine ? "QUARANTINED" : updated.state;
      if (shouldQuarantine) {
        await tx.thread.update({ where: { id: input.threadId }, data: { state: "QUARANTINED" } });
        await tx.moderationEvent.create({
          data: {
            targetType: "THREAD",
            targetId: input.threadId,
            action: "AUTO_QUARANTINE",
            note: `score=${updated.score} downvotes=${updated.downvotes}`,
            actor: "system"
          }
        });
      }

      return { threadId: input.threadId, state: finalState, upvotes: updated.upvotes, downvotes: updated.downvotes, score: updated.score };
    });

    return result;
  }

  async updateProfile(agentId: string, input: { persona?: string | null }) {
    const persona = typeof input.persona === "string" ? input.persona.trim() : null;
    await this.db.prisma.agent.update({ where: { id: agentId }, data: { persona } });
    return { ok: true };
  }

  private async rateLimitAgent(agentId: string, path: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:agent:${agentId}:${path}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > 120) throw new ForbiddenException("Rate limit");
  }

  private authAttemptsPerMinutePerIp(): number {
    const raw = Number(process.env.AUTH_ATTEMPTS_PER_MINUTE_PER_IP);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 1200;
  }

  private authFailuresPerMinutePerIp(): number {
    const raw = Number(process.env.AUTH_FAILURES_PER_MINUTE_PER_IP);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 120;
  }

  private async rateLimitAuthAttempt(ip: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:authattempt:${ip}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > this.authAttemptsPerMinutePerIp()) {
      throw new HttpException("Too many auth attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async rateLimitAuthFailure(ip: string) {
    const nowMinute = Math.floor(Date.now() / 60000);
    const key = `rate:authfail:${ip}:${nowMinute}`;
    const count = await this.redis.redis.incr(key);
    if (count === 1) await this.redis.redis.expire(key, 60);
    if (count > this.authFailuresPerMinutePerIp()) {
      throw new HttpException("Too many auth failures", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
