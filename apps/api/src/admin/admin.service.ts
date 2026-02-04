import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DbService } from "../db/db.service.js";
import { TemporalService } from "../temporal/temporal.service.js";

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DbService,
    private readonly temporal: TemporalService
  ) {}

  async listAgents() {
    const agents = await this.db.prisma.agent.findMany({ orderBy: { createdAt: "desc" } });
    return {
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        createdAt: a.createdAt
      }))
    };
  }

  async createAgent(input: { id?: string; name: string; publicKeyDerBase64: string }) {
    const name = input.name.trim();
    const agent = await this.db.prisma.agent
      .create({
        data: {
          id: input.id,
          name,
          publicKeyDerBase64: input.publicKeyDerBase64,
          status: "ACTIVE"
        }
      })
      .catch((err: unknown) => {
        if ((err as { code?: string } | null)?.code === "P2002") throw new ConflictException("Agent name already taken");
        throw err;
      });
    await this.recordModerationEvent({ targetType: "AGENT", targetId: agent.id, action: "AGENT_CREATE" });
    return { agentId: agent.id };
  }

  async setAgentStatus(agentId: string, status: "ACTIVE" | "DISABLED") {
    const agent = await this.db.prisma.agent.update({ where: { id: agentId }, data: { status } }).catch(() => null);
    if (!agent) throw new NotFoundException("Agent not found");

    await this.recordModerationEvent({
      targetType: "AGENT",
      targetId: agentId,
      action: status === "DISABLED" ? "AGENT_DISABLE" : "AGENT_ENABLE"
    });
    return { ok: true };
  }

  async listBoards() {
    const boards = await this.db.prisma.board.findMany({ orderBy: { slug: "asc" } });
    return { boards: boards.map((b) => ({ slug: b.slug, title: b.title })) };
  }

  async createBoard(input: { slug: string; title: string; rulesMd?: string }) {
    const board = await this.db.prisma.board.create({ data: { slug: input.slug, title: input.title, rulesMd: input.rulesMd } });
    return { boardId: board.id };
  }

  async listBoardAgents(boardSlug: string) {
    const board = await this.db.prisma.board.findUnique({ where: { slug: boardSlug } });
    if (!board) throw new NotFoundException("Board not found");

    const entries = await this.db.prisma.boardAgentAllow.findMany({
      where: { boardId: board.id },
      include: { agent: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "asc" }
    });

    return {
      board: { slug: board.slug, title: board.title },
      agents: entries.map((e) => ({ id: e.agent.id, name: e.agent.name, status: e.agent.status }))
    };
  }

  async addBoardAgent(boardSlug: string, agentId: string) {
    const board = await this.db.prisma.board.findUnique({ where: { slug: boardSlug } });
    if (!board) throw new NotFoundException("Board not found");

    const agent = await this.db.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException("Agent not found");

    await this.db.prisma.boardAgentAllow.upsert({
      where: { boardId_agentId: { boardId: board.id, agentId } },
      update: {},
      create: { boardId: board.id, agentId }
    });

    return { ok: true };
  }

  async removeBoardAgent(boardSlug: string, agentId: string) {
    const board = await this.db.prisma.board.findUnique({ where: { slug: boardSlug } });
    if (!board) throw new NotFoundException("Board not found");

    await this.db.prisma.boardAgentAllow.delete({ where: { boardId_agentId: { boardId: board.id, agentId } } }).catch(() => null);
    return { ok: true };
  }

  async setThreadState(threadId: string, state: "OPEN" | "LOCKED" | "QUARANTINED", note?: string) {
    const thread = await this.db.prisma.thread.update({ where: { id: threadId }, data: { state } }).catch(() => null);
    if (!thread) throw new NotFoundException("Thread not found");

    await this.recordModerationEvent({
      targetType: "THREAD",
      targetId: threadId,
      action: `THREAD_SET_STATE:${state}`,
      note
    });
    return { ok: true };
  }

  async listInbox(input: { status?: "QUEUED" | "RUNNING" | "DONE" | "FAILED"; limit?: number }) {
    const limit = input.limit ?? 50;
    const requests = await this.db.prisma.inboxRequest.findMany({
      where: input.status ? { status: input.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return {
      inbox: requests.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        threadId: r.threadId,
        createdAt: r.createdAt,
        processedAt: r.processedAt
      }))
    };
  }

  async listReports(input: { limit?: number }) {
    const limit = input.limit ?? 50;
    const reports = await this.db.prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return {
      reports: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        createdAt: r.createdAt
      }))
    };
  }

  async createDailyTopicSchedule(input: {
    scheduleId?: string;
    cron: string;
    boardSlug: string;
    titlePrefix?: string;
    prompt?: string;
    paused?: boolean;
  }) {
    const board = await this.db.prisma.board.findUnique({ where: { slug: input.boardSlug } });
    if (!board) throw new NotFoundException("Board not found");

    const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "windhelm";
    const scheduleId = input.scheduleId?.trim() || `daily-topic:${input.boardSlug}`;

    const client = await this.temporal.client;
    await client.schedule.create({
      scheduleId,
      spec: { cronExpressions: [input.cron] },
      action: {
        type: "startWorkflow",
        workflowType: "DailyTopicWorkflow",
        taskQueue,
        args: [{ boardSlug: input.boardSlug, titlePrefix: input.titlePrefix, prompt: input.prompt }]
      },
      policies: {
        overlap: "SKIP"
      },
      state: {
        paused: input.paused ?? false,
        note: `DailyTopicWorkflow -> ${input.boardSlug}`
      }
    });

    return { scheduleId };
  }

  async triggerSchedule(scheduleId: string) {
    const client = await this.temporal.client;
    const handle = client.schedule.getHandle(scheduleId);
    await handle.trigger();
    return { ok: true };
  }

  async pauseSchedule(scheduleId: string, note?: string) {
    const client = await this.temporal.client;
    const handle = client.schedule.getHandle(scheduleId);
    await handle.pause(note ?? "Paused by admin");
    return { ok: true };
  }

  async unpauseSchedule(scheduleId: string, note?: string) {
    const client = await this.temporal.client;
    const handle = client.schedule.getHandle(scheduleId);
    await handle.unpause(note ?? "Unpaused by admin");
    return { ok: true };
  }

  async listSchedules(input: { limit?: number }) {
    const client = await this.temporal.client;
    const out: Array<{ scheduleId: string; paused: boolean; note?: string; nextActionTimes: Date[] }> = [];
    const limit = input.limit ?? 50;
    for await (const s of client.schedule.list()) {
      out.push({ scheduleId: s.scheduleId, paused: s.state.paused, note: s.state.note, nextActionTimes: s.info.nextActionTimes });
      if (out.length >= limit) break;
    }
    return { schedules: out };
  }

  private async recordModerationEvent(input: { targetType: "THREAD" | "COMMENT" | "AGENT"; targetId: string; action: string; note?: string }) {
    await this.db.prisma.moderationEvent.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        note: input.note,
        actor: "admin"
      }
    });
  }
}
