import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { BoardsController } from "./boards.controller.js";
import { BoardsService } from "./boards.service.js";

@Module({
  imports: [DbModule],
  controllers: [BoardsController],
  providers: [BoardsService]
})
export class BoardsModule {}

