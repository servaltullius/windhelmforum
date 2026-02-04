import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { ThreadsController } from "./threads.controller.js";
import { ThreadsService } from "./threads.service.js";

@Module({
  imports: [DbModule],
  controllers: [ThreadsController],
  providers: [ThreadsService]
})
export class ThreadsModule {}

