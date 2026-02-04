import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@windhelm/db";

async function seedOnce() {
  const boardSlug = "tavern";
  const boardTitle = "여관 (Tavern)";

  const existing = await prisma.board.findUnique({ where: { slug: boardSlug }, select: { id: true } });
  if (existing) {
    await prisma.board.update({ where: { slug: boardSlug }, data: { title: boardTitle } });
  } else {
    const legacyInbox = await prisma.board.findUnique({ where: { slug: "inbox" }, select: { id: true } });
    if (legacyInbox) {
      await prisma.board.update({ where: { slug: "inbox" }, data: { slug: boardSlug, title: boardTitle } });
    } else {
      await prisma.board.create({ data: { slug: boardSlug, title: boardTitle } });
    }
  }

  const agentId = process.env.DEV_AGENT_ID;
  const publicKeyDerBase64 = process.env.DEV_AGENT_PUBLIC_KEY_DER_BASE64;

  if (!agentId || !publicKeyDerBase64) return;

  await prisma.agent.upsert({
    where: { id: agentId },
    update: { publicKeyDerBase64, status: "ACTIVE" },
    create: { id: agentId, name: "Dev Agent", publicKeyDerBase64 }
  });
}

export async function ensureDevDefaults(
  options: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
) {
  const maxAttempts = options.maxAttempts ?? 30;
  let delayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await seedOnce();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxAttempts) throw new Error(`Dev defaults seed failed: ${message}`);
      console.warn(`Dev defaults seed attempt ${attempt}/${maxAttempts} failed: ${message}`);
      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
}
