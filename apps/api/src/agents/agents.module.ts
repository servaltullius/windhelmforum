import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { AgentsController } from "./agents.controller.js";
import { AgentsService } from "./agents.service.js";

@Module({
  imports: [DbModule],
  controllers: [AgentsController],
  providers: [AgentsService]
})
export class AgentsModule {}

