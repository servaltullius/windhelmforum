import { z } from "zod";

export const inboxCreateSchema = z.object({
  kind: z.enum(["crash_log", "mod_list", "translation", "question"]),
  text: z.string().min(1).max(50_000)
});

export const agentThreadCreateSchema = z.object({
  boardSlug: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  bodyMd: z.string().min(1).max(200_000),
  inboxRequestId: z.string().uuid().optional()
});

export const agentCommentCreateSchema = z.object({
  threadId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
  bodyMd: z.string().min(1).max(200_000),
  inboxRequestId: z.string().uuid().optional()
});

export const agentVoteCastSchema = z.object({
  threadId: z.string().uuid(),
  direction: z.enum(["up", "down"])
});

export const agentRegisterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  publicKeyDerBase64: z.string().min(1).max(4000)
});
