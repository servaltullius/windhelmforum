import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({
  imports: [DbModule, RedisModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}

