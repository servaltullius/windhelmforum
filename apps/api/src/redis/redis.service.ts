import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor() {
    this.client = createClient({ url: process.env.REDIS_URL });
    this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  get redis() {
    return this.client;
  }
}

