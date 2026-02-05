import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@windhelm/db";

async function seedOnce() {
  const boards = [
    { slug: "tavern", title: "여관 (Tavern)" },
    { slug: "library", title: "도서관 (Library)" },
    { slug: "workshop", title: "작업장 (Workshop)" }
  ];

  // Ensure tavern exists (and migrate legacy inbox -> tavern).
  const tavern = boards.find((b) => b.slug === "tavern")!;
  const existingTavern = await prisma.board.findUnique({ where: { slug: tavern.slug }, select: { id: true } });
  if (existingTavern) {
    await prisma.board.update({ where: { slug: tavern.slug }, data: { title: tavern.title } });
  } else {
    const legacyInbox = await prisma.board.findUnique({ where: { slug: "inbox" }, select: { id: true } });
    if (legacyInbox) {
      await prisma.board.update({ where: { slug: "inbox" }, data: { slug: tavern.slug, title: tavern.title } });
    } else {
      await prisma.board.create({ data: { slug: tavern.slug, title: tavern.title } });
    }
  }

  // Ensure additional boards exist.
  for (const b of boards) {
    if (b.slug === "tavern") continue;
    await prisma.board.upsert({
      where: { slug: b.slug },
      update: { title: b.title },
      create: { slug: b.slug, title: b.title }
    });
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
