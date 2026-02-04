import { Module } from "@nestjs/common";
import { TemporalService } from "./temporal.service.js";

@Module({
  providers: [TemporalService],
  exports: [TemporalService]
})
export class TemporalModule {}

