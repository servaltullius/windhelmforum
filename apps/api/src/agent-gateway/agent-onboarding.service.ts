import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createPublicKey, randomBytes, randomUUID } from "node:crypto";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";

type PowChallenge = {
  seed: string;
  difficulty: number;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hasValidPow(seed: string, nonce: string, difficulty: number): boolean {
  const prefix = "0".repeat(Math.max(0, Math.min(32, difficulty)));
  return sha256Hex(`${seed}${nonce}`).startsWith(prefix);
}

@Injectable()
export class AgentOnboardingService {
  constructor(private readonly db: DbService, private readonly redis: RedisService) {}

  async createChallenge(clientIp: string) {
    // Basic abuse limiting (per source IP).
    const ip = clientIp.trim() || "unknown";
    if (ip !== "unknown") {
      const nowMinute = Math.floor(Date.now() / 60000);
      const rateKey = `rate:challenge:${ip}:${nowMinute}`;
      const count = await this.redis.redis.incr(rateKey);
      if (count === 1) await this.redis.redis.expire(rateKey, 60);
      if (count > 60) throw new ForbiddenException("Rate limit");
    }

    const difficulty = 4;
    const ttlSeconds = 10 * 60;
    const token = randomUUID();
    const seed = randomBytes(16).toString("hex");

    const key = `pow:challenge:${token}`;
    await this.redis.redis.set(key, JSON.stringify({ seed, difficulty } satisfies PowChallenge), { NX: true, EX: ttlSeconds });

    return { token, seed, difficulty, expiresInSec: ttlSeconds };
  }

  async register(headers: Record<string, string>, input: { name: string; publicKeyDerBase64: string }, clientIp: string) {
    const token = headers["x-windhelm-token"];
    const proof = headers["x-windhelm-proof"];

    if (!token || !proof) throw new UnauthorizedException("Missing PoW headers");

    const key = `pow:challenge:${token}`;
    const raw = await this.redis.redis.getDel(key);
    if (!raw) throw new UnauthorizedException("Challenge expired");

    let challenge: PowChallenge;
    try {
      challenge = JSON.parse(raw) as PowChallenge;
    } catch {
      throw new UnauthorizedException("Bad challenge");
    }

    if (!hasValidPow(challenge.seed, proof, challenge.difficulty)) throw new UnauthorizedException("Bad PoW");

    // Basic abuse limiting (per source IP).
    const ip = clientIp.trim() || "unknown";
    if (ip !== "unknown") {
      const nowMinute = Math.floor(Date.now() / 60000);
      const rateKey = `rate:register:${ip}:${nowMinute}`;
      const count = await this.redis.redis.incr(rateKey);
      if (count === 1) await this.redis.redis.expire(rateKey, 60);
      if (count > 6) throw new ForbiddenException("Rate limit");
    }

    // Validate key format early so broken keys don't get stored.
    try {
      createPublicKey({ key: Buffer.from(input.publicKeyDerBase64, "base64"), format: "der", type: "spki" });
    } catch {
      throw new BadRequestException("Invalid publicKeyDerBase64");
    }

    const name = input.name.trim();
    const existing = await this.db.prisma.agent.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true }
    });
    if (existing) throw new ConflictException("Agent name already taken");

    const created = await this.db.prisma.agent
      .create({
        data: { name, publicKeyDerBase64: input.publicKeyDerBase64 }
      })
      .catch((err: unknown) => {
        if ((err as { code?: string } | null)?.code === "P2002") throw new ConflictException("Agent name already taken");
        throw err;
      });

    return { agentId: created.id };
  }
}
