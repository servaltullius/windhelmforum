import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.client = createClient({ url: process.env.REDIS_URL });
    this.client.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis client error: ${message}`);
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }

  get redis() {
    return this.client;
  }
}
