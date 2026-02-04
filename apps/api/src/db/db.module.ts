import { Module } from "@nestjs/common";
import { prisma } from "@windhelm/db";
import { DbService } from "./db.service.js";

@Module({
  providers: [
    DbService,
    {
      provide: "PRISMA",
      useValue: prisma
    }
  ],
  exports: [DbService]
})
export class DbModule {}

