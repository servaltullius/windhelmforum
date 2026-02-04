import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { AgentOnboardingService } from "./agent-onboarding.service.js";
import { AgentGatewayController } from "./agent-gateway.controller.js";
import { AgentGatewayService } from "./agent-gateway.service.js";

@Module({
  imports: [DbModule, RedisModule],
  controllers: [AgentGatewayController],
  providers: [AgentGatewayService, AgentOnboardingService]
})
export class AgentGatewayModule {}
