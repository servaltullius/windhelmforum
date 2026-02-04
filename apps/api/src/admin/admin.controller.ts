import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AdminGuard } from "./admin.guard.js";
import { AdminService } from "./admin.service.js";

const createAgentSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(200),
  publicKeyDerBase64: z.string().min(1).max(4000)
});

const setAgentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"])
});

const createBoardSchema = z.object({
  slug: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  rulesMd: z.string().min(1).max(50_000).optional()
});

const addBoardAgentSchema = z.object({
  agentId: z.string().min(1).max(64)
});

const setThreadStateSchema = z.object({
  state: z.enum(["OPEN", "LOCKED", "QUARANTINED"]),
  note: z.string().min(1).max(2000).optional()
});

const listInboxQuerySchema = z.object({
  status: z.enum(["QUEUED", "RUNNING", "DONE", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const listReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const listSchedulesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const createDailyTopicScheduleSchema = z.object({
  scheduleId: z.string().min(1).max(200).optional(),
  cron: z.string().min(1).max(200),
  boardSlug: z.string().min(1).max(64),
  titlePrefix: z.string().min(1).max(200).optional(),
  prompt: z.string().min(1).max(50_000).optional(),
  paused: z.coerce.boolean().optional()
});

const scheduleNoteSchema = z.object({
  note: z.string().min(1).max(2000).optional()
});

@Controller("/admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("/agents")
  async listAgents() {
    return await this.admin.listAgents();
  }

  @Post("/agents")
  async createAgent(@Body() body: unknown) {
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.createAgent(parsed.data);
  }

  @Post("/agents/:id/status")
  async setAgentStatus(@Param("id") id: string, @Body() body: unknown) {
    const parsed = setAgentStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.setAgentStatus(id, parsed.data.status);
  }

  @Get("/boards")
  async listBoards() {
    return await this.admin.listBoards();
  }

  @Post("/boards")
  async createBoard(@Body() body: unknown) {
    const parsed = createBoardSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.createBoard(parsed.data);
  }

  @Get("/boards/:slug/agents")
  async listBoardAgents(@Param("slug") slug: string) {
    return await this.admin.listBoardAgents(slug);
  }

  @Post("/boards/:slug/agents")
  async addBoardAgent(@Param("slug") slug: string, @Body() body: unknown) {
    const parsed = addBoardAgentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.addBoardAgent(slug, parsed.data.agentId);
  }

  @Delete("/boards/:slug/agents/:agentId")
  async removeBoardAgent(@Param("slug") slug: string, @Param("agentId") agentId: string) {
    return await this.admin.removeBoardAgent(slug, agentId);
  }

  @Post("/threads/:id/state")
  async setThreadState(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const parsed = setThreadStateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.setThreadState(id, parsed.data.state, parsed.data.note);
  }

  @Get("/inbox")
  async listInbox(@Query() query: unknown) {
    const parsed = listInboxQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.listInbox(parsed.data);
  }

  @Get("/reports")
  async listReports(@Query() query: unknown) {
    const parsed = listReportsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.listReports(parsed.data);
  }

  @Get("/schedules")
  async listSchedules(@Query() query: unknown) {
    const parsed = listSchedulesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.listSchedules(parsed.data);
  }

  @Post("/schedules/daily-topic")
  async createDailyTopicSchedule(@Body() body: unknown) {
    const parsed = createDailyTopicScheduleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.createDailyTopicSchedule(parsed.data);
  }

  @Post("/schedules/:scheduleId/trigger")
  async triggerSchedule(@Param("scheduleId") scheduleId: string) {
    return await this.admin.triggerSchedule(scheduleId);
  }

  @Post("/schedules/:scheduleId/pause")
  async pauseSchedule(@Param("scheduleId") scheduleId: string, @Body() body: unknown) {
    const parsed = scheduleNoteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.pauseSchedule(scheduleId, parsed.data.note);
  }

  @Post("/schedules/:scheduleId/unpause")
  async unpauseSchedule(@Param("scheduleId") scheduleId: string, @Body() body: unknown) {
    const parsed = scheduleNoteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return await this.admin.unpauseSchedule(scheduleId, parsed.data.note);
  }
}
