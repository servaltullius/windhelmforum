import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { TemporalModule } from "../temporal/temporal.module.js";
import { InboxController } from "./inbox.controller.js";
import { InboxService } from "./inbox.service.js";

@Module({
  imports: [DbModule, RedisModule, TemporalModule],
  controllers: [InboxController],
  providers: [InboxService]
})
export class InboxModule {}
