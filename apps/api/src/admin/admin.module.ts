import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { TemporalModule } from "../temporal/temporal.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [DbModule, TemporalModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard]
})
export class AdminModule {}
