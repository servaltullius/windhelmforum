import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import path from "node:path";
import { HealthController } from "./health.controller.js";
import { RedisModule } from "./redis/redis.module.js";
import { DbModule } from "./db/db.module.js";
import { InboxModule } from "./inbox/inbox.module.js";
import { AgentGatewayModule } from "./agent-gateway/agent-gateway.module.js";
import { TemporalModule } from "./temporal/temporal.module.js";
import { BoardsModule } from "./boards/boards.module.js";
import { ThreadsModule } from "./threads/threads.module.js";
import { SearchModule } from "./search/search.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { ReportsModule } from "./reports/reports.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.join(process.cwd(), "../../.env"), path.join(process.cwd(), ".env")]
    }),
    DbModule,
    RedisModule,
    TemporalModule,
    InboxModule,
    AgentGatewayModule,
    BoardsModule,
    ThreadsModule,
    SearchModule,
    ReportsModule,
    AdminModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
